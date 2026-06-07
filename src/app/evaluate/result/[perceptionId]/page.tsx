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
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import {
  classifySixteenType,
  sixteenTypes,
  characterImagePath,
} from "@/lib/sixteen-types";
import { CharacterHero } from "@/components/result/CharacterHero";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { MutualUnderstandingRadar } from "@/components/result/MutualUnderstandingRadar";
import { EvaluationChapters } from "@/components/result/EvaluationChapters";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  topGaps,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { isPerceptionUnlocked } from "@/lib/perception-unlock";
import { UnlockCard } from "@/components/result/UnlockCard";
import { UnlockConfirming } from "@/components/result/UnlockConfirming";

export const metadata: Metadata = {
  title: "友達評価の結果",
  // perception id は推測困難だが、誤共有時の漏洩経路を絞るため noindex
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ perceptionId: string }>;
  searchParams: Promise<{ unlocked?: string; checkout?: string }>;
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
  // Day 12-C2: payment_history からの本判定 + ?unlocked=1 は開発時 override として残す。
  // - 本判定: isPerceptionUnlocked() が payment_history を SELECT
  //   (status='completed' AND payment_kind='perception_unlock')
  // - ?unlocked=1 は QA / UI 確認用 (本番でも誰でも付けられるが、
  //   ロック解除ボタンが消える程度の影響なので脅威評価は無視可)
  const devOverride = sp.unlocked === "1";
  const paidUnlocked = await isPerceptionUnlocked(perceptionId);
  const unlocked = paidUnlocked || devOverride;
  // ¥500 決済直後の戻り (success_url)。Webhook 反映前なら「解除確認中」を出す。
  const justPaid = sp.checkout === "success";

  // ===== 1. perception 取得 (owner 自己診断スコアは含まない) =====
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

  // ===== 2. owner ゲート (Polish-H: プライバシー穴塞ぎ) =====
  // このページは owner (= 評価された本人 A) の自己診断スコア (レーダー/バー) を
  // 表示するため、owner 本人だけに見せる。owner 識別は cookie ベース session
  // (wn_session, httpOnly, server-readable) で判定する。
  //
  // フェイルクローズ: session 不在 / session.id が perception.target_user_id と
  // 一致しない (= 評価した友達や第三者、判定不可) 場合はすべて非 owner 扱いとし、
  // owner の自己スコアを「取得する前に」/evaluate/sent (友達セーフ版) へリダイレクト。
  // これにより非 owner の端末へ自己診断スコアが一切送信されない。
  const session = await getSession();
  const isOwner =
    !!session && session.id === (perception.target_user_id as string);
  if (!isOwner) {
    redirect(`/evaluate/sent/${perceptionId}`);
  }

  // ===== 3. target user (= 評価された A) 取得 (owner 確定後にのみ self scores を取得) =====
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, type_id, scores, display_name, owner_token")
    .eq("id", perception.target_user_id)
    .maybeSingle();
  if (!user) {
    notFound();
  }

  // ===== 3.5 決済直後の解除確認 (Webhook 反映待ち) =====
  // success_url から ?checkout=success で戻った直後、まだ payment_history が
  // 反映されていない (unlocked=false) 場合は、解除済みコンテンツを描く前に
  // 「解除を確認中」を表示し、反映後に自動で解除済みページへ着地させる。
  if (justPaid && !unlocked) {
    return (
      <UnlockConfirming myTrisetsuUrl={`/me/${user.owner_token as string}`} />
    );
  }

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

  // Day 12-D: 知覚16タイプ / owner16タイプを perceived_scores / users.scores から派生。
  // 既存の 8 タイプ (perceived_type_id) は温存し、表示・本文の出し分けは 16 タイプで行う。
  const perceivedTypeId = classifySixteenType(otherScores);
  const ownerTypeId = classifySixteenType(selfScores);
  const perceivedType16 = sixteenTypes[perceivedTypeId];
  // B から見た A のタイプ (16タイプ名)、ヒーローで表示
  const perceivedTypeName = perceivedType16.name;

  // おまけ3問 (好きなところ / 動物にたとえると / 印象的なシーン)。
  // /me から表示を移設 (詳細ページに集約)。無回答キーは除外。
  const qualitative =
    (perception.qualitative_data as Record<string, string> | null) ?? null;
  const qualEntries = (
    [
      { label: "好きなところ", value: qualitative?.favorite_point },
      { label: "動物にたとえると", value: qualitative?.animal },
      { label: "印象的なシーン", value: qualitative?.impression_scene },
    ] as const
  ).filter((e) => typeof e.value === "string" && e.value.trim().length > 0);

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

        {/* ===== B から見たアナタのタイプ (16タイプ・ヒーロー、丸枠キャラ + 同タイポ) ===== */}
        <CharacterHero
          imageSrc={characterImagePath(perceivedTypeId)}
          alt={perceivedTypeName}
          eyebrow={`${perceiverShort}が見た${displayName}は`}
          essence={perceivedType16.essence}
          name={perceivedTypeName}
          description={perceivedType16.oneLiner}
        />

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

        {/* ===== おまけ3問 (/me から移設、無料) ===== */}
        {qualEntries.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-8">
            <p className="text-[#FE3C72] font-bold text-sm mb-3 text-center">
              {perceiverShort}さんからのメッセージ
            </p>
            <ul className="flex flex-col gap-3">
              {qualEntries.map((e) => (
                <li key={e.label}>
                  <p className="text-[#3A2D6B]/60 font-bold text-xs mb-0.5">
                    {e.label}
                  </p>
                  <p className="text-[#3A2D6B] text-sm leading-relaxed">
                    {e.value}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ===== 6 章レイアウト ===== */}
        <EvaluationChapters
          gaps={gaps}
          topGapList={topGapList}
          displayName={displayName}
          perceiverShort={perceiverShort}
          unlocked={unlocked}
          perceptionId={perceptionId}
          isOwner={isOwner}
          perceivedScores={otherScores}
          perceivedTypeId={perceivedTypeId}
          ownerTypeId={ownerTypeId}
        />

        {/* ===== メイン解除カード (Owner かつ未 unlock のみ) =====
            Day 12-Polish-G: 16P 構造の共通 <UnlockCard> に置き換え。
            決済フロー (create-perception-unlock-session) は不変、コピーのみ評価結果用。
            paidUnlocked が true の場合はこのカード自体が非表示 (unlocked=true)。 */}
        {isOwner && !unlocked && (
          <UnlockCard
            perceptionId={perceptionId}
            heading={`${perceiverShort}さんから見た『本当のアナタ』のすべてを解放`}
            body={`いま見えている『ズレ』は、ほんの入り口。${perceiverShort}さんの目に映るアナタを、本音もアドバイスもまとめて全部読めます。`}
            // 箇条書きは実際の有料解除対象に一致させる (章② 強みは「全無料」のため
            // 「相手が見た強み」の行は外し、有料の本音＋4特性に差し替え)。
            bullets={[
              {
                lead: 'ズレを縮める"次の一歩"',
                detail: "見え方の差を、こじれる前に埋める具体アドバイス。",
              },
              {
                lead: "隠れた本音と4つの特性",
                detail: `${perceiverShort}さんにだけ見えている、表に出さない一面の深掘り。`,
              },
              {
                lead: "アナタ専用の取扱説明書",
                detail: `${perceiverShort}さんとうまく付き合うための関係ガイド。`,
              },
            ]}
            reassurance={`この${perceiverShort}さんの評価結果だけ・一度の決済で解除`}
          />
        )}

        {/* ===== バイラル誘導 (perceiver = 評価した友達 へのインバイト) =====
            Polish-E E-4: isOwner には不要 (本人は既にトリセツを持っている)。
            evaluator 視点で表示するため !isOwner でゲート。 */}
        {!isOwner && (
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
        )}

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
