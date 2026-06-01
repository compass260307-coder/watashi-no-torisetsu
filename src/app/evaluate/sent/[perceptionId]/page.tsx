// Phase 1.5-α Day 12-Polish-F: 友達の評価送信後「遷移ページ」(獲得エンジン)
//
// 役割: 友達 (B) が owner (A) の 30 問評価を送信した直後に着地する画面。
// 完了画面廃止 (Day 12-C3) 後の着地先を、評価者 → 新規ユーザー化の獲得エンジン
// として設計し直したもの。post-submit の router.push 先 (friend/[inviteCode])
// をこのルートへ置き換えている。
//
// 無料で見せる:
//   ①「{owner}理解度」%  (calcMutualUnderstanding、owner ランキングと同一値)
//   ② アナタの目に映る {owner} (友達自身の知覚プロファイルを整形して返す)
// 見せない ({owner} 本人限定・課金。/evaluate/result 側に集約):
//   {owner} の自己診断スコア・自己 vs 友達の詳細ギャップ・関係性アドバイス
// → 友達には満足感のある報酬とデモを返しつつ、課金の壁と owner のプライバシーは
//    一切崩さない。
//
// 触らない: friend_perceptions / users スキーマ、決済、トラッキング。
//   ここでは SELECT して表示するだけ。

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { ctaPrimary } from "@/components/StickyCtaFooter";
import type { BigFiveDimension, TorisetsuTypeId } from "@/lib/types";

export const metadata: Metadata = {
  title: "評価を送ったよ",
  // 個人の着地ページ。誤共有時の漏洩経路を絞るため noindex
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ perceptionId: string }>;
}

const DIMS: BigFiveDimension[] = ["E", "A", "O", "C", "N"];

// owner が自己診断済みか (5 次元すべて数値であれば算出可能)
function hasFullSelfScores(s: BigFiveScores): boolean {
  return DIMS.every((d) => typeof s[d] === "number");
}

// 名前が長い場合の省略 (UI 崩れ防止、8 文字 + 「…」)
function shortenName(name: string): string {
  return name.length > 8 ? name.slice(0, 8) + "…" : name;
}

// %帯コメント (すべて前向き・煽らない)
function understandingComment(pct: number): string {
  if (pct >= 80) return "かなり分かってる方かも!";
  if (pct >= 60) return "けっこう分かってる!";
  return "意外な一面があるのかも?";
}

export default async function EvaluationSentPage({ params }: PageProps) {
  const { perceptionId } = await params;

  // ===== 1. perception 取得 (友達自身の評価。SELECT のみ) =====
  const { data: perception, error: pErr } = await supabaseAdmin
    .from("friend_perceptions")
    .select(
      "id, target_user_id, perceiver_name, perceived_type_id, perceived_scores",
    )
    .eq("id", perceptionId)
    .maybeSingle();
  if (pErr) {
    console.error("[/evaluate/sent] perception lookup error:", pErr);
  }
  if (!perception) {
    notFound();
  }

  // ===== 2. owner (= 評価された A) 取得 =====
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("display_name, scores")
    .eq("id", perception.target_user_id)
    .maybeSingle();
  if (!user) {
    notFound();
  }

  const ownerNameRaw = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerNameRaw || "この人";
  const avatarChar = (ownerNameRaw || "?").slice(0, 1);

  // ===== 3. 理解度算出 (owner の自己診断がある場合のみ) =====
  const selfScores = (user.scores ?? {}) as BigFiveScores;
  const otherScores = (perception.perceived_scores ?? {}) as BigFiveScores;
  const showUnderstanding = hasFullSelfScores(selfScores);
  // owner ランキング / 評価結果ページと同一ロジック・同一値
  const mutual = showUnderstanding
    ? calcMutualUnderstanding(buildDimensionGaps(selfScores, otherScores))
    : 0;

  // ===== 4. アナタの目に映る owner (友達自身の知覚プロファイル) =====
  const perceivedType =
    torisetsuTypes[perception.perceived_type_id as TorisetsuTypeId];
  const perceivedTypeName =
    perceivedType?.name ?? (perception.perceived_type_id as string);
  const traits = (perceivedType?.traits ?? []).slice(0, 3);

  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4">
      <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
        {/* ===== ロゴ ===== */}
        <div className="flex justify-center mb-4">
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
        </div>

        {/* ===== 1. 完了お礼 (軽く) ===== */}
        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="/mascot/step3-complete.png"
            alt=""
            width={160}
            height={160}
            className="w-24 h-24 object-contain mb-3"
          />
          <p className="text-[#3A2D6B] font-black text-base leading-relaxed">
            評価を{displayName}さんに送ったよ。
            <br />
            ありがとう!
          </p>
        </div>

        {/* ===== 2. 報酬: 理解度 (主役) =====
            owner の自己診断が無い稀ケースでは算出できないため非表示 (3・4 のみ)。 */}
        {showUnderstanding && (
          <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-6">
            <p className="text-center text-[#FE3C72] font-bold text-sm mb-1">
              アナタの「{displayName}理解度」
            </p>
            <p className="text-center text-[#3A2D6B] font-black text-5xl leading-none mb-4 drop-shadow-[0_2px_0_rgba(255,233,147,0.6)]">
              {mutual}
              <span className="text-2xl">%</span>
            </p>
            {/* バー: lavender トラック + vividPink 塗り (解析画面 E-1 と同配色) */}
            <div className="h-4 rounded-full bg-[#E4E0F5] overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-[#FE3C72]"
                style={{ width: `${mutual}%` }}
              />
            </div>
            <p className="text-center text-[#3A2D6B] font-bold text-sm">
              {understandingComment(mutual)}
            </p>
          </div>
        )}

        {/* ===== 3. 報酬: アナタの目に映る owner (友達自身の評価の整形版) ===== */}
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-6">
          <p className="text-center text-[#FE3C72] font-bold text-sm mb-4">
            アナタの目に映る{displayName}
          </p>
          <div className="flex flex-col items-center">
            {/* アバター (丸・プレースホルダー) */}
            <div className="w-20 h-20 rounded-full bg-[#E4E0F5] border-2 border-[#3A2D6B] flex items-center justify-center mb-3">
              <span className="text-[#3A2D6B] font-black text-2xl">
                {avatarChar}
              </span>
            </div>
            <h2 className="text-[#3A2D6B] font-black text-xl mb-3 text-center leading-tight">
              {perceivedTypeName}
            </h2>
            {traits.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {traits.map((t, i) => (
                  <span
                    key={t}
                    className={
                      i % 2 === 0
                        ? "bg-[#FFE993] text-[#3A2D6B] font-bold text-xs px-4 py-1.5 rounded-full border border-[#3A2D6B]/25"
                        : "bg-[#E4E0F5] text-[#3A2D6B] font-bold text-xs px-4 py-1.5 rounded-full border border-[#0094D8]/30"
                    }
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* 小注記 (無料 / 課金の線引きを兼ねる) */}
          <p className="text-center text-[#3A2D6B]/60 text-xs leading-relaxed">
            これはアナタの見方。{displayName}本人の自己診断とのギャップは、
            {displayName}さんだけが見られるよ。
          </p>
        </div>

        {/* ===== 4. 転換 CTA (獲得) ===== */}
        <div className="bg-gradient-to-b from-[#FFE993]/40 to-[#BCDEF8]/30 rounded-3xl border-2 border-[#3A2D6B] shadow-md p-6 mb-2 text-center">
          <h2 className="text-[#3A2D6B] font-black text-lg mb-2 leading-tight">
            じゃあ逆に、{displayName}からアナタはどう見えてる?
          </h2>
          <p className="text-[#3A2D6B]/75 text-sm leading-relaxed mb-5">
            アナタも診断すれば、自分のトリセツも、{displayName}との相互理解度も分かるよ。
          </p>
          <div className="flex justify-center">
            <Link href="/diagnosis" className={ctaPrimary}>
              アナタも無料で診断する →
            </Link>
          </div>
          <p className="text-[#3A2D6B]/50 text-[10px] font-bold mt-3">
            登録不要・約3分・無料
          </p>
        </div>
      </div>
    </main>
  );
}
