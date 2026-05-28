// プレミアム化 v3 Day 9: 個人の永続アクセス点 (/me/[token])
// Phase 1.5-α Day 10: Koi キャラ風 + Brand v2 に再構成
//
// 設計判断 (なぜ Server Component か):
//   - SEO 対応 (OGP は別途、本ページは noindex で漏洩リスク抑制)
//   - 初回 paint で全コンテンツ揃う方が UX 良好
//   - DB 直接アクセスで API ラッパー不要 → コード量削減
//
// token = users.owner_token (nanoid 22 文字、既存)
// 旧 /result/[ownerToken] と互換性のある token を再利用 (Day 1 設計判断)
//
// 認可モデル:
//   - 読み取り = token のみで誰でも可 (友達シェア前提)
//   - 編集 / 購入導線 = session.user.id === users.id (= isOwner) のときのみ表示
//
// Day 10 でのスコープ:
//   - 見た目を Koi 診断結果風に再構成 + Brand v2 化
//   - Server 維持、クリップボード等は <ResultActions /> (Client) に分離
//   - 既存 DB クエリ・isOwner 判定・integrated_trisetsu / friend_perceptions
//     のロジックはすべて維持
//   - キャラ画像・タイプ説明文は当面プレースホルダー (絵文字不使用、T3-5 方針)

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { buildFullCode, classifyModifier } from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";
import { ResultActions } from "@/components/result/ResultActions";
import type {
  BigFiveDimension,
  CModifier,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";

export const metadata: Metadata = {
  // owner_token は推測不可だが、検索エンジン除外で誤共有時の漏洩経路を絞る。
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

interface PageProps {
  params: Promise<{ token: string }>;
}

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

function deriveTypeLabel(
  typeId: string,
  stored: StoredScores,
): { typeName: string; fullCode: string; modifierLabel: string } {
  const typeMeta = torisetsuTypes[typeId as TorisetsuTypeId];
  const typeName = typeMeta?.name ?? typeId;

  let fullCode = stored.fullCode ?? "";
  let modifierLabel = stored.modifierLabel ?? "";
  if (!fullCode || !modifierLabel) {
    const dimScores: Record<BigFiveDimension, number> = {
      E: typeof stored.E === "number" ? stored.E : 5,
      A: typeof stored.A === "number" ? stored.A : 5,
      O: typeof stored.O === "number" ? stored.O : 5,
      C: typeof stored.C === "number" ? stored.C : 5,
      N: typeof stored.N === "number" ? stored.N : 5,
    };
    const { cModifier, nModifier } = classifyModifier(dimScores);
    if (!fullCode) {
      fullCode = buildFullCode(
        typeId as TorisetsuTypeId,
        cModifier,
        nModifier,
      );
    }
    if (!modifierLabel) {
      modifierLabel = getModifierLabel(cModifier, nModifier);
    }
  }
  return { typeName, fullCode, modifierLabel };
}

export default async function MePage({ params }: PageProps) {
  const { token } = await params;

  // ===== 1. token → users 行 =====
  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select(
      "id, type_id, scores, display_name, invite_code, owner_token, created_at",
    )
    .eq("owner_token", token)
    .maybeSingle();
  if (userErr) {
    console.error("[/me/[token]] users lookup error:", userErr);
  }
  if (!user) {
    notFound();
  }

  // ===== 2. session 解決 → isOwner 判定 =====
  const session = await getSession();
  const isOwner = !!session && session.id === (user.id as string);

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

  // ===== 5. ラベル導出 =====
  const stored = (user.scores ?? {}) as StoredScores;
  const { typeName, fullCode, modifierLabel } = deriveTypeLabel(
    user.type_id as string,
    stored,
  );
  const typeMeta =
    torisetsuTypes[user.type_id as TorisetsuTypeId] ?? undefined;
  const subtitle = (typeMeta?.subtitle as string | undefined) ?? "";
  const ownerName = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerName || "アナタ";
  const diagnosedAt = formatDate(user.created_at as string);
  const inviteCode = user.invite_code as string;
  const shareUrl = `${SITE_URL}/me/${token}`;

  return (
    <div className="min-h-screen bg-[#E4E0F5]">
      <div className="max-w-[480px] mx-auto px-4 pt-4 pb-12">
        {/* ===== ヘッダー (左ロゴ + 右ハンバーガー、LP と同じ) ===== */}
        <div className="flex justify-between items-center mb-6">
          <Image
            src="/logo.png"
            alt="ワタシのトリセツ"
            width={280}
            height={80}
            priority
            className="w-[120px] h-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]"
          />
          <button
            type="button"
            aria-label="メニュー"
            className="w-12 h-12 rounded-full bg-white border-2 border-[#3A2D6B] flex items-center justify-center text-[#3A2D6B] font-black"
          >
            ☰
          </button>
        </div>

        {/* ===== ステッカー (傾き付き) ===== */}
        <div className="flex justify-center mb-4">
          <div className="bg-[#FFE993] text-[#3A2D6B] font-black px-5 py-2 rounded-full border-2 border-[#3A2D6B] shadow-md -rotate-2 text-base">
            {displayName}のトリセツ
          </div>
        </div>

        {/* ===== キャラ画像プレースホルダー =====
            32 タイプ分のキャラ画像を /public/types/ 配下に後で配置。
            現状は枠 + テキストプレースホルダー (絵文字なし、T3-5 方針)。 */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-[280px] aspect-square rounded-3xl bg-gradient-to-b from-[#BCDEF8]/40 to-[#FFD6E0]/40 border-2 border-[#0094D8]/25 flex items-center justify-center">
            <div className="text-center text-[#3A2D6B]/40">
              <div className="font-black text-2xl tracking-[0.2em] mb-2">
                CHARACTER
              </div>
              <div className="text-xs font-bold">準備中</div>
            </div>
            {/* 装飾 (うっすら) */}
            <Image
              src="/decorations/heart-pink.png"
              alt=""
              width={48}
              height={48}
              aria-hidden="true"
              className="absolute top-3 right-3 w-12 h-12 opacity-60 -rotate-12 pointer-events-none"
            />
            <Image
              src="/decorations/flower-yellow.png"
              alt=""
              width={40}
              height={40}
              aria-hidden="true"
              className="absolute bottom-3 left-3 w-10 h-10 opacity-60 rotate-12 pointer-events-none"
            />
          </div>
        </div>

        {/* ===== タイプ名 + 上ラベル + コードバッジ ===== */}
        <div className="text-center mb-4">
          <p className="text-[#FE3C72] font-bold text-sm mb-1">
            アナタのタイプ
          </p>
          <h1 className="text-[#3A2D6B] font-black text-3xl mb-3 leading-tight drop-shadow-[0_2px_0_rgba(255,255,255,0.6)]">
            {typeName}
          </h1>
          {fullCode && (
            <span className="inline-block bg-[#3A2D6B] text-white font-black text-sm px-4 py-1 rounded-full tracking-[0.25em]">
              {fullCode}
            </span>
          )}
        </div>

        {/* ===== サブ特性 (modifierLabel) ===== */}
        {modifierLabel && (
          <div className="flex justify-center mb-6">
            <span className="bg-[#BCDEF8]/60 text-[#3A2D6B] font-bold text-sm px-4 py-1.5 rounded-full border border-[#0094D8]/30">
              {modifierLabel}
            </span>
          </div>
        )}

        {/* ===== タイプ説明文 (subtitle + プレースホルダー) =====
            subtitle は既存の torisetsuTypes データ。本格的な性格説明文は
            32 タイプ分のデータ作成後に流し込む (後フェーズ)。 */}
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-6">
          {subtitle && (
            <p className="text-[#3A2D6B] font-bold text-sm leading-relaxed mb-3">
              {subtitle}
            </p>
          )}
          <p className="text-[#3A2D6B]/80 text-sm leading-relaxed">
            ここにアナタのタイプの性格説明が入ります。Big Five
            理論ベースの 50 問から、アナタらしさを 32 タイプに分類しています。
            友達からの評価が集まると、もっと立体的なアナタが見えてきます。
          </p>
          {diagnosedAt && (
            <p className="text-[#3A2D6B]/50 text-xs font-bold mt-4">
              診断日: {diagnosedAt}
            </p>
          )}
        </div>

        {/* ===== Client: キャラコード + SNS + 画像保存 ===== */}
        <ResultActions
          fullCode={fullCode}
          typeName={typeName}
          shareUrl={shareUrl}
        />

        {/* ===== 下半分: 次アクション (Owner / Visitor で分岐) ===== */}
        {isOwner ? (
          <OwnerCtaSection
            inviteCode={inviteCode}
            hasIntegrated={integrated.length > 0}
          />
        ) : (
          <VisitorCtaSection />
        )}

        {/* ===== Owner & integrated > 0: 真のトリセツ履歴 ===== */}
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

        {/* ===== 友達からの印象 (件数 > 0 のとき) ===== */}
        {perceptions.length > 0 && (
          <section className="mb-8">
            <h3 className="text-[#3A2D6B] font-black text-sm mb-3 flex items-baseline justify-between">
              <span>
                {displayName}を見た、誰かの眼
              </span>
              <span className="text-xs font-bold text-[#3A2D6B]/60">
                {perceptions.length}
              </span>
            </h3>
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
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ===== Footer ===== */}
        <div className="text-center pt-2 pb-2">
          <Link
            href="/"
            className="text-[#3A2D6B]/60 font-bold text-sm underline hover:text-[#FE3C72] transition-colors"
          >
            トップに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Owner 経路: 友達評価依頼カード + 真のトリセツ ¥500 訴求 (integrated 0 件時)
// =========================================================================
function OwnerCtaSection({
  inviteCode,
  hasIntegrated,
}: {
  inviteCode: string;
  hasIntegrated: boolean;
}) {
  return (
    <>
      {/* 友達評価依頼カード */}
      <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-5">
        <h2 className="text-[#3A2D6B] font-black text-lg text-center mb-2">
          友達の眼を集めると、もっと立体的に
        </h2>
        <p className="text-[#3A2D6B]/70 text-sm text-center mb-4 leading-relaxed">
          この招待 URL を友達に送ると、友達がアナタを 30 問で評価できます。
        </p>
        <div className="flex justify-center mb-3">
          <Link
            href={`/friend/${inviteCode}`}
            className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
          >
            招待 URL を開く
          </Link>
        </div>
        <p className="text-[#3A2D6B]/60 text-xs text-center font-bold">
          評価が 3 件以上集まると{hasIntegrated ? "、新しく" : ""}
          「真のトリセツ」を作れます。
        </p>
        <p className="text-center mt-2">
          <Link
            href="/zukan-mine"
            className="text-[#3A2D6B]/60 text-xs font-bold underline hover:text-[#FE3C72] transition-colors"
          >
            マイ図鑑で履歴を見る
          </Link>
        </p>
      </div>

      {/* 真のトリセツ ¥500 訴求カード (integrated 未作成のとき) */}
      {!hasIntegrated && (
        <div className="bg-gradient-to-b from-[#BCDEF8]/30 to-[#FFD6E0]/30 rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-6">
          <h2 className="text-[#3A2D6B] font-black text-lg text-center mb-2">
            友達 3 人以上の評価で、本格レポートを作れます
          </h2>
          <p className="text-[#3A2D6B]/70 text-sm text-center mb-4 leading-relaxed">
            7 章・5,000 字以上の AI 統合レポート。
            <br />
            PDF として永続保存できます。
          </p>
          <div className="flex justify-center">
            <Link
              href="/integrated/new"
              className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black text-base px-10 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
            >
              真のトリセツを作る →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

// =========================================================================
// Visitor 経路: 自分の診断を始める CTA + 購入済みログイン
// =========================================================================
function VisitorCtaSection() {
  return (
    <>
      <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-5">
        <h2 className="text-[#3A2D6B] font-black text-lg text-center mb-2">
          アナタのトリセツも作れます
        </h2>
        <p className="text-[#3A2D6B]/70 text-sm text-center mb-4 leading-relaxed">
          50 問・約 3 分の自己診断から始まります。
          <br />
          登録不要、無料です。
        </p>
        <div className="flex justify-center">
          <Link
            href="/diagnosis"
            className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
          >
            自己診断を始める →
          </Link>
        </div>
      </div>
      <div className="text-center mb-6">
        <Link
          href="/login"
          className="text-[#3A2D6B]/60 text-xs font-bold underline hover:text-[#FE3C72] transition-colors"
        >
          購入済みの方はログイン
        </Link>
      </div>
    </>
  );
}
