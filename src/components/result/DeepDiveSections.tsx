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
import Image from "next/image";
import type { BigFiveDimension, TorisetsuTypeId } from "@/lib/types";
import { TYPE_DEEP_DIVE, type TypeDeepDive } from "@/lib/report-data";
import { classifyThirtyTwoType } from "@/lib/thirty-two-types";
import { LOVE_BY_TYPE_32 } from "@/lib/love-by-type-32";
import { CAREER_BY_TYPE_32 } from "@/lib/career-by-type-32";

// ※「みんなの目」(他己) タブは /tako/[token] へ移設。ここは自己深掘り3タブのみ。

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
  { key: "career", tab: "キャリア", hint: "C" },
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
  /** タブ別の挿絵 (シーン別イラスト)。null/未指定なら非表示 (親が fs 走査して渡す)。 */
  sceneImages?: Partial<Record<"love" | "career" | "growth", string | null>>;
  className?: string;
}

export function DeepDiveSections({
  typeId,
  scores,
  sceneImages,
  className = "",
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

  const current = DEEP_DIVE_CARDS[active];
  // ⚠ 恋愛カードのみ 32タイプ解決（非対称設計。理由は love-by-type-32.ts 冒頭を参照）:
  //   恋愛は神経症傾向 N軸(_R/_N)で内容が大きく変わるため、scores から 32タイプ(base16__N/R)を
  //   判定して LOVE_BY_TYPE_32 から引く。未投入タイプは従来の8タイプ love にフォールバック。
  //   他カード(強み/弱み/成長)は従来どおり 8タイプ(deepDive)を共有する。
  //   仕事(career)も原則 8タイプ共有だが、特定 32タイプだけ差し替えたい場合は
  //   CAREER_BY_TYPE_32 に登録 (love と同じ非対称フォールバック。現状=未知グループ8体)。
  const thirtyTwoId = classifyThirtyTwoType(scores);
  const love32 = LOVE_BY_TYPE_32[thirtyTwoId];
  const career32 = CAREER_BY_TYPE_32[thirtyTwoId];
  const section =
    current.key === "love" && love32
      ? love32
      : current.key === "career" && career32
        ? career32
        : deepDive[current.key];
  const note = scoreNote(current.hint);

  return (
    <section className={`mb-8 ${className}`.trim()}>
      {/* 見出し: ①②と同じ 16P 風 (丸囲み数字 + 大きめタイトル) */}
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
        >
          3
        </span>
        <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
          アナタの深掘り
        </h2>
      </div>

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
                  ? "bg-[#2E2E5C] text-white border-[#2E2E5C]"
                  : "bg-white text-[#2E2E5C] border-[#0094D8]/25 hover:bg-[#F4F4FE]"
              }`}
            >
              {c.tab}
            </button>
          );
        })}
      </div>

      <article role="tabpanel" className="px-1 pt-1 pb-2">
        {/* 挿絵 (タブ対応のシーン別イラスト): タブ内の一番上に表示 */}
        {(current.key === "love" ||
          current.key === "career" ||
          current.key === "growth") &&
          sceneImages?.[current.key] && (
            <Image
              src={sceneImages[current.key]!}
              alt=""
              width={960}
              height={640}
              className="mx-auto mb-6 h-auto w-full max-w-[560px] md:max-w-[760px]"
            />
          )}
        {/* カード大見出し(section.title)は非表示 (タブにラベルが出るため冗長)。
            ※ title データ自体は report-data.ts / LOVE_BY_TYPE_32 に温存 (表示しないだけ)。 */}

        {/* スコア由来の一文 (パーソナライズ)。ピンクのバッジ装飾は外しプレーンテキスト表示に。 */}
        <p className="text-[#2E2E5C]/70 text-sm mb-4">{note}</p>

        {section.body.split("\n\n").map((para, i) => (
          <p
            key={i}
            className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0"
          >
            {para}
          </p>
        ))}

      </article>
    </section>
  );
}
