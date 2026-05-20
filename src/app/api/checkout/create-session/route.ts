// プレミアム化 v2 Week 2 T2-6: Stripe Checkout Session 作成エンドポイント
//
// POST /api/checkout/create-session
//   - Authorization: Bearer <LIFF id_token> 必須
//   - body: { include_self: boolean, perception_ids: string[] }
//   - 戻り値: { sessionId, url } (Stripe Checkout の hosted page URL)
//
// 設計判断:
//   - Payment Element ではなく Stripe Checkout (hosted page) を採用
//     → 実装複雑度を下げ、Stripe 側 UI 改善の恩恵をそのまま受ける
//   - payment_method_types を明示せず Adaptive Payment Methods を採用
//     (Stripe 公式推奨: https://stripe.com/docs/payments/payment-method-types)
//     → Stripe Dashboard で有効化した決済手段 (Card / PayPay / コンビニ /
//       Apple Pay / Google Pay 等) が顧客の locale や決済可能性に応じて
//       自動的に Checkout に表示される。
//     → PayPay は Stripe 公式サポート済 (https://docs.stripe.com/payments/paypay)、
//       Dashboard で有効化されていれば Checkout に出る。γ ターゲット (10 代後半〜
//       20 代) のカード非保有者に対する主要な選択肢となる。
//     → SDK 22.1.1 の TypeScript 型 (PaymentMethodType enum) には PayPay の
//       明示列挙はないが、Adaptive Payment Methods 経由ではアプリ側のコード
//       変更なしで対応されるため問題なし。
//
// metadata に user_id / include_self / perception_ids を載せ、Webhook (T2-7) で
// payment_history + integrated_trisetsu 生成キックに使用する。
//
// 認可・perception 検証は POST /api/integrated-trisetsu と同じパターン:
//   - line_users 経由で自分の users 全行を取得
//   - perception の target_user_id がその集合に含まれているかチェック

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyBearer } from "@/lib/liff-verify";
import { getStripe, getPremiumPriceId } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function getMyUserIds(
  lineUserId: string,
  currentUserId: string,
): Promise<string[]> {
  // line_users.line_user_id 直接 + owner_token / current_owner_token 経由の OR
  const { data: lineUsersAll } = await supabaseAdmin
    .from("line_users")
    .select("owner_token, current_owner_token")
    .eq("line_user_id", lineUserId);
  const tokens: string[] = [];
  for (const r of lineUsersAll ?? []) {
    if (r.owner_token) tokens.push(r.owner_token as string);
    if (
      r.current_owner_token &&
      r.current_owner_token !== r.owner_token
    ) {
      tokens.push(r.current_owner_token as string);
    }
  }
  const uniqTokens = Array.from(new Set(tokens));

  let q = supabaseAdmin.from("users").select("id");
  if (uniqTokens.length > 0) {
    const ownerList = uniqTokens.map((t) => `"${t}"`).join(",");
    q = q.or(
      `line_user_id.eq.${lineUserId},owner_token.in.(${ownerList})`,
    );
  } else {
    q = q.eq("line_user_id", lineUserId);
  }
  const { data: rows } = await q;
  const ids = (rows ?? []).map((r) => r.id as string);
  if (!ids.includes(currentUserId)) ids.push(currentUserId);
  return ids;
}

export async function POST(request: NextRequest) {
  // ===== Stripe 環境変数チェック =====
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }
  const priceId = getPremiumPriceId();
  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID not configured" },
      { status: 500 },
    );
  }

  // ===== 認可 =====
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lineUserId = verified.sub;

  // ===== body parse =====
  let body: { include_self?: unknown; perception_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const includeSelf = body.include_self !== false; // default true
  const perceptionIds: string[] = Array.isArray(body.perception_ids)
    ? body.perception_ids.filter((v): v is string => typeof v === "string")
    : [];

  if (!includeSelf && perceptionIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "include_self=false の場合、perception_ids を 1 件以上指定してください",
      },
      { status: 400 },
    );
  }

  // ===== ユーザー (current) 取得 =====
  const { data: lineUserRow, error: lineUserErr } = await supabaseAdmin
    .from("line_users")
    .select("current_owner_token, owner_token")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (lineUserErr) {
    console.error("[checkout/create-session] line_users error:", lineUserErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  const currentOwnerToken =
    lineUserRow?.current_owner_token ?? lineUserRow?.owner_token ?? null;
  if (!currentOwnerToken) {
    return NextResponse.json(
      { error: "LINE 連携が完了していません" },
      { status: 400 },
    );
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("owner_token", currentOwnerToken)
    .maybeSingle();
  if (userErr || !userRow) {
    console.error("[checkout/create-session] users lookup error:", userErr);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = userRow.id as string;

  // ===== perception 検証 =====
  if (perceptionIds.length > 0) {
    const myUserIds = await getMyUserIds(lineUserId, userId);
    const { data: ps, error: pErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id, target_user_id")
      .in("id", perceptionIds);
    if (pErr) {
      console.error("[checkout/create-session] perceptions error:", pErr);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
    if (!ps || ps.length !== perceptionIds.length) {
      return NextResponse.json(
        { error: "一部の perception_id が見つかりません" },
        { status: 404 },
      );
    }
    const invalid = ps.find(
      (p) => !myUserIds.includes(p.target_user_id as string),
    );
    if (invalid) {
      return NextResponse.json(
        { error: "他人の perception_id は統合素材にできません" },
        { status: 403 },
      );
    }
  }

  // ===== Stripe Checkout Session 作成 =====
  // metadata の各値は string 必須、500 文字制限あり。
  // perception_ids JSON が 500 文字を超えるケース (>15 件程度) は
  // 現実的に発生しないため stringify でそのまま渡す。
  // (将来万一超えたら、payment_history に id だけ載せて perception_ids は
  // 別途事前 INSERT する設計に切替検討)
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // payment_method_types を明示しないと、Stripe Dashboard の
      // 「Payment methods」設定に従ってカード・コンビニ・ウォレット等が
      // 自動的に表示される (Stripe 推奨方式)。
      // 個別に絞り込みたい場合だけ payment_method_types を指定する。
      metadata: {
        user_id: userId,
        line_user_id: lineUserId,
        include_self: String(includeSelf),
        perception_ids: JSON.stringify(perceptionIds),
      },
      success_url: `${BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/integrated/new`,
      locale: "ja",
      // 顧客の重複作成を抑制 (line_user_id ベースで一意化はしない、
      // Stripe customer は Phase 2 で導入検討)
    });
  } catch (err) {
    console.error("[checkout/create-session] Stripe error:", err);
    return NextResponse.json(
      {
        error: "Stripe session 作成に失敗しました",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    sessionId: session.id,
    url: session.url,
  });
}
