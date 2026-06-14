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
import { buildFullCode, classifyModifier } from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import {
  classifySixteenType,
  characterImagePath,
} from "@/lib/sixteen-types";
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

  // ===== 3. friend_perceptions → 相互理解度ランキング (Polish-C) =====
  // Polish-C: タイプ名・qualitative は出さず、ニックネーム + 相互理解度 % のみ。
  // perceived_scores と自己 user.scores から calcMutualUnderstanding で % 算出、
  // 降順にソートして表示。
  const selfScores = (user.scores ?? {}) as BigFiveScores;
  const { data: perceptionRows } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id, perceiver_name, perceived_scores")
    .eq("target_user_id", user.id);
  const rankedPerceptions = (perceptionRows ?? [])
    .map((p) => {
      const otherScores = (p.perceived_scores ?? {}) as BigFiveScores;
      const gaps = buildDimensionGaps(selfScores, otherScores);
      const understanding = calcMutualUnderstanding(gaps);
      return {
        id: p.id as string,
        perceiverName: ((p.perceiver_name as string) ?? "").trim() || "友達",
        understanding,
        // 知覚タイプ(16)のキャラ画像 = 友達の目に映ったアナタの動物
        imageSrc: characterImagePath(classifySixteenType(otherScores)),
      };
    })
    .sort((a, b) => b.understanding - a.understanding);

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
  // Polish-C: displayName / ownerName は ranking 内で使わなくなったため削除
  // (見出しは「アナタを評価した友達」固定、行内はニックネーム + % のみ)
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

        {/* ===== 相互理解度ランキング (Polish-C) ===== */}
        <section className="mb-8">
          <p className="text-xs font-black text-[#3A2D6B] mb-1">
            アナタを評価した友達
          </p>
          <h2 className="text-[23px] leading-tight font-black text-[#3A2D6B] mb-4">
            相互理解度ランキング
          </h2>

          <div className="bg-white border-[3px] border-[#0094D8] rounded-[28px] p-4">
            <RankingBoard items={rankedPerceptions} />
          </div>
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

// =========================================================================
// Polish-C: 相互理解度ランキング (通常状態 + 空状態スケルトン)
// =========================================================================

interface RankItem {
  id: string;
  perceiverName: string;
  understanding: number;
  imageSrc: string;
}

// 順位バッジ色 (絵文字禁止、円形 div + 数字)。
// 末尾CTAティーザーと統一: 1=sunYellow / 2=skyBlue / 3=vividPink。4位以降は淡いラベンダー。
// 1位は薄黄のため文字は deepPurple (可読性)。
function rankBadgeColors(rank: number): { bg: string; fg: string } {
  if (rank === 1) return { bg: "#FFE993", fg: "#3A2D6B" };
  if (rank === 2) return { bg: "#0094D8", fg: "#FFFFFF" };
  if (rank === 3) return { bg: "#FE3C72", fg: "#FFFFFF" };
  return { bg: "#E4E0F5", fg: "#3A2D6B" }; // lavender (4 以降)
}

function RankBadge({ rank, size = 32 }: { rank: number; size?: number }) {
  const { bg, fg } = rankBadgeColors(rank);
  return (
    <div
      className="flex items-center justify-center rounded-full font-black flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: size >= 32 ? 14 : 12,
      }}
      aria-label={`${rank} 位`}
    >
      {rank}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3A2D6B"
      strokeOpacity="0.4"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// マーカー風ハイライト (黄色背景を行末で切らずに丸める)
const markerClass =
  "bg-[#FFE993] [box-decoration-break:clone] [-webkit-box-decoration-break:clone] px-1";

// ランキング本体: TOP3 固定 + 4位以降は実人数 + 末尾に空き枠 1 つ (参考デザイン移植)。
//   枠数 = max(3, N+1)。rank<=N は実データ、それ以外は空き枠プレースホルダ。
//   - N=0 → 1〜3 すべて空き / N=2 → 1,2 実 + 3 空き / N=3 → 1〜3 実 + 4 空き /
//     N=5 → 1〜5 実 + 6 空き。空き枠が必ず 1 つ以上あるのでプロモ枠は常に表示。
function RankingBoard({ items }: { items: RankItem[] }) {
  const filled = items.length;
  const totalSlots = Math.max(3, filled + 1);
  const ranks = Array.from({ length: totalSlots }, (_, i) => i + 1);
  return (
    <>
      {/* 「ランキングを埋めよう」プロモ枠 (空き枠が 1 つでもある間は表示) */}
      <RankingPromo />
      <ul className="flex flex-col gap-2.5">
        {ranks.map((rank) =>
          rank <= filled ? (
            <RealRankRow key={rank} rank={rank} item={items[rank - 1]} />
          ) : (
            <EmptyRankRow key={rank} rank={rank} />
          ),
        )}
      </ul>
    </>
  );
}

// プロモ枠: もこもこ花アイコン + 2 行コピー (相互理解度の文脈)。点線ボーダー。
function RankingPromo() {
  return (
    <div className="border-2 border-dashed border-[#C9DEF5] rounded-[20px] p-3.5 flex items-center gap-3 mb-3">
      <FeltFlowerIcon />
      <p className="text-sm leading-relaxed text-[#3A2D6B] font-black">
        <span className={markerClass}>たくさん診断してもらって</span>
        <br />
        <span className={markerClass}>ランキングを埋めよう</span>
      </p>
    </div>
  );
}

// 実データ枠 (実線・塗り、タップで各相互理解度ページへ)。
function RealRankRow({ rank, item }: { rank: number; item: RankItem }) {
  return (
    <li>
      <Link
        href={`/evaluate/result/${item.id}`}
        className="flex items-center gap-3 rounded-[20px] border-2 border-[#0094D8]/20 bg-white p-3 transition-colors hover:bg-[#FFF9F0]"
      >
        <RankBadge rank={rank} />
        {/* アバター = 知覚タイプ(16)のキャラ画像 (角丸スクエア・cover) */}
        <div className="w-11 h-11 rounded-[10px] overflow-hidden flex-shrink-0">
          <Image
            src={item.imageSrc}
            alt=""
            width={44}
            height={44}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="flex-1 min-w-0 truncate text-base font-black text-[#3A2D6B]">
          {item.perceiverName}
        </span>
        <span className="bg-[#FFE993] text-[#3A2D6B] font-black rounded-full px-3 py-1 text-sm flex-shrink-0">
          {item.understanding}%
        </span>
        <ChevronRight />
      </Link>
    </li>
  );
}

// 空き枠プレースホルダ (点線・グレー円 + 帯 + ??%、タップ不可)。
function EmptyRankRow({ rank }: { rank: number }) {
  return (
    <li className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-[#C9DEF5] p-3">
      <RankBadge rank={rank} />
      {/* アバター位置: グレーの円 */}
      <div className="w-11 h-11 rounded-full bg-[#ECE9F8] flex-shrink-0" />
      {/* 名前位置: グレーの帯 */}
      <div className="flex-1 min-w-0">
        <div className="h-3.5 w-[55%] rounded-full bg-[#E4E0F5]" />
      </div>
      {/* %位置: 淡い ??% */}
      <span className="bg-[#EDE9F8] text-[#3A2D6B]/45 font-black rounded-full px-3 py-1 text-sm flex-shrink-0">
        ??%
      </span>
    </li>
  );
}

// もこもこ羊毛フェルト風の花アイコン (プロモ枠用、ブランドの花 SVG を一回り大きく)。
function FeltFlowerIcon() {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="flex-shrink-0 drop-shadow-[0_1px_1px_rgba(58,45,107,0.18)]"
    >
      <g fill="#B7A8EC">
        <ellipse cx="12" cy="5" rx="3.4" ry="4.8" />
        <ellipse cx="12" cy="19" rx="3.4" ry="4.8" />
        <ellipse cx="5" cy="12" rx="4.8" ry="3.4" />
        <ellipse cx="19" cy="12" rx="4.8" ry="3.4" />
        <ellipse cx="7" cy="7" rx="3.6" ry="3.6" />
        <ellipse cx="17" cy="7" rx="3.6" ry="3.6" />
        <ellipse cx="7" cy="17" rx="3.6" ry="3.6" />
        <ellipse cx="17" cy="17" rx="3.6" ry="3.6" />
      </g>
      <circle cx="12" cy="12" r="3.8" fill="#FFE07A" />
    </svg>
  );
}
