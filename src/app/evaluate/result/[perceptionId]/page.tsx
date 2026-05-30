// Phase 1.5-α Day 12-C1: 友達評価結果ページ (軸2 のメイン画面)
//
// 役割: 友達 (B) が A に対して 30 問の評価を完了した後、その場で B と A が
// 一緒に見るための画面。6 章構成 + freemium (¥500 で解除)。
//
// Server Component:
//   - perception (friend_perceptions) 取得
//   - target user (= A) 取得して自己 Big Five と displayName を確保
//   - session で isOwner 判定 (¥500 ロック解除カードは Owner のみに見せる)
//   - 相互理解度 % + 5 次元ギャップを派生して描画
//   - 6 章は EvaluationChapters に委譲 (本文プレースホルダー、Day 12-D で実データ)
//
// Day 12-C1 スコープ (今回):
//   - レイアウト + レーダー + 相互理解度 + 6 章 + ロック表示 + バイラル誘導
//   - Stripe 接続は未 (Day 12-C2)。?unlocked=1 で全章プレビュー可能 (UI 確認用)
//   - 章本文は EvaluationChapters 内のプレースホルダー (Day 12-D)
//
// 触らない:
//   - friend_perceptions / users / payment_history のスキーマ
//   - /api/friend-answer/v2 (既に perceived_scores を保存している、Day 12-B 調査済)
//   - /me/[token] の本体構造 (Day 11.x 完成、本 PR では perceptions リンク追加のみ)
//   - LP / /diagnosis / /friend-evaluation の構造

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { MutualUnderstandingRadar } from "@/components/result/MutualUnderstandingRadar";
import { EvaluationChapters } from "@/components/result/EvaluationChapters";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  topGaps,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import type { TorisetsuTypeId } from "@/lib/types";

export const metadata: Metadata = {
  title: "友達評価の結果",
  // perception id は推測困難だが、誤共有時の漏洩経路を絞るため noindex
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ perceptionId: string }>;
  searchParams: Promise<{ unlocked?: string }>;
}

// 名前が長い場合の省略 (UI 崩れ防止、8 文字 + 「…」)
function shortenName(name: string): string {
  return name.length > 8 ? name.slice(0, 8) + "…" : name;
}

export default async function EvaluationResultPage({
  params,
  searchParams,
}: PageProps) {
  const { perceptionId } = await params;
  const sp = await searchParams;
  // Day 12-C1: Stripe 接続前の UI 確認用、?unlocked=1 で全章解除表示。
  // Day 12-C2 で payment_history からの本判定に置き換える。
  const unlocked = sp.unlocked === "1";

  // ===== 1. perception 取得 =====
  const { data: perception, error: pErr } = await supabaseAdmin
    .from("friend_perceptions")
    .select(
      "id, target_user_id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, perceived_scores, perceived_facet_scores, qualitative_data, created_at",
    )
    .eq("id", perceptionId)
    .maybeSingle();
  if (pErr) {
    console.error("[/evaluate/result] perception lookup error:", pErr);
  }
  if (!perception) {
    notFound();
  }

  // ===== 2. target user (= 評価された A) 取得 =====
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, type_id, scores, display_name, owner_token")
    .eq("id", perception.target_user_id)
    .maybeSingle();
  if (!user) {
    notFound();
  }

  // ===== 3. session で isOwner 判定 (Owner = A 本人) =====
  const session = await getSession();
  const isOwner = !!session && session.id === (user.id as string);

  // ===== 4. 派生計算 =====
  const selfScores = (user.scores ?? {}) as BigFiveScores;
  const otherScores = (perception.perceived_scores ?? {}) as BigFiveScores;
  const gaps = buildDimensionGaps(selfScores, otherScores);
  const mutual = calcMutualUnderstanding(gaps);
  const topGapList = topGaps(gaps, 3);

  const ownerName = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerName || "アナタ";
  const perceiverFull = (perception.perceiver_name as string) ?? "友達";
  const perceiverShort = shortenName(perceiverFull);
  const myTrisetsuUrl = `/me/${user.owner_token as string}`;

  // 評価結果に書かれている型 (B から見た A のタイプ)、副情報として表示
  const perceivedTypeName =
    torisetsuTypes[perception.perceived_type_id as TorisetsuTypeId]?.name ??
    (perception.perceived_type_id as string);
  const perceivedFullCode =
    (perception.perceived_full_code as string | null) ?? "";

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
        <div className="flex justify-center mb-4">
          <div className="bg-[#FFE993] text-[#3A2D6B] font-black px-5 py-2 rounded-full border-2 border-[#3A2D6B] shadow-md -rotate-2 text-base">
            {perceiverShort}さんから見た{displayName}
          </div>
        </div>

        {/* ===== B から見たアナタのタイプ (副情報) ===== */}
        {perceivedFullCode && (
          <div className="text-center mb-6">
            <p className="text-[#FE3C72] font-bold text-sm mb-1">
              {perceiverShort}が見た{displayName}は
            </p>
            <h1 className="text-[#3A2D6B] font-black text-2xl mb-2 leading-tight">
              {perceivedTypeName}
            </h1>
            <span className="inline-block bg-[#3A2D6B] text-white font-black text-xs px-3 py-1 rounded-full tracking-[0.25em]">
              {perceivedFullCode}
            </span>
          </div>
        )}

        {/* ===== 相互理解度 ===== */}
        <div className="text-center mb-6">
          <p className="text-[#FE3C72] font-bold text-sm mb-1">相互理解度</p>
          <p className="text-[#3A2D6B] font-black text-6xl leading-none drop-shadow-[0_2px_0_rgba(255,233,147,0.6)]">
            {mutual}
            <span className="text-3xl">%</span>
          </p>
        </div>

        {/* ===== レーダーチャート ===== */}
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-8">
          <MutualUnderstandingRadar
            gaps={gaps}
            selfLabel={`${displayName}自身`}
            otherLabel={`${perceiverShort}から`}
          />
        </div>

        {/* ===== 6 章レイアウト ===== */}
        <EvaluationChapters
          gaps={gaps}
          topGapList={topGapList}
          displayName={displayName}
          perceiverShort={perceiverShort}
          unlocked={unlocked}
        />

        {/* ===== ロック解除カード (Owner かつ 未 unlock のみ) =====
            Day 12-C1 では disabled。Day 12-C2 で Stripe Checkout に接続。 */}
        {isOwner && !unlocked && (
          <div className="bg-gradient-to-b from-[#FFE993]/40 to-[#BCDEF8]/30 rounded-3xl border-2 border-[#3A2D6B] shadow-md p-6 mb-8 text-center">
            <p className="text-[#3A2D6B]/60 font-black text-xs tracking-[0.3em] mb-2">
              UNLOCK
            </p>
            <h2 className="text-[#3A2D6B] font-black text-xl mb-3 leading-tight">
              今すぐ全部のロックを解除
            </h2>
            <p className="text-[#3A2D6B]/75 text-sm leading-relaxed mb-5">
              {perceiverShort}の本音、4 特性、関係性アドバイス、取扱説明書。
              <br />
              全部読めます。
            </p>
            <button
              type="button"
              disabled
              className="inline-block bg-[#FFE993] text-[#3A2D6B]/40 font-black text-base px-10 py-4 rounded-full border-2 border-[#3A2D6B]/30 cursor-not-allowed"
              aria-label="¥500 で解除 (Day 12-C2 で Stripe 接続予定)"
            >
              ¥500 で今すぐ解除
            </button>
            <p className="text-[#3A2D6B]/50 text-[10px] font-bold mt-3">
              Stripe Checkout 接続は Day 12-C2 にて
            </p>
          </div>
        )}

        {/* ===== バイラル誘導 ===== */}
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-6 text-center">
          <h2 className="text-[#3A2D6B] font-black text-base mb-2">
            {perceiverShort}さんも、自分のトリセツ作ってみない？
          </h2>
          <p className="text-[#3A2D6B]/75 text-xs leading-relaxed mb-4">
            50 問・約 3 分の自己診断、登録不要、無料。
          </p>
          <Link
            href="/diagnosis"
            className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black text-sm px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
          >
            無料で診断する →
          </Link>
        </div>

        {/* ===== Footer ===== */}
        <div className="text-center pt-2 pb-2">
          <Link
            href={myTrisetsuUrl}
            className="text-[#3A2D6B]/60 font-bold text-sm underline hover:text-[#FE3C72] transition-colors"
          >
            {displayName}のトリセツに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
