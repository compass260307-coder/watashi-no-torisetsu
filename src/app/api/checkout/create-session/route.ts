// プレミアム化 v3 Day 3: Stripe Checkout Session 作成 (Web ファースト版)
//
// POST /api/checkout/create-session
//   - 認可: Cookie wn_session (旧: Authorization: Bearer <LIFF id_token>)
//   - body: { include_self: boolean, perception_ids: string[] }
//   - 戻り値: { sessionId, url } (Stripe Checkout の hosted page URL)
//
// 認可・perception 検証:
//   - session.user.id を直接使用 (LINE 経由の users.id 集約ロジックは不要)
//   - perception の target_user_id が session.user.id と一致するかチェック
//
// metadata に user_id / include_self / perception_ids を載せ、Webhook (T2-7) で
// payment_history + integrated_trisetsu 生成キックに使用する。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { getStripe, getPremiumPriceId } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const maxDuration = 30;

// .env.local で NEXT_PUBLIC_SITE_URL="" の空文字を弾くため || を使用 (?? は不可)
const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.id;

  // ===== body parse =====
  let body: {
    include_self?: unknown;
    perception_ids?: unknown;
    email?: unknown;
  };
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

  // ===== email 解決 (Web ファースト: 購入時に必須) =====
  // body.email > session.email の優先で決定。両方なしは 400。
  // body で来た値は lowercase normalize して users.email に永続化。
  // Stripe Checkout の customer_email として渡し、決済成功後の連絡経路にする。
  const bodyEmailRaw =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  const isValidEmail = (v: string | null): v is string =>
    !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;

  let customerEmail: string | null = null;
  if (isValidEmail(bodyEmailRaw)) {
    customerEmail = bodyEmailRaw;
  } else if (isValidEmail(session.email)) {
    customerEmail = session.email;
  }

  if (!customerEmail) {
    return NextResponse.json(
      {
        error: "メールアドレスが必要です",
        detail: "決済完了とトリセツ完成のお知らせをこのアドレスに送ります",
      },
      { status: 400 },
    );
  }

  // body で新規 email を受け取った (= session.email と異なる or 未設定) 場合は永続化
  if (bodyEmailRaw && bodyEmailRaw === customerEmail && session.email !== bodyEmailRaw) {
    const { error: emailUpdErr } = await supabaseAdmin
      .from("users")
      .update({ email: customerEmail })
      .eq("id", userId);
    if (emailUpdErr) {
      console.error(
        "[checkout/create-session] email persist error (continuing):",
        emailUpdErr,
      );
      // 永続化失敗でも Stripe Checkout 自体は進める (メール送信時に最新化される機会あり)
    }
  }

  // ===== perception 検証 =====
  if (perceptionIds.length > 0) {
    const { data: ps, error: pErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id, target_user_id, pdf_consent")
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
    const invalid = ps.find((p) => (p.target_user_id as string) !== userId);
    if (invalid) {
      return NextResponse.json(
        { error: "他人の perception_id は統合素材にできません" },
        { status: 403 },
      );
    }
    // T3-3: pdf_consent=false の perception は決済対象にできない (サーバ側ガード)
    const notConsented = ps.find((p) => p.pdf_consent !== true);
    if (notConsented) {
      return NextResponse.json(
        {
          error: "PDF 利用未同意の友達評価は統合素材にできません",
          perception_id: notConsented.id,
        },
        { status: 403 },
      );
    }
  }

  // ===== Stripe Checkout Session 作成 =====
  // customer_email を必須化: 決済成功通知 + トリセツ完成メールの宛先。
  // line_user_id は Web ファースト化により optional (LINE 連携済みなら付与)。
  // metadata に email も含めて webhook で参照可能に (users.email は冪等更新済)。
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: customerEmail,
      metadata: {
        user_id: userId,
        email: customerEmail,
        line_user_id: session.line_user_id ?? "",
        include_self: String(includeSelf),
        perception_ids: JSON.stringify(perceptionIds),
      },
      success_url: `${BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/integrated/new`,
      locale: "ja",
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
    sessionId: stripeSession.id,
    url: stripeSession.url,
  });
}
