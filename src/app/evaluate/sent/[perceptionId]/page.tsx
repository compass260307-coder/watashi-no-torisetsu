// Phase 1.5-α Day 12: 友達の評価送信後「遷移ページ」(獲得エンジン)
//
// 役割: 友達 (B) が owner (A=のすけ) の 30 問評価を送信した直後に着地する画面。
// 閲覧者 = 評価した友達 (アナタ)、対象 = 評価された人 (のすけ)。
//
// 本人ページ (/evaluate/result) の ①②③④ を同じ部品・質感で表示し、視点だけ反転する:
//   - 「アナタ」(本人ページ=対象者) → のすけ / 「相手」(=評価者) → 「アナタ」
//     (flipToEvaluatorView / weaveFound の evaluator モード)
//   - 見出し・バーラベルは評価者視点で出し分け
// プライバシー方針変更 (ユーザー承認済み): のすけの自己スコア・ギャップ・関係性も評価者に開示。
//
// 末尾はシンプルな獲得 CTA (評価者自身に診断させる) + 右下フローティング診断 CTA。

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifySixteenType,
  sixteenTypes,
  characterImagePath,
} from "@/lib/sixteen-types";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  topGaps,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { gapDetail, gapDir3 } from "@/lib/perception-gap-detail";
import {
  relationGapNote,
  relationGapFact,
  relationGapTip,
  relationGapTipKey,
} from "@/lib/perception-relation-content";
import {
  perceivedManualContent,
  PERCEIVED_TIPS_KEY,
} from "@/lib/perception-manual-content";
import { getPerceivedContent } from "@/lib/mutual-result-content";
import { weaveFound, seedFromTypeId } from "@/lib/perception-found-text";
import { flipToEvaluatorView } from "@/lib/perception-viewpoint";
// 32タイプ本文 (フラグ on 時のみ・本文だけ32化。型名/画像は16のまま=解釈A)
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import {
  classifyThirtyTwoType,
  perceivedManualFor,
  perceivedContentFor,
  perceivedTipsKeyFor,
  thirtyTwoName,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoOneLiner,
} from "@/lib/thirty-two-types";
import { PERCEPTION_BODY_TEXT_CLASS } from "@/components/result/body-text";
import { CharacterHero } from "@/components/result/CharacterHero";
import { TrisetsuNameTag } from "@/components/result/TrisetsuNameTag";
import { MutualUnderstandingRadar } from "@/components/result/MutualUnderstandingRadar";
import { PerceptionFoundProse } from "@/components/result/PerceptionFoundProse";
import { FloatingDiagnosisCta } from "@/components/result/FloatingDiagnosisCta";
import { ctaPrimary } from "@/components/StickyCtaFooter";
import type { BigFiveDimension } from "@/lib/types";

export const metadata: Metadata = {
  title: "評価を送ったよ",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ perceptionId: string }>;
}

const DIMS: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
const END_CTA_ID = "sent-end-cta";

// owner が自己診断済みか (5 次元すべて数値なら ②④/% を算出可能)
function hasFullSelfScores(s: BigFiveScores): boolean {
  return DIMS.every((d) => typeof s[d] === "number");
}

function mutualLabel(pct: number): string {
  if (pct >= 80) return "かなり息ぴったり。お互いをよく分かり合えてる。";
  if (pct >= 60) return "いい線いってる。だいたい伝わってる相手。";
  if (pct >= 40) return "半分くらい。まだ知らない一面もありそう。";
  return "ギャップ大きめ。意外な発見がたくさんあるかも。";
}

// 丸数字バッジ + 見出し (本人ページと同一マークアップ)
function SectionHead({ num, title }: { num: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white font-black text-lg flex items-center justify-center">
        {num}
      </span>
      <h2 className="text-[#3A2D6B] font-black text-xl leading-tight">
        {title}
      </h2>
    </div>
  );
}

// ② 特性カードのバー (本人ページと同一)
function TraitBar({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-[#3A2D6B] mb-1">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        className="h-3 rounded-full bg-[#E4E0F5] overflow-hidden"
        role="progressbar"
        aria-label={`${label} ${percent}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}

// 本文中の行動キーフレーズ 1 箇所だけを vividPink 太字にする (④ の強調用、本人ページと同一)
function pinkify(text: string, key?: string): ReactNode {
  if (!key) return text;
  const idx = text.indexOf(key);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="text-[#FE3C72] font-black">{key}</strong>
      {text.slice(idx + key.length)}
    </>
  );
}

export default async function EvaluationSentPage({ params }: PageProps) {
  const { perceptionId } = await params;

  // ===== 1. perception 取得 (友達自身の評価) =====
  const { data: perception, error: pErr } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id, target_user_id, perceiver_name, perceived_scores")
    .eq("id", perceptionId)
    .maybeSingle();
  if (pErr) {
    console.error("[/evaluate/sent] perception lookup error:", pErr);
  }
  if (!perception) {
    notFound();
  }

  // ===== 2. owner (= 評価された のすけ) 取得 =====
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("display_name, scores")
    .eq("id", perception.target_user_id)
    .maybeSingle();
  if (!user) {
    notFound();
  }

  const ownerNameRaw = ((user.display_name as string | null) ?? "").trim();
  // のすけ = 対象者。本文の「アナタ」反転先 (素の名前。長くてもそのまま=本人ページ準拠)。
  const targetName = ownerNameRaw || "この人";
  // 評価者 (= 閲覧者、例 Ryunosuke)。ヒーロー1段目「◯◯さんから見た」に使う。
  const perceiverFull = ((perception.perceiver_name as string) ?? "").trim() || "友達";

  // ===== 3. 派生 (本人ページと同一ロジック) =====
  const selfScores = (user.scores ?? {}) as BigFiveScores;
  const otherScores = (perception.perceived_scores ?? {}) as BigFiveScores;
  const showFull = hasFullSelfScores(selfScores); // ②④/% は自己スコア必須
  const gaps = buildDimensionGaps(selfScores, otherScores);
  const mutual = calcMutualUnderstanding(gaps);
  const sortedGaps = topGaps(gaps, 5);

  const perceivedTypeId = classifySixteenType(otherScores);
  const perceivedType16 = sixteenTypes[perceivedTypeId];
  // 解釈B: フラグ on で本文・型名・essence・画像を32化。off=従来16で挙動不変。
  const flag32 = isThirtyTwoEnabled();
  const perceived32Id = classifyThirtyTwoType(otherScores);
  const perceivedTypeName = flag32
    ? thirtyTwoName(perceived32Id)
    : perceivedType16.name;
  const dispEssence = flag32
    ? thirtyTwoEssence(perceived32Id)
    : perceivedType16.essence;
  const dispImage = flag32
    ? thirtyTwoImagePath(perceived32Id)
    : characterImagePath(perceivedTypeId);
  const dispDesc = flag32
    ? thirtyTwoOneLiner(perceived32Id)
    : perceivedType16.oneLiner;

  // ① 本文 (主語省略のため反転はほぼ no-op) / ④ 2段落目 (付き合い方)
  const [lookRaw, tipsRaw] = (
    flag32
      ? perceivedManualFor(perceived32Id)
      : perceivedManualContent[perceivedTypeId]
  ).split("\n\n");
  const perceivedLookBody = flipToEvaluatorView(lookRaw, targetName);
  const perceivedTipsBody = tipsRaw
    ? flipToEvaluatorView(tipsRaw, targetName)
    : "";

  // ③ 強み/あれっ? (評価者視点 weave: {B}さん→アナタ / アナタ→のすけ)
  // ③データ本体のみ32化。weaveFound の typeId(STRENGTH_SCENES=16キー)/seed は16維持。
  const foundContent = flag32
    ? perceivedContentFor(perceived32Id)
    : getPerceivedContent(perceivedTypeId);
  const foundSeed = seedFromTypeId(perceivedTypeId);
  const strengthParas = foundContent
    ? weaveFound(
        foundContent.strengths,
        "strengths",
        foundSeed,
        perceivedTypeId,
        targetName,
      )
    : [];
  const surpriseParas = foundContent
    ? weaveFound(
        foundContent.surprises,
        "surprises",
        foundSeed + 1,
        undefined,
        targetName,
      )
    : [];
  const tipsKey = flag32
    ? perceivedTipsKeyFor(perceived32Id)
    : PERCEIVED_TIPS_KEY[perceivedTypeId];

  // ④ ふたりの関係 (差最大の特性で出し分け、評価者視点に反転)
  const maxGap = sortedGaps[0];
  const maxGapDir = gapDir3(maxGap.selfPercent, maxGap.otherPercent);
  const relationFactBody = flipToEvaluatorView(
    relationGapFact[maxGap.key][maxGapDir],
    targetName,
  );
  const relationGapBody = flipToEvaluatorView(
    relationGapNote[maxGap.key][maxGapDir],
    targetName,
  );
  const relationTipBody = flipToEvaluatorView(
    relationGapTip[maxGap.key][maxGapDir],
    targetName,
  );
  const relationTipKey = relationGapTipKey[maxGap.key][maxGapDir];

  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4">
      <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
        {/* ===== ヘッダー (ロゴ左 + ハンバーガー右、本人ページと同一) =====
            ハンバーガーは myTrisetsuUrl 未指定 → 閲覧者(=評価者)自身の token を
            client で解決 (のすけ本人のものを渡さない)。 */}
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
        </div>

        {/* ===== ヒーロータグ (2段ロゴ風、本人ページと同一) =====
            1段目: 評価者名「◯◯さんから見た」 / 2段目: 対象者「△△のトリセツ」(花/ハート)。
            視点反転: ◯◯=評価者(閲覧者)、△△=対象者(のすけ)。 */}
        <div className="mb-4 flex flex-col items-center">
          <div
            className="wtr-logo-text leading-tight text-center max-w-full px-4 mb-0.5"
            style={{ fontSize: "clamp(13px, 4.2vw, 21px)" }}
          >
            {perceiverFull}さんから見た
          </div>
          <TrisetsuNameTag name={targetName} />
        </div>

        {/* ===== ヒーロー (知覚タイプのキャラ、本人ページと同一構成) ===== */}
        <CharacterHero
          imageSrc={dispImage}
          alt={dispEssence}
          essence={dispEssence}
          name={perceivedTypeName}
          description={dispDesc}
        />

        {/* ===== ① アナタから見た のすけ (相互理解度% + 本文) ===== */}
        <section className="mb-8">
          <SectionHead num={1} title={`アナタから見た${targetName}`} />
          <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
            {showFull && (
              <>
                <div className="text-center">
                  <p className="text-[#FE3C72] font-bold text-sm mb-1">
                    相互理解度
                  </p>
                  <p className="text-[#3A2D6B] font-black text-6xl leading-none drop-shadow-[0_2px_0_rgba(255,233,147,0.6)]">
                    {mutual}
                    <span className="text-3xl">%</span>
                  </p>
                  <div
                    className="mt-3 h-3 rounded-full bg-[#E4E0F5] overflow-hidden"
                    role="progressbar"
                    aria-label={`相互理解度 ${mutual}%`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={mutual}
                  >
                    <div
                      className="h-full rounded-full bg-[#FE3C72]"
                      style={{ width: `${mutual}%` }}
                    />
                  </div>
                  <p className="text-[#3A2D6B]/75 text-xs font-bold mt-2 leading-relaxed">
                    {mutualLabel(mutual)}
                  </p>
                </div>
                <div className="border-t border-dashed border-[#3A2D6B]/15 my-5" />
              </>
            )}
            <p className={PERCEPTION_BODY_TEXT_CLASS}>{perceivedLookBody}</p>
          </div>
        </section>

        {/* ===== ② のすけ とのギャップ (自己スコア必須なので showFull のみ) ===== */}
        {showFull && (
          <section className="mb-8">
            <SectionHead num={2} title={`${targetName}とのギャップ`} />
            <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
              <MutualUnderstandingRadar
                gaps={gaps}
                selfLabel={`${targetName}自身`}
                otherLabel="アナタから"
              />
              {sortedGaps.map((g, idx) => {
                const dir = gapDir3(g.selfPercent, g.otherPercent);
                const d = gapDetail[g.key][dir];
                const detail = flipToEvaluatorView(
                  idx < 2 ? d.full : d.short,
                  targetName,
                );
                return (
                  <div key={g.key}>
                    {idx === 2 && (
                      <div className="border-t border-dashed border-[#3A2D6B]/25 mt-6 pt-5">
                        <p className="text-[#3A2D6B]/55 font-bold text-xs mb-1">
                          そのほかの3つ
                        </p>
                      </div>
                    )}
                    {idx !== 2 && (
                      <div className="border-t border-[#3A2D6B]/10 my-5" />
                    )}
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="text-[#3A2D6B] font-black text-base">
                        {g.label}
                      </h3>
                      <span className="text-[#FE3C72] font-black text-xs">
                        差 {g.diffPoints}pt
                      </span>
                    </div>
                    <div className="space-y-2 mb-3">
                      <TraitBar
                        label={`${targetName}自身`}
                        percent={g.selfPercent}
                        color="#FE3C72"
                      />
                      <TraitBar
                        label="アナタから"
                        percent={g.otherPercent}
                        color="#0094D8"
                      />
                    </div>
                    <p className={PERCEPTION_BODY_TEXT_CLASS}>{detail}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== ③ アナタが見つけた のすけ (強み3 + あれっ?3) ===== */}
        {foundContent && (
          <section className="mb-8">
            <SectionHead num={3} title={`アナタが見つけた${targetName}`} />
            <PerceptionFoundProse
              perceiverName="アナタ"
              strengthLabel="アナタが見つけた強み"
              surpriseLabel="アナタが感じた「あれっ?」"
              strengthParas={strengthParas}
              surpriseParas={surpriseParas}
            />
          </section>
        )}

        {/* ===== ④ ふたりの関係 (自己スコア必須なので showFull のみ) ===== */}
        {showFull && (
          <section className="mb-8">
            <SectionHead num={4} title="ふたりの関係" />
            <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
              <p className={`${PERCEPTION_BODY_TEXT_CLASS} mb-4`}>
                {relationFactBody}
              </p>
              <p className={`${PERCEPTION_BODY_TEXT_CLASS} mb-4`}>
                {relationGapBody}
              </p>
              {perceivedTipsBody && (
                <p className={`${PERCEPTION_BODY_TEXT_CLASS} mb-4`}>
                  {pinkify(perceivedTipsBody, tipsKey)}
                </p>
              )}
              <p className={PERCEPTION_BODY_TEXT_CLASS}>
                {pinkify(relationTipBody, relationTipKey)}
              </p>
            </div>
          </section>
        )}

        {/* ===== 末尾CTA (ボタン1個のみ・枠/見出し/注記なし・背景に直接) ===== */}
        <div id={END_CTA_ID} className="flex justify-center pt-1 pb-2">
          <Link href="/diagnosis" className={ctaPrimary}>
            自分のトリセツを生成 →
          </Link>
        </div>
      </div>

      {/* ===== 右下フローティング診断 CTA (末尾CTAが見えたら隠す) ===== */}
      <FloatingDiagnosisCta href="/diagnosis" hideWhenId={END_CTA_ID} />
    </main>
  );
}
