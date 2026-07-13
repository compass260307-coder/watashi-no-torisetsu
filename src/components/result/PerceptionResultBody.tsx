// 相互理解ページの共有ボディ (ヒーロー + 各セクション)。
// 評価者完了ページ (/evaluate/result) と本人向け個別ページ (/tako/[token]/friend/[perceptionId])
// で共有。派生データは buildPerceptionView() (lib/perception-view.ts) で作って渡す。
// 差分はフラグで出し分け:
//   - variant "evaluate": ①相互理解度+本文 → ②ギャップ → ◇メッセージ(小) → ③見つけたアナタ → ④関係
//   - variant "individual": ①相互理解度+位置づけ+本文 → ②ギャップ → ③贈りもの(主役級) → ④関係
// スコア/タイプ/ギャップ計算・本文プローズは不変 (見た目と構成の出し分けのみ)。
//
// タイポスケール: 個別ページ (isIndividual) は本人がじっくり読む画面なので全体を一回り
// 大きく (階層は保ったまま各段を1ステップ上げ、余白/行間も連動)。評価者ページ (evaluate)
// は従来サイズのまま (各三項の false 側が従来値)。

import type { ReactNode } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { ResultHero } from "./ResultHero";
import { TrisetsuNameTag } from "./TrisetsuNameTag";
import { MutualUnderstandingRadar } from "./MutualUnderstandingRadar";
import { BigFiveDivergingBars } from "./BigFiveDivergingBars";
import { PerceptionMessageCard } from "./PerceptionMessageCard";
import { PerceptionFoundProse } from "./PerceptionFoundProse";
import { PERCEPTION_BODY_TEXT_CLASS } from "./body-text";
import { sceneImageForGroup } from "@/lib/character-image";
import { gapDetail, gapDir3 } from "@/lib/perception-gap-detail";
import type { PerceptionView } from "@/lib/perception-view";
import type { BigFiveScores } from "@/lib/perception-analysis";

function mutualLabel(pct: number): string {
  if (pct >= 80) return "かなり息ぴったり。お互いをよく分かり合えてる。";
  if (pct >= 60) return "いい線いってる。だいたい伝わってる相手。";
  if (pct >= 40) return "半分くらい。まだ知らない一面もありそう。";
  return "ギャップ大きめ。意外な発見がたくさんあるかも。";
}

function SectionHead({
  num,
  title,
  large,
}: {
  num: number;
  title: string;
  large?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${large ? "mb-5" : "mb-4"}`}>
      <span
        aria-hidden="true"
        className={`flex flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] font-black text-[#2E2E5C] ${
          large ? "h-11 w-11 text-xl" : "h-10 w-10 text-lg"
        }`}
      >
        {num}
      </span>
      <h2
        className={`text-[#2E2E5C] font-black leading-tight ${
          large ? "text-[28px]" : "text-2xl"
        }`}
      >
        {title}
      </h2>
    </div>
  );
}

// 本文中の行動キーフレーズ 1 箇所だけを vividPink 太字にする (④ の強調用)。
function pinkify(text: string, key?: string) {
  if (!key) return text;
  const idx = text.indexOf(key);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="text-[#5B5BEF] font-black">{key}</strong>
      {text.slice(idx + key.length)}
    </>
  );
}

interface PerceptionResultBodyProps {
  view: PerceptionView;
  selfScores: BigFiveScores;
  otherScores: BigFiveScores;
  /** "evaluate" = 評価者完了ページ / "individual" = 本人向け個別ページ */
  variant: "evaluate" | "individual";
  /** 個別ページ: 位置づけ一言 (相互理解度の下)。例「4人の中で一番高い」 */
  rankNote?: string;
  /** 個別ページ: その友達のひとことメッセージ (owner_message)。主役級に表示。 */
  ownerMessage?: string;
  /** 本人の二人称 ("アナタ" / "あなた")。個別ページは「あなた」。 */
  youWord?: string;
  /** 末尾に差し込むノード (フッター戻りリンク等・ページ側で用意)。 */
  footer?: ReactNode;
}

export function PerceptionResultBody({
  view,
  selfScores,
  otherScores,
  variant,
  rankNote,
  ownerMessage,
  youWord = "アナタ",
  footer,
}: PerceptionResultBodyProps) {
  const isIndividual = variant === "individual";
  const p = view.perceiverFull;
  const trimmedOwnerMessage = (ownerMessage ?? "").trim();

  // 個別ページの一回り拡大スケール (L=large)。false=評価者ページ従来値。
  const L = isIndividual;
  const cardCls = `bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md ${
    L ? "p-7" : "p-6"
  }`;
  // ①相互理解度・②ギャップは、個別ページでは外枠(border/カード背景/shadow)を外して
  // 地の白に溶け込ませる (中身=数値・バー・ラベルはそのまま)。padding も外して
  // 見出し直下に中身を流す。評価者ページ(evaluate)は従来どおりカード枠を維持。
  // ※③贈りものカードは対象外 (cardCls のまま枠を残す)。
  const panelCls = L ? "" : cardCls;
  const bodyCls = L
    ? "body-gothic text-[#1A1A1A] font-normal text-[19px] leading-[1.55]"
    : PERCEPTION_BODY_TEXT_CLASS;
  const sectionCls = L ? "mb-10" : "mb-8";
  // 個別ページのみ: ①(相互理解度)と②(ギャップ)の間に、その友達が見たタイプのグループ別
  // 挿絵を1枚。相互理解度の後・分析の前に、その友達視点のグループをビジュアルで伝える。
  // アセットが無ければ null → 非表示 (安全)。
  const bodySceneSrc = isIndividual
    ? sceneImageForGroup(view.perceivedGroup, "normal1")
    : null;

  return (
    <>
      {/* ===== ヒーロー (ResultHero 色帯 + 透過キャラ) ===== */}
      <div className="mb-2 flex justify-center">
        <TrisetsuNameTag name={view.displayName} />
      </div>
      <ResultHero
        label={`${p}さんから見た`}
        essence={view.dispEssence}
        scores={otherScores}
        heroBg={view.heroBg}
        codeTint={view.codeTint}
        imageSrc={view.dispImageCut}
        alt={view.dispEssence}
        name={view.perceivedTypeName}
        description={view.dispDesc}
        imageAspectClassName="aspect-square max-h-[44vh] md:max-h-[360px]"
        contentMaxWidthClass="max-w-[560px]"
        twoColumn={false}
      />

      {/* ===== ① 相互理解度 (+個別は位置づけ) + 本文 ===== */}
      <section className={sectionCls}>
        <SectionHead num={1} title={`${p}さんから見た${youWord}`} large={L} />
        <div className={panelCls}>
          <div className="text-center">
            <p
              className={`text-[#5B5BEF] font-bold mb-1 ${
                L ? "text-base" : "text-sm"
              }`}
            >
              相互理解度
            </p>
            <p
              className={`text-[#2E2E5C] font-black leading-none ${
                L ? "text-7xl" : "text-6xl"
              }`}
            >
              {view.mutual}
              <span className={L ? "text-4xl" : "text-3xl"}>%</span>
            </p>
            <div
              className={`mt-3 rounded-full bg-[#2E2E5C]/10 overflow-hidden ${
                L ? "h-3.5" : "h-3"
              }`}
              role="progressbar"
              aria-label={`相互理解度 ${view.mutual}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={view.mutual}
            >
              <div
                className="h-full rounded-full bg-[#5B5BEF]"
                style={{ width: `${view.mutual}%` }}
              />
            </div>
            {/* 個別ページ: 全体での位置づけ一言 (総合データ由来)。無ければ通常ラベル。 */}
            {isIndividual && rankNote ? (
              <p
                className={`text-[#5B5BEF] font-black mt-2 leading-relaxed ${
                  L ? "text-base" : "text-sm"
                }`}
              >
                {rankNote}
              </p>
            ) : (
              <p
                className={`text-[#2E2E5C]/75 font-bold mt-2 leading-relaxed ${
                  L ? "text-sm" : "text-xs"
                }`}
              >
                {mutualLabel(view.mutual)}
              </p>
            )}
          </div>

          <div
            className={`border-t border-dashed border-[#2E2E5C]/15 ${
              L ? "my-6" : "my-5"
            }`}
          />

          <p className={bodyCls}>{view.perceivedLookBody}</p>
        </div>
      </section>

      {/* ===== ①→② の間: その友達が見たタイプのグループ別挿絵 (個別ページのみ・1枚) ===== */}
      {bodySceneSrc && (
        <div className={sectionCls}>
          <SmoothImage
            src={bodySceneSrc}
            alt=""
            width={1532}
            height={800}
            className="mx-auto h-auto w-full max-w-[560px]"
          />
        </div>
      )}

      {/* ===== ② ギャップ (レーダー + 共通発散バー + 軸ごと解説文) ===== */}
      <section className={sectionCls}>
        <SectionHead num={2} title={`${p}さんとのギャップ`} large={L} />
        <div className={panelCls}>
          <MutualUnderstandingRadar
            gaps={view.gaps}
            selfLabel={`${view.displayName}自身`}
            otherLabel="友達から"
          />
          <div className="mt-2">
            <BigFiveDivergingBars
              scores={selfScores}
              friendScores={otherScores}
              friendLabel="友達から"
              hideHeading
              bareCard={L}
            />
          </div>
          {view.sortedGaps.map((g, idx) => {
            const dir = gapDir3(g.selfPercent, g.otherPercent);
            const d = gapDetail[g.key][dir];
            const detail = idx < 2 ? d.full : d.short;
            return (
              <div key={g.key}>
                {idx === 2 && (
                  <div
                    className={`border-t border-dashed border-[#2E2E5C]/25 ${
                      L ? "mt-7 pt-6" : "mt-6 pt-5"
                    }`}
                  >
                    <p
                      className={`text-[#2E2E5C]/55 font-bold mb-1 ${
                        L ? "text-sm" : "text-xs"
                      }`}
                    >
                      そのほかの3つ
                    </p>
                  </div>
                )}
                {idx !== 2 && (
                  <div
                    className={`border-t border-[#2E2E5C]/10 ${
                      L ? "my-6" : "my-5"
                    }`}
                  />
                )}
                <div className="flex items-baseline justify-between mb-3">
                  <h3
                    className={`text-[#2E2E5C] font-black ${
                      L ? "text-lg" : "text-base"
                    }`}
                  >
                    {g.label}
                  </h3>
                  <span
                    className={`text-[#5B5BEF] font-black ${
                      L ? "text-sm" : "text-xs"
                    }`}
                  >
                    差 {g.diffPoints}pt
                  </span>
                </div>
                <p className={bodyCls}>{detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== メッセージ / 自由回答 ===== */}
      {isIndividual ? (
        // 個別ページ: 本人にとっての贈りもの。主役級に大きく (ひとこと + 自由回答)。
        (trimmedOwnerMessage.length > 0 || view.qualEntries.length > 0) && (
          <section className={sectionCls}>
            <SectionHead num={3} title={`${p}さんからの贈りもの`} large={L} />
            <div className="flex flex-col gap-4">
              {trimmedOwnerMessage.length > 0 && (
                <figure className="rounded-3xl bg-[#F4F4FE] px-7 py-7">
                  <blockquote className="text-[#2E2E5C] font-black text-2xl leading-[1.5] whitespace-pre-wrap break-words">
                    {trimmedOwnerMessage}
                  </blockquote>
                  <figcaption className="text-[#2E2E5C]/60 text-base font-bold mt-3 text-right">
                    — {p} より
                  </figcaption>
                </figure>
              )}
              {view.qualEntries.map((e) => (
                <div key={e.label} className={cardCls}>
                  <p className="text-[#5B5BEF] font-bold text-sm mb-1">
                    {e.label}
                  </p>
                  <p className="text-[#2E2E5C] font-black text-xl leading-[1.5] whitespace-pre-wrap break-words">
                    {e.value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )
      ) : (
        // 評価者ページ: 従来どおり吹き出しカード (小)。
        <PerceptionMessageCard entries={view.qualEntries} perceiverName={p} />
      )}

      {/* ===== ③ 見つけたアナタ (評価者ページのみ) ===== */}
      {!isIndividual && view.hasFound && (
        <section className={sectionCls}>
          <SectionHead num={3} title={`${p}さんが見つけたアナタ`} large={L} />
          <PerceptionFoundProse
            perceiverName={p}
            strengthParas={view.strengthParas}
            surpriseParas={view.surpriseParas}
          />
        </section>
      )}

      {/* ===== ④ ふたりの関係 ===== */}
      {/* 本文プローズのみのセクションなので機能カード枠 (CARD) は付けず、見出し直下に
          本文を流す。相互理解度①・レーダー②・贈りもの③ の機能的な囲みは残す。 */}
      <section className={sectionCls}>
        <SectionHead num={4} title="ふたりの関係" large={L} />
        <div>
          <p className={`${bodyCls} ${L ? "mb-5" : "mb-4"}`}>
            {view.relationFactBody}
          </p>
          <p className={`${bodyCls} ${L ? "mb-5" : "mb-4"}`}>
            {view.relationGapBody}
          </p>
          {view.perceivedTipsBody && (
            <p className={`${bodyCls} ${L ? "mb-5" : "mb-4"}`}>
              {pinkify(view.perceivedTipsBody, view.tipsKey)}
            </p>
          )}
          <p className={bodyCls}>
            {pinkify(view.relationTipBody, view.relationTipKey)}
          </p>
        </div>
      </section>

      {footer}
    </>
  );
}
