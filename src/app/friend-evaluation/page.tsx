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
// 解釈B: フラグ on でランキングのキャラ画像を32化 (off=従来16)
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import {
  classifyThirtyTwoType,
  thirtyTwoImagePath,
} from "@/lib/thirty-two-types";
import { FriendGapInvite } from "@/components/result/FriendGapInvite";
import { RankMedalBadge } from "@/components/result/RankMedalBadge";
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
        // 知覚タイプのキャラ画像 = 友達の目に映ったアナタの動物。on=32 / off=従来16。
        imageSrc: isThirtyTwoEnabled()
          ? thirtyTwoImagePath(classifyThirtyTwoType(otherScores))
          : characterImagePath(classifySixteenType(otherScores)),
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

        {/* ===== 相互理解度ランキング (見出し2つは撤去・カード本体のみ) =====
            「アナタを評価した友達」「相互理解度ランキング」の見出しを削除し、上の
            QR+キャラコードからプロモ枠ロゴへ自然につなぐ。aria-label で意味は保持。 */}
        <section className="mb-8" aria-label="相互理解度ランキング">
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

// プロモ枠: 生成ロゴ画像 (羊毛フェルト風・透過2行+花、/heading-ranking-promo.png) を
// next/image で表示。点線ボーダーは維持し、誘導枠なので末尾CTAロゴより小さめに収める。
function RankingPromo() {
  return (
    // -mx-3 でカードの内パディングへ少し広げ、内側 px-2 で点線枠との余白を残しつつ拡大。
    <div className="border-2 border-dashed border-[#C9DEF5] rounded-[20px] -mx-3 px-2 py-3 mb-3 flex justify-center">
      <Image
        src="/heading-ranking-promo.png"
        alt="たくさん診断してもらってランキングを埋めよう"
        width={2129}
        height={628}
        className="w-full max-w-[320px] h-auto"
      />
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
        <RankMedalBadge rank={rank} />
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
      <RankMedalBadge rank={rank} />
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
