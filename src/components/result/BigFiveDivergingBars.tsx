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
import type { ResultLocale } from "@/i18n/result";

interface AxisMeta {
  dim: BigFiveDimension;
  title: string;
  /** 左極 (= スコア低) のラベル */
  left: string;
  /** 右極 (= スコア高) のラベル */
  right: string;
  /** 軸カラー (16P 参考: 軸ごとに固有色。バー塗り・マーカー・% 数字に使用) */
  color: string;
}

// 表示順は性格 5 因子の一般的な並びに寄せつつ、E→O→A→C→N とする。
// 極ラベルは「スペック感・優劣感」を消すため、神経症傾向も必ず両極命名する
// (高 = 繊細 / 低 = 安定。「神経症的かどうか」の一極評価にしない)。
// 軸カラーは 16P の 5 色 (青/黄/緑/紫/赤) を踏襲。
// 表示順は OCEAN 軸順 (O→C→E→A→N)。各要素に title/left/right/color/dim(スコア参照) が
// まとまっているため、配列の並べ替えだけで色・ラベル・スコアが完全連動する (対応ズレなし)。
const AXES: readonly AxisMeta[] = [
  { dim: "O", title: "開放性", left: "現実的", right: "探究的", color: "#E4AE3A" },
  { dim: "C", title: "誠実性", left: "柔軟", right: "計画的", color: "#88619A" },
  { dim: "E", title: "外向性", left: "内向", right: "外向", color: "#4298B4" },
  { dim: "A", title: "協調性", left: "独立", right: "協調", color: "#33A474" },
  { dim: "N", title: "神経症傾向", left: "安定", right: "繊細", color: "#F25E62" },
];

const KO_AXES: readonly AxisMeta[] = [
  { dim: "O", title: "개방성", left: "현실적", right: "탐구적", color: "#E4AE3A" },
  { dim: "C", title: "성실성", left: "유연함", right: "계획적", color: "#88619A" },
  { dim: "E", title: "외향성", left: "내향적", right: "외향적", color: "#4298B4" },
  { dim: "A", title: "우호성", left: "독립적", right: "협력적", color: "#33A474" },
  { dim: "N", title: "정서적 민감성", left: "안정적", right: "섬세함", color: "#F25E62" },
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
function leanLabel(
  value: number,
  left: string,
  right: string,
  locale: ResultLocale,
): string {
  const d = value - 50;
  const ad = Math.abs(d);
  if (ad <= 7) return locale === "ko" ? "가운데에 가까움" : "ほぼ中央";
  const pole = d > 0 ? right : left;
  if (locale === "ko") {
    return ad <= 20 ? `조금 ${pole}` : `${pole} 성향`;
  }
  return ad <= 20 ? `やや${pole}寄り` : `${pole}寄り`;
}

interface BigFiveDivergingBarsProps {
  /** 0-10 スケールの 5 軸スコア (user.scores)。欠損軸は中央 50% 扱い。 */
  scores: Partial<Record<BigFiveDimension, number>>;
  /**
   * 友達評価の平均スコア (0-10)。指定時は各軸に「友達の平均」マーカー (◆) を重ね、
   * 凡例 (自分 ● / 友達 ◆) を表示する。自己認知ギャップの可視化に使う。
   */
  friendScores?: Partial<Record<BigFiveDimension, number>>;
  /** 友達マーカー(◆)の凡例・aria ラベル。既定「友達の平均」。単一評価者ページでは「友達から」等に差し替える。 */
  friendLabel?: string;
  /** 主マーカー(●)の凡例ラベル。既定「自分」。他己ページ等で「みんなの目」等に差し替える。 */
  primaryLabel?: string;
  /** 見出し (既定: 自己単体表示。友達重ね時は別タイトルにして重複見出しを避ける)。 */
  title?: string;
  /** 見出しバッジの絵文字。number 指定時は使われない。 */
  emoji?: string;
  /** 章番号 (16P 風の丸囲み数字バッジ)。指定時は絵文字バッジの代わりに表示。 */
  number?: string;
  /** 見出し(バッジ+タイトル)を隠す。上位に別の見出しがある入れ子表示で重複を避ける。 */
  hideHeading?: boolean;
  /**
   * バー本体を囲む白カード枠 (border/背景/padding) を外し、地の白に溶け込ませる。
   * 既定 false = 従来どおりカード枠あり。個別ページ (/tako 個別) のみ true で使う。
   */
  bareCard?: boolean;
  className?: string;
  locale?: ResultLocale;
}

export function BigFiveDivergingBars({
  scores,
  friendScores,
  friendLabel,
  primaryLabel,
  title,
  emoji = "✨",
  number,
  hideHeading = false,
  bareCard = false,
  className = "",
  locale = "ja",
}: BigFiveDivergingBarsProps) {
  const hasFriend = !!friendScores;
  const axes = locale === "ko" ? KO_AXES : AXES;
  const resolvedFriendLabel =
    friendLabel ?? (locale === "ko" ? "친구 평균" : "友達の平均");
  const resolvedPrimaryLabel =
    primaryLabel ?? (locale === "ko" ? "나" : "自分");
  const resolvedTitle =
    title ?? (locale === "ko" ? "5가지 축으로 보는 나" : "5つの軸で見るアナタ");
  return (
    <section className={`mb-8 ${className}`.trim()}>
      {/* セクション見出し (16P 風: 丸囲み数字 + 大きめタイトル。number 未指定は絵文字バッジ)。
          hideHeading=true (入れ子表示) では上位見出しに任せて省略。 */}
      {!hideHeading && (
        <div className="flex items-center gap-3 mb-4">
          {number ? (
            <span
              aria-hidden="true"
              className="flex-shrink-0 w-10 h-10 rounded-full border-[3px] border-[#2E2E5C] text-[#2E2E5C] font-black text-lg flex items-center justify-center"
            >
              {number}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#2E2E5C] text-white text-lg flex items-center justify-center"
            >
              {emoji}
            </span>
          )}
          <h2 className="text-[#2E2E5C] font-black text-[30px] md:text-[36px] leading-tight">
            {resolvedTitle}
          </h2>
        </div>
      )}

      {/* バー本体は 16P 同様に白カード (角丸 + 薄ボーダー) で囲む。
          bareCard=true (個別ページ) では枠/背景/padding を外し地に溶け込ませる。 */}
      <div
        className={
          bareCard
            ? "space-y-6"
            : "space-y-6 rounded-2xl border border-[#E3E6F5] bg-white p-5 md:p-7"
        }
      >
        {/* 凡例 (友達スコア重ね表示時のみ): 自分 ● / 友達 ◆ */}
        {hasFriend && (
          <div
            aria-hidden="true"
            className="flex items-center justify-end gap-4 text-[11px] font-bold text-[#2E2E5C]/70"
          >
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full border-2 border-white shadow"
                style={{ background: "var(--primary)" }}
              />
              {resolvedPrimaryLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rotate-45 border-2 border-white shadow"
                style={{ background: "#2E2E5C" }}
              />
              {resolvedFriendLabel}
            </span>
          </div>
        )}
        {axes.map((axis) => {
          const value = toPercent(scores[axis.dim]);
          const lean = leanLabel(value, axis.left, axis.right, locale);
          // 発散フィル: 中央 50% を起点に、傾いた側へ伸ばす。
          const fillLeft = value >= 50 ? 50 : value;
          const fillWidth = value >= 50 ? value - 50 : 50 - value;
          // 友達の平均 (該当軸に数値があるときのみ第2マーカーを出す)。
          const friendValue =
            friendScores && typeof friendScores[axis.dim] === "number"
              ? toPercent(friendScores[axis.dim])
              : null;

          return (
            <div key={axis.dim}>
              {/* スクリーンリーダー用の要約 (色だけに意味を持たせない) */}
              <span className="sr-only">{`${axis.title}：${lean} ${value}%${
                friendValue !== null
                  ? `${locale === "ko" ? ", " : "、"}${resolvedFriendLabel} ${friendValue}%`
                  : ""
              }`}</span>

              {/* 上段 (16P 参考): 「軸名: %(軸色) 判定」を左寄せで 1 行に */}
              <div
                aria-hidden="true"
                className="mb-2 flex items-baseline gap-1.5"
              >
                <span className="text-[#2E2E5C] font-bold text-[15px]">
                  {axis.title}:
                </span>
                <span
                  className="font-black text-[15px] tabular-nums"
                  style={{ color: axis.color }}
                >
                  {value}%
                </span>
                <span className="text-[#2E2E5C] font-bold text-[15px]">
                  {lean}
                </span>
              </div>

              {/* 中段: 発散バー (全幅・装飾 → aria-hidden)。
                  レール = 軸色の淡ティント、中央→スコアの塗りとマーカー = 軸色 (16P の
                  軸ごと固有色)。発散形式 (中央起点) は従来のまま。 */}
              <div aria-hidden="true" className="relative w-full h-4">
                {/* 土台レール: 軸色の淡ティント (16P のバー地色風) */}
                <div
                  className="absolute inset-0 rounded-full overflow-hidden"
                  style={{ background: `${axis.color}2E` }}
                >
                  {/* 中央→スコアの強調塗り (軸色)。value===50 は 2px で可視化 */}
                  <div
                    className="absolute top-0 h-full transition-all duration-500"
                    style={{
                      left: `${fillLeft}%`,
                      width: `${fillWidth}%`,
                      minWidth: value === 50 ? "2px" : undefined,
                      background: axis.color,
                    }}
                  />
                </div>

                {/* 中央ティック (発散の起点を示す・控えめ) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-5 bg-[#2E2E5C]/30" />

                {/* 友達の平均マーカー (◆ deepPurple)。自分の円と形・色で区別 */}
                {friendValue !== null && (
                  <div
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-45 border-2 border-white shadow-md transition-all duration-500"
                    style={{ left: `${friendValue}%`, background: "#2E2E5C" }}
                  />
                )}

                {/* 自分のマーカー (16P 風: 白地の円 + 軸色の太リング) */}
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-500"
                  style={{
                    left: `${value}%`,
                    border: `4px solid ${axis.color}`,
                  }}
                />
              </div>

              {/* 下段 (16P 参考): 両極ラベルをバーの下に左右端で配置 (グレー控えめ) */}
              <div
                aria-hidden="true"
                className="mt-1.5 flex items-center justify-between text-[12px] font-bold text-[#2E2E5C]/55 leading-tight"
              >
                <span>{axis.left}</span>
                <span>{axis.right}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
