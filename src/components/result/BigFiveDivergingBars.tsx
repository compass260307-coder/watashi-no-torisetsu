// Big Five 5 軸の「発散バー」(/me/[token] 結果ページで使用)。
//
// 設計方針:
//   - presentational な Server Component (インタラクションなし → "use client" 不要)。
//   - スコアの真実源は user.scores (0-10 スケール、diagnosis.ts の calculateScores 由来)。
//     逆転項目は calculateFacetScores (8 - rawAnswer) で処理済みなので、ここでは再計算しない。
//   - 0-10 → 0-100% へ線形変換し、理論中点 5.0 がちょうど 50% に乗る (= 中央)。
//   - バーは「中央 50% を基準に左右へ伸びる発散型」。両極をやさしく色分けし、
//     どちらの極が良い/悪いという優劣感は出さない (両極ラベルは同フォント・同色)。
//
// 既存の DimensionPolarityBar / FacetBarChart はデッドかつ仕様が異なるため使わない (新規実装)。

import type { BigFiveDimension } from "@/lib/types";

interface AxisMeta {
  dim: BigFiveDimension;
  title: string;
  /** 左極 (= スコア低) のラベル */
  left: string;
  /** 右極 (= スコア高) のラベル */
  right: string;
}

// 表示順は性格 5 因子の一般的な並びに寄せつつ、E→O→A→C→N とする。
// 極ラベルは「スペック感・優劣感」を消すため、神経症傾向も必ず両極命名する
// (高 = 繊細 / 低 = 安定。「神経症的かどうか」の一極評価にしない)。
const AXES: readonly AxisMeta[] = [
  { dim: "E", title: "外向性", left: "内向", right: "外向" },
  { dim: "O", title: "開放性", left: "現実的", right: "探究的" },
  { dim: "A", title: "協調性", left: "独立", right: "協調" },
  { dim: "C", title: "誠実性", left: "柔軟", right: "計画的" },
  { dim: "N", title: "神経症傾向", left: "安定", right: "繊細" },
];

/**
 * 0-10 スコアを 0-100% に変換 (中点 5.0 → 50%)。
 * 欠損時は 5.0 (= 50% = ちょうど中央) にフォールバック。最後に 0-100 へ clamp。
 */
function toPercent(score: number | undefined): number {
  const s = typeof score === "number" ? score : 5;
  return Math.max(0, Math.min(100, Math.round(s * 10)));
}

/**
 * 「寄り」ラベル。d = value - 50 の絶対値で 3 段階に分ける。
 *   |d| <= 7        → ほぼ中央 (極なし)
 *   7 < |d| <= 20   → やや◯◯寄り
 *   |d| > 20        → ◯◯寄り
 * ◯◯ は value が傾いている側の極ラベル。
 */
function leanLabel(value: number, left: string, right: string): string {
  const d = value - 50;
  const ad = Math.abs(d);
  if (ad <= 7) return "ほぼ中央";
  const pole = d > 0 ? right : left;
  if (ad <= 20) return `やや${pole}寄り`;
  return `${pole}寄り`;
}

interface BigFiveDivergingBarsProps {
  /** 0-10 スケールの 5 軸スコア (user.scores)。欠損軸は中央 50% 扱い。 */
  scores: Partial<Record<BigFiveDimension, number>>;
  className?: string;
}

export function BigFiveDivergingBars({
  scores,
  className = "",
}: BigFiveDivergingBarsProps) {
  return (
    <section className={`mb-8 ${className}`.trim()}>
      {/* セクション見出し (他セクションと同じ deepPurple トーン) */}
      <div className="flex items-center gap-3 mb-4">
        <span
          aria-hidden="true"
          className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white text-lg flex items-center justify-center"
        >
          📊
        </span>
        <h2 className="text-[#3A2D6B] font-black text-xl leading-tight">
          5つの軸で見るアナタ
        </h2>
      </div>

      <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 space-y-5">
        {AXES.map((axis) => {
          const value = toPercent(scores[axis.dim]);
          const lean = leanLabel(value, axis.left, axis.right);
          // 発散フィル: 中央 50% を起点に、傾いた側へ伸ばす。
          const fillLeft = value >= 50 ? 50 : value;
          const fillWidth = value >= 50 ? value - 50 : 50 - value;

          return (
            <div key={axis.dim}>
              {/* スクリーンリーダー用の要約 (色だけに意味を持たせない) */}
              <span className="sr-only">{`${axis.title}：${lean} ${value}%`}</span>

              {/* 軸名 + 「寄りラベル ・ %」(視覚) */}
              <div
                aria-hidden="true"
                className="flex items-baseline justify-between mb-2"
              >
                <span className="text-[#3A2D6B] font-black text-sm">
                  {axis.title}
                </span>
                <span className="text-[#3A2D6B]/70 font-bold text-xs tabular-nums">
                  {lean} ・ {value}%
                </span>
              </div>

              {/* 両極ラベル + 発散バー (すべて装飾 → aria-hidden) */}
              <div aria-hidden="true" className="flex items-center gap-2">
                {/* 左極ラベル: truncate せず、min/max 幅 + 必要なら折り返しで収める */}
                <span className="text-[#3A2D6B] font-bold text-[11px] leading-tight text-center min-w-[2.75rem] max-w-[4.5rem] shrink-0 break-words">
                  {axis.left}
                </span>

                <div className="relative flex-1 h-3">
                  {/* 2 色トラック (中央を境にベタ塗り 2 色。グラデにはしない) */}
                  <div className="absolute inset-0 rounded-full overflow-hidden flex">
                    <div
                      className="w-1/2 h-full"
                      style={{ background: "var(--axis-tint-left)" }}
                    />
                    <div
                      className="w-1/2 h-full"
                      style={{ background: "var(--axis-tint-right)" }}
                    />
                    {/* 発散フィル (中央起点・ブランドピンク)。value===50 は 2px で可視化 */}
                    <div
                      className="absolute top-0 h-full transition-all duration-500"
                      style={{
                        left: `${fillLeft}%`,
                        width: `${fillWidth}%`,
                        minWidth: value === 50 ? "2px" : undefined,
                        background: "var(--primary)",
                      }}
                    />
                  </div>

                  {/* 中央ティック (常時表示。トラックより前面) */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-5 bg-[#3A2D6B]/45" />

                  {/* マーカー (単色円 + 白リング)。軸ごとのキャラは置かない */}
                  <div
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md transition-all duration-500"
                    style={{ left: `${value}%`, background: "var(--primary)" }}
                  />
                </div>

                {/* 右極ラベル (左と同フォント・同色 = 優劣感を出さない) */}
                <span className="text-[#3A2D6B] font-bold text-[11px] leading-tight text-center min-w-[2.75rem] max-w-[4.5rem] shrink-0 break-words">
                  {axis.right}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
