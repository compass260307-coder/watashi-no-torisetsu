"use client";

// 自己分析「深掘り」セクション (/me/[token] 結果ページ、発散バーの直下)。
//
// 設計方針:
//   - タブ切替を持つためクライアントコンポーネント ("use client")。
//     縦積み5枚 → タブ1枚表示にして、ロックまでのスクロールを圧縮するのが目的。
//   - 本文は新規AI生成せず、既存の固定テンプレ report-data.ts の TYPE_DEEP_DIVE を再利用。
//     ユーザーのタイプは diagnosis.ts の classifyType(scores) で 8 タイプへ決定論的に導出 (親で実施)。
//   - 各カードにスコア由来の一文 (ルールベース・AI不要) を添える。
//     user.scores(0-10) → 0-100% に変換し、最も高い軸 / 最も低い軸などを中立的に提示するだけ。

import { useState } from "react";
import type { BigFiveDimension, TorisetsuTypeId } from "@/lib/types";
import { TYPE_DEEP_DIVE, type TypeDeepDive } from "@/lib/report-data";
import { classifyThirtyTwoType } from "@/lib/thirty-two-types";
import { LOVE_BY_TYPE_32 } from "@/lib/love-by-type-32";
import { MinnaNoMePanel } from "@/components/result/MinnaNoMePanel";

// 4つ目タブ「みんなの目」の解除後表示に必要な文脈 (親でサーバー算出)。
export type MinnaTabContext = {
  selfEssence: string;
  friendEssence: string;
  friendTypeName: string;
  friendPreviewPath: string;
  matched: boolean;
  gapSentence: string | null;
  favoritePoints: string[];
  letters: { name: string; message: string }[];
};

export type MinnaTabProps = {
  ownerToken: string;
  friendCount: number;
  threshold: number;
  // 解除後 (friendCount >= threshold) のみ context あり。ロック中は null。
  context: MinnaTabContext | null;
};

// 一文に使う軸の表示名 (発散バーと整合。N はやわらかく「繊細さ」)。
const AXIS_LABEL: Record<BigFiveDimension, string> = {
  E: "外向性",
  A: "協調性",
  O: "開放性",
  C: "誠実性",
  N: "繊細さ",
};

// 表示する 3 カテゴリ (恋愛/仕事/成長)。
// ※ strength(強み)/weakness(弱み) は「表示から外す」だけで、データ本体
//   (report-data.ts の TYPE_DEEP_DIVE.strength / .weakness) は温存。後で各
//   セクションへ組み込む素材として残してある (この配列から除外＝非表示のみ)。
// hint = スコア一文の素材の選び方:
//   "top" → 最も高い軸、"bottom" → 最も低い軸、または特定軸 ("A" / "C")、"growth"。
// ※ 絵文字は撤去し、タブ/見出しはテキストラベルのみ。
const DEEP_DIVE_CARDS: {
  key: keyof TypeDeepDive;
  tab: string;
  hint: "top" | "bottom" | "growth" | BigFiveDimension;
}[] = [
  { key: "love", tab: "恋愛傾向", hint: "A" },
  { key: "career", tab: "仕事", hint: "C" },
  { key: "growth", tab: "成長", hint: "growth" },
];

function toPercent(score: number | undefined): number {
  const s = typeof score === "number" ? score : 5;
  return Math.max(0, Math.min(100, Math.round(s * 10)));
}

interface DeepDiveSectionsProps {
  /** 8 タイプ ID (親で classifyType(scores) により導出)。 */
  typeId: TorisetsuTypeId;
  /** 0-10 スケールの 5 軸スコア (user.scores)。 */
  scores: Partial<Record<BigFiveDimension, number>>;
  className?: string;
  /** 4つ目タブ「みんなの目」。渡されたときだけタブを追加表示。 */
  minna?: MinnaTabProps;
}

export function DeepDiveSections({
  typeId,
  scores,
  className = "",
  minna,
}: DeepDiveSectionsProps) {
  const deepDive = TYPE_DEEP_DIVE[typeId];
  // 初期選択は「恋愛傾向」(love) を明示指定 (カード配列の並びが変わっても love を初期表示)。
  const loveIndex = Math.max(
    0,
    DEEP_DIVE_CARDS.findIndex((c) => c.key === "love"),
  );
  const [active, setActive] = useState(loveIndex);

  // 全 5 軸を % 化し、最高 / 最低の軸を求める (中立的なスコア一文の素材)。
  const dims: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  const pct: Record<BigFiveDimension, number> = {
    E: toPercent(scores.E),
    A: toPercent(scores.A),
    O: toPercent(scores.O),
    C: toPercent(scores.C),
    N: toPercent(scores.N),
  };
  const topDim = dims.reduce((a, b) => (pct[b] > pct[a] ? b : a));
  const bottomDim = dims.reduce((a, b) => (pct[b] < pct[a] ? b : a));

  // カードごとのスコア一文 (ルールベース)。中立的な事実提示にとどめる。
  function scoreNote(hint: (typeof DEEP_DIVE_CARDS)[number]["hint"]): string {
    if (hint === "top") {
      return `アナタの中で最も高いのは${AXIS_LABEL[topDim]}（${pct[topDim]}%）。`;
    }
    if (hint === "bottom") {
      return `最も控えめなのは${AXIS_LABEL[bottomDim]}（${pct[bottomDim]}%）。`;
    }
    if (hint === "growth") {
      return `${AXIS_LABEL[bottomDim]}（${pct[bottomDim]}%）は、意識すると伸ばしどころ。`;
    }
    // 特定軸 (A / C)
    return `アナタの${AXIS_LABEL[hint]}は${pct[hint]}%。`;
  }

  // みんなの目タブ (4つ目) は DEEP_DIVE_CARDS の後ろに付く仮想インデックス。
  const minnaIndex = DEEP_DIVE_CARDS.length;
  const showMinna = !!minna && active === minnaIndex;
  const minnaUnlocked =
    !!minna && minna.friendCount >= minna.threshold && !!minna.context;

  // 静的タブ用の算出 (minna タブ選択中は使わないが、index 越境で undefined に
  // ならないようクランプしておく)。
  const current = DEEP_DIVE_CARDS[Math.min(active, DEEP_DIVE_CARDS.length - 1)];
  // ⚠ 恋愛カードのみ 32タイプ解決（非対称設計。理由は love-by-type-32.ts 冒頭を参照）:
  //   恋愛は神経症傾向 N軸(_R/_N)で内容が大きく変わるため、scores から 32タイプ(base16__N/R)を
  //   判定して LOVE_BY_TYPE_32 から引く。未投入タイプは従来の8タイプ love にフォールバック。
  //   他カード(強み/弱み/仕事/成長)は従来どおり 8タイプ(deepDive)を共有する。
  const thirtyTwoId = classifyThirtyTwoType(scores);
  const love32 = LOVE_BY_TYPE_32[thirtyTwoId];
  const section =
    current.key === "love" && love32 ? love32 : deepDive[current.key];
  const note = scoreNote(current.hint);

  return (
    <section className={`mb-8 ${className}`.trim()}>
      {/* 見出し (絵文字バッジは撤去し、テキストのみ) */}
      <h2 className="text-[#3A2D6B] font-black text-xl leading-tight mb-4">
        アナタの深掘り
      </h2>

      {/* タブ (横並びボタン。モバイルは横スクロール) */}
      <div
        role="tablist"
        aria-label="深掘りカテゴリ"
        className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1"
      >
        {DEEP_DIVE_CARDS.map((c, i) => {
          const selected = i === active;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={`shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-black transition-colors ${
                selected
                  ? "bg-[#3A2D6B] text-white border-[#3A2D6B]"
                  : "bg-white text-[#3A2D6B] border-[#0094D8]/25 hover:bg-[#FFF0F3]"
              }`}
            >
              {c.tab}
            </button>
          );
        })}

        {/* 4つ目タブ「みんなの目」。ロック時は鍵、解除後は目のマークを頭に付ける。 */}
        {minna && (
          <button
            type="button"
            role="tab"
            aria-selected={showMinna}
            onClick={() => setActive(minnaIndex)}
            className={`shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-black transition-colors ${
              showMinna
                ? "bg-[#FE3C72] text-white border-[#FE3C72]"
                : "bg-white text-[#FE3C72] border-[#FE3C72]/30 hover:bg-[#FFF0F3]"
            }`}
          >
            {minnaUnlocked ? "👀 みんなの目" : "🔒 みんなの目"}
          </button>
        )}
      </div>

      {/* みんなの目タブ選択中: ロック / 解除後パネル。それ以外: 静的な深掘り本文。 */}
      {showMinna && minna ? (
        <div role="tabpanel" className="px-1 pt-1 pb-2">
          {minnaUnlocked && minna.context ? (
            <MinnaNoMePanel
              ownerToken={minna.ownerToken}
              selfEssence={minna.context.selfEssence}
              friendEssence={minna.context.friendEssence}
              friendTypeName={minna.context.friendTypeName}
              friendPreviewPath={minna.context.friendPreviewPath}
              matched={minna.context.matched}
              gapSentence={minna.context.gapSentence}
              favoritePoints={minna.context.favoritePoints}
              letters={minna.context.letters}
            />
          ) : (
            <MinnaLocked
              friendCount={minna.friendCount}
              threshold={minna.threshold}
            />
          )}
        </div>
      ) : (
        <article role="tabpanel" className="px-1 pt-1 pb-2">
          {/* カード大見出し(section.title)は非表示 (タブにラベルが出るため冗長)。
              ※ title データ自体は report-data.ts / LOVE_BY_TYPE_32 に温存 (表示しないだけ)。 */}

          {/* スコア由来の一文 (パーソナライズ)。ピンクのバッジ装飾は外しプレーンテキスト表示に。 */}
          <p className="text-[#3A2D6B]/70 text-sm mb-4">{note}</p>

          {section.body.split("\n\n").map((para, i) => (
            <p
              key={i}
              className="body-gothic text-[#3A2D6B] font-medium text-lg leading-[1.6] mb-4 last:mb-0"
            >
              {para}
            </p>
          ))}
        </article>
      )}
    </section>
  );
}

// みんなの目タブのロック状態 (友達3人未満)。鍵・進捗ドット・あと◯人・招待CTA。
function MinnaLocked({
  friendCount,
  threshold,
}: {
  friendCount: number;
  threshold: number;
}) {
  const remaining = Math.max(0, threshold - friendCount);
  return (
    <div className="px-1 pt-2 pb-4 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#FFF0F3] text-[#FE3C72] text-3xl flex items-center justify-center"
      >
        🔒
      </div>
      <p className="text-[#3A2D6B] font-black text-lg mb-2">
        友達が{threshold}人答えると、ここが開きます
      </p>
      {/* 進捗ドット (揃った数を塗る) */}
      <div
        className="flex items-center justify-center gap-2 mb-2"
        role="progressbar"
        aria-valuenow={friendCount}
        aria-valuemin={0}
        aria-valuemax={threshold}
      >
        {Array.from({ length: threshold }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full ${
              i < friendCount ? "bg-[#FE3C72]" : "bg-[#FE3C72]/20"
            }`}
          />
        ))}
      </div>
      <p className="text-[#3A2D6B]/70 font-bold text-sm mb-5">
        {remaining > 0 ? `あと ${remaining} 人で開封` : "まもなく開きます"}
      </p>
      <a
        href="#friend-invite"
        className="inline-block rounded-full bg-[#FE3C72] text-white font-black text-sm px-6 py-3 hover:opacity-90 transition-opacity"
      >
        友達に聞いてみる
      </a>
    </div>
  );
}
