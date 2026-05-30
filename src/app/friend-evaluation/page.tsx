// Phase 1.5-α Day 12-A: 友達評価ハブページ (軸2 入口)
//
// 役割: ハンバーガーメニュー「友達による評価」のリンク先。Owner が
// 自分の招待 QR + キャラコード + 評価履歴を一覧する入口。
//
// Server Component:
//   - getSession() で認可 (Cookie 必須)、未ログインなら案内 + /diagnosis 誘導
//   - friend_perceptions と integrated_trisetsu を /me/[token] と同じ形で取得
//
// Day 12-A スコープ (今回):
//   - QR + キャラコード (FriendGapInvite を再利用、Day 11.3)
//   - 評価履歴リスト (perceptions、Day 10 から /me/[token] にあるものを移植)
//   - 評価 0 件時の空状態 UI
//   - ハンバーガーメニュー (3 項目)
//   - 統合カード枠 (Day 11.1)
//
// Day 12-B/C で扱う (今回スコープ外):
//   - ページ B (B 側評価フロー入口、/friend/[inviteCode] のリブランド)
//   - ページ C (6 章 freemium 評価結果、レーダーチャート、相互理解度、Stripe)
//   - friend_perceptions スキーマに Big Five 5 次元スコア追加 (現状未保存、調査で判明)
//
// 触らない:
//   - users / friend_perceptions / integrated_trisetsu / payment_history の DB スキーマ
//   - 既存の課金フロー (/integrated/new、Stripe Webhook)
//   - /me/[token] の本体 (Day 11.x 完成、本 PR で <HamburgerMenu /> 置換のみ)
//   - /friend/[inviteCode] (友達評価フロー本体、Day 12-B で扱う)

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { buildFullCode, classifyModifier } from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";
import { FriendGapInvite } from "@/components/result/FriendGapInvite";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import type {
  BigFiveDimension,
  CModifier,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "友達による評価",
  // session で識別される個人ページなので noindex
  robots: { index: false, follow: false },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.watashi-torisetsu.com";

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function deriveFullCode(typeId: string, stored: StoredScores): string {
  if (stored.fullCode) return stored.fullCode;
  const dimScores: Record<BigFiveDimension, number> = {
    E: typeof stored.E === "number" ? stored.E : 5,
    A: typeof stored.A === "number" ? stored.A : 5,
    O: typeof stored.O === "number" ? stored.O : 5,
    C: typeof stored.C === "number" ? stored.C : 5,
    N: typeof stored.N === "number" ? stored.N : 5,
  };
  const { cModifier, nModifier } = classifyModifier(dimScores);
  return buildFullCode(typeId as TorisetsuTypeId, cModifier, nModifier);
}

function deriveModifierLabel(
  typeId: string,
  stored: StoredScores,
): string {
  if (stored.modifierLabel) return stored.modifierLabel;
  const dimScores: Record<BigFiveDimension, number> = {
    E: typeof stored.E === "number" ? stored.E : 5,
    A: typeof stored.A === "number" ? stored.A : 5,
    O: typeof stored.O === "number" ? stored.O : 5,
    C: typeof stored.C === "number" ? stored.C : 5,
    N: typeof stored.N === "number" ? stored.N : 5,
  };
  const { cModifier, nModifier } = classifyModifier(dimScores);
  void (typeId as TorisetsuTypeId);
  return getModifierLabel(cModifier, nModifier);
}

export default async function FriendEvaluationPage() {
  // ===== 1. session 必須 =====
  const session = await getSession();
  if (!session) {
    return <UnauthenticatedView />;
  }

  // ===== 2. session.id から users 行 =====
  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select(
      "id, type_id, scores, display_name, invite_code, owner_token, created_at",
    )
    .eq("id", session.id)
    .maybeSingle();
  if (userErr) {
    console.error("[/friend-evaluation] users lookup error:", userErr);
  }
  if (!user) {
    return <UnauthenticatedView />;
  }

  // ===== 3. friend_perceptions =====
  const { data: perceptionRows } = await supabaseAdmin
    .from("friend_perceptions")
    .select(
      "id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, qualitative_data, created_at",
    )
    .eq("target_user_id", user.id)
    .order("created_at", { ascending: false });
  const perceptions = (perceptionRows ?? []).map((p) => ({
    id: p.id as string,
    perceiverName: (p.perceiver_name as string) ?? "友達",
    typeName:
      torisetsuTypes[p.perceived_type_id as TorisetsuTypeId]?.name ??
      (p.perceived_type_id as string),
    fullCode: (p.perceived_full_code as string) ?? "",
    modifierLabel: (p.perceived_modifier_label as string | null) ?? null,
    qualitative:
      (p.qualitative_data as Record<string, string> | null) ?? null,
    createdAt: p.created_at as string,
  }));

  // ===== 4. integrated_trisetsu (completed のみ、新しい順) =====
  const { data: integratedRows } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select(
      "id, generated_title, generated_subtitle, generated_at, perception_ids, include_self",
    )
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("generated_at", { ascending: false });
  const integrated = (integratedRows ?? []).map((r) => ({
    id: r.id as string,
    title: (r.generated_title as string | null) ?? "真のトリセツ",
    subtitle: (r.generated_subtitle as string | null) ?? "",
    generatedAt: r.generated_at as string,
    perceptionCount: Array.isArray(r.perception_ids)
      ? (r.perception_ids as unknown[]).length
      : 0,
    includeSelf: r.include_self !== false,
  }));

  // ===== 5. 派生値 =====
  const stored = (user.scores ?? {}) as StoredScores;
  const typeId = user.type_id as string;
  const fullCode = deriveFullCode(typeId, stored);
  // modifierLabel は将来「相互理解度」算出と合わせて使う想定で派生だけ確保 (Day 12-A では未表示)
  void deriveModifierLabel(typeId, stored);
  const ownerName = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerName || "アナタ";
  const inviteCode = user.invite_code as string;
  const ownerToken = user.owner_token as string;
  const inviteUrl = `${SITE_URL}/friend/${inviteCode}`;
  const myTrisetsuUrl = `/me/${ownerToken}`;

  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4">
      <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
        {/* ===== ヘッダー ===== */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/" aria-label="トップへ">
            <Image
              src="/logo.png"
              alt="ワタシのトリセツ"
              width={280}
              height={80}
              priority
              className="w-[120px] h-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]"
            />
          </Link>
          <HamburgerMenu myTrisetsuUrl={myTrisetsuUrl} />
        </div>

        {/* ===== ステッカー ===== */}
        <div className="flex justify-center mb-2">
          <div className="bg-[#FFE993] text-[#3A2D6B] font-black px-5 py-2 rounded-full border-2 border-[#3A2D6B] shadow-md -rotate-2 text-base">
            友達による評価
          </div>
        </div>

        {/* ===== QR + キャラコード (Day 11.3 FriendGapInvite を再利用) ===== */}
        <FriendGapInvite inviteUrl={inviteUrl} fullCode={fullCode} />

        {/* ===== 評価履歴セクション ===== */}
        <section className="mb-8">
          <h2 className="text-[#3A2D6B] font-black text-sm mb-3 flex items-baseline justify-between">
            <span>
              {displayName}を評価した友達
            </span>
            <span className="text-xs font-bold text-[#3A2D6B]/60">
              {perceptions.length}
            </span>
          </h2>
          {perceptions.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 text-center">
              <p className="text-[#3A2D6B] font-black text-base mb-2">
                まだ評価がありません
              </p>
              <p className="text-[#3A2D6B]/70 text-xs leading-relaxed">
                上の QR コードを友達に見せて
                <br />
                {displayName}を評価してもらおう
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {perceptions.map((p) => (
                <article
                  key={p.id}
                  className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-5"
                >
                  <p className="text-[11px] text-[#3A2D6B]/60 font-bold mb-1">
                    {p.perceiverName}さんから見た{displayName}
                  </p>
                  <p className="text-base font-black text-[#3A2D6B]">
                    {p.typeName}
                    {p.modifierLabel && (
                      <span className="text-xs font-normal text-[#3A2D6B]/60 ml-2">
                        ({p.modifierLabel})
                      </span>
                    )}
                  </p>
                  {p.qualitative &&
                    Object.keys(p.qualitative).length > 0 && (
                      <ul className="text-xs text-[#3A2D6B] leading-relaxed mt-3 space-y-1">
                        {p.qualitative.favorite_point && (
                          <li>
                            <span className="text-[#3A2D6B]/60 font-bold">
                              好きなところ:{" "}
                            </span>
                            {p.qualitative.favorite_point}
                          </li>
                        )}
                        {p.qualitative.animal && (
                          <li>
                            <span className="text-[#3A2D6B]/60 font-bold">
                              動物にたとえると:{" "}
                            </span>
                            {p.qualitative.animal}
                          </li>
                        )}
                        {p.qualitative.impression_scene && (
                          <li>
                            <span className="text-[#3A2D6B]/60 font-bold">
                              印象的なシーン:{" "}
                            </span>
                            {p.qualitative.impression_scene}
                          </li>
                        )}
                      </ul>
                    )}
                  <p className="text-[10px] text-[#3A2D6B]/50 font-bold mt-3">
                    {formatDate(p.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ===== 真のトリセツ履歴 (関連、Day 10 から維持) ===== */}
        {integrated.length > 0 && (
          <section className="mb-8">
            <h3 className="text-[#3A2D6B] font-black text-sm mb-3 flex items-baseline justify-between">
              <span>真のトリセツ</span>
              <span className="text-xs font-bold text-[#3A2D6B]/60">
                {integrated.length}
              </span>
            </h3>
            <div className="flex flex-col gap-3">
              {integrated.map((it) => (
                <Link
                  key={it.id}
                  href={`/integrated/${it.id}`}
                  className="block bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-5 hover:bg-[#FFF9F0] transition-colors"
                >
                  <p className="text-base font-black text-[#3A2D6B] mb-1">
                    {it.title}
                  </p>
                  {it.subtitle && (
                    <p className="text-xs text-[#3A2D6B]/70 leading-relaxed mb-2">
                      {it.subtitle}
                    </p>
                  )}
                  <p className="text-[10px] text-[#3A2D6B]/50 font-bold">
                    {formatDate(it.generatedAt)}
                    {" / "}
                    友達評価 {it.perceptionCount} 件
                    {it.includeSelf ? " (自己診断含む)" : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ===== Footer ===== */}
        <div className="text-center pt-2 pb-2">
          <Link
            href={myTrisetsuUrl}
            className="text-[#3A2D6B]/60 font-bold text-sm underline hover:text-[#FE3C72] transition-colors"
          >
            アナタのトリセツに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

// =========================================================================
// 未ログイン (session なし) ユーザー向け案内
// =========================================================================
function UnauthenticatedView() {
  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4">
      <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
        <div className="flex justify-between items-center mb-6">
          <Link href="/" aria-label="トップへ">
            <Image
              src="/logo.png"
              alt="ワタシのトリセツ"
              width={280}
              height={80}
              priority
              className="w-[120px] h-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]"
            />
          </Link>
          <HamburgerMenu />
        </div>

        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 text-center my-8">
          <h1 className="text-[#3A2D6B] font-black text-xl mb-2">
            まずは自己診断から
          </h1>
          <p className="text-[#3A2D6B]/70 text-sm leading-relaxed mb-5">
            友達評価を受けるには、先にアナタ自身の
            <br />
            自己診断 (50 問・約 3 分) が必要です。
          </p>
          <Link
            href="/diagnosis"
            className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
          >
            自己診断を始める →
          </Link>
        </div>

        <div className="text-center mb-6">
          <Link
            href="/login"
            className="text-[#3A2D6B]/60 text-xs font-bold underline hover:text-[#FE3C72] transition-colors"
          >
            購入済み・診断済みの方はログイン
          </Link>
        </div>

        <div className="text-center pt-2 pb-2">
          <Link
            href="/"
            className="text-[#3A2D6B]/60 font-bold text-sm underline hover:text-[#FE3C72] transition-colors"
          >
            トップに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
