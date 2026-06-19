// 自己分析「深掘り」セクション (/me/[token] 結果ページ、発散バーの直下)。
//
// 設計方針:
//   - presentational な Server Component ("use client" 不要)。
//   - 本文は新規AI生成せず、既存の固定テンプレ report-data.ts の TYPE_DEEP_DIVE を再利用。
//     ユーザーのタイプは diagnosis.ts の classifyType(scores) で 8 タイプへ決定論的に導出 (親で実施)。
//   - 各カードにスコア由来の一文 (ルールベース・AI不要) を添える。
//     user.scores(0-10) → 0-100% に変換し、最も高い軸 / 最も低い軸などを中立的に提示するだけ。

import type { BigFiveDimension, TorisetsuTypeId } from "@/lib/types";
import { TYPE_DEEP_DIVE, type TypeDeepDive } from "@/lib/report-data";

// 一文に使う軸の表示名 (発散バーと整合。N はやわらかく「繊細さ」)。
const AXIS_LABEL: Record<BigFiveDimension, string> = {
  E: "外向性",
  A: "協調性",
  O: "開放性",
  C: "誠実性",
  N: "繊細さ",
};

// 表示する 5 カテゴリ (要望順: 強み/弱み/恋愛/仕事/成長)。
// hint = スコア一文の素材の選び方:
//   "top"    → 最も高い軸、"bottom" → 最も低い軸、または特定軸 ("A" / "C")。
const DEEP_DIVE_CARDS: {
  key: keyof TypeDeepDive;
  hint: "top" | "bottom" | "growth" | BigFiveDimension;
}[] = [
  { key: "strength", hint: "top" },
  { key: "weakness", hint: "bottom" },
  { key: "love", hint: "A" },
  { key: "career", hint: "C" },
  { key: "growth", hint: "growth" },
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
}

export function DeepDiveSections({
  typeId,
  scores,
  className = "",
}: DeepDiveSectionsProps) {
  const deepDive = TYPE_DEEP_DIVE[typeId];

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

  return (
    <section className={`mb-8 ${className}`.trim()}>
      <div className="flex items-center gap-3 mb-4">
        <span
          aria-hidden="true"
          className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white text-lg flex items-center justify-center"
        >
          🔍
        </span>
        <h2 className="text-[#3A2D6B] font-black text-xl leading-tight">
          アナタの深掘り
        </h2>
      </div>

      <div className="flex flex-col gap-5">
        {DEEP_DIVE_CARDS.map(({ key, hint }) => {
          const section = deepDive[key];
          const note = scoreNote(hint);
          return (
            <article
              key={key}
              className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6"
            >
              <h3 className="text-[#3A2D6B] font-black text-lg leading-tight mb-3">
                {section.title}
              </h3>

              {/* スコア由来の一文 (パーソナライズ。色だけに意味を持たせない) */}
              <p className="inline-flex items-start gap-1.5 bg-[#FFF0F3] text-[#3A2D6B] font-bold text-xs rounded-full px-3 py-1.5 mb-4">
                <span aria-hidden="true">📊</span>
                <span>{note}</span>
              </p>

              {section.body.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  className="text-[#3A2D6B] font-bold text-sm leading-relaxed mb-4 last:mb-0"
                >
                  {para}
                </p>
              ))}
            </article>
          );
        })}
      </div>
    </section>
  );
}
