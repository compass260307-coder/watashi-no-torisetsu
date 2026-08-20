// Big Five 5 軸のメタデータ (タイトル/両極ラベル/軸カラー) と、スコア→% 変換・
// 「寄り」ラベルのヘルパ。/me の性格特性カード (PersonalityTraitsCard) で使う。
//
// 設計メモ:
//   - 値の並び・色・両極ラベルは既存の BigFiveDivergingBars と同一に保つ (見た目統一)。
//     BigFiveDivergingBars は /tako と共有で改修リスクがあるため、あちらは据え置きにし、
//     ここは新カード専用の source として複製している (16P の "?" ヘルプ文は本ファイル固有)。
//     軸の色・ラベルを変える場合は両方を揃えること。

import type { BigFiveDimension } from "@/lib/types";
import type { ResultLocale } from "@/i18n/result";

export interface AxisMeta {
  dim: BigFiveDimension;
  title: string;
  /** 左極 (= スコア低) のラベル */
  left: string;
  /** 右極 (= スコア高) のラベル */
  right: string;
  /** 軸カラー (16P 参考: 軸ごとに固有色) */
  color: string;
  /** "?" ヘルプの説明文 (軸の意味を短く) */
  help: string;
}

// 表示順は OCEAN 軸順 (O→C→E→A→N)。
export const AXES: readonly AxisMeta[] = [
  {
    dim: "O",
    title: "開放性",
    left: "保守的",
    right: "革新的",
    color: "#E4AE3A",
    help: "新しい体験や発想への好奇心の強さ。高いほど革新的で想像力ゆたか、低いほど保守的で地に足がついています。",
  },
  {
    dim: "C",
    title: "誠実性",
    left: "柔軟",
    right: "計画的",
    color: "#88619A",
    help: "計画性や粘り強さの傾向。高いほど計画的でコツコツ型、低いほど柔軟でその場に合わせて動けます。",
  },
  {
    dim: "E",
    title: "外向性",
    left: "内向",
    right: "外向",
    color: "#4298B4",
    help: "人と関わることでエネルギーを得やすいか。高いほど社交的で活動的、低いほど落ち着いた一人の時間を好みます。",
  },
  {
    dim: "A",
    title: "協調性",
    left: "独立",
    right: "協調",
    color: "#33A474",
    help: "他者への共感や譲り合いの傾向。高いほど思いやりが強く協調的、低いほど自分の軸を大切にする独立型です。",
  },
  {
    dim: "N",
    title: "神経症傾向",
    left: "安定",
    right: "繊細",
    color: "#F25E62",
    help: "感情の揺れやすさ・繊細さ。高いほど気持ちに敏感で共感力が高く、低いほど動じにくく安定しています。",
  },
];

export const KO_AXES: readonly AxisMeta[] = [
  {
    dim: "O",
    title: "개방성",
    left: "현실적",
    right: "탐구적",
    color: "#E4AE3A",
    help: "새로운 경험과 발상에 대한 호기심. 높을수록 탐구적이고 상상력이 풍부하며, 낮을수록 현실적입니다.",
  },
  {
    dim: "C",
    title: "성실성",
    left: "유연함",
    right: "계획적",
    color: "#88619A",
    help: "계획성과 끈기의 경향. 높을수록 계획적이고 꾸준하며, 낮을수록 유연하게 상황에 맞춰 움직입니다.",
  },
  {
    dim: "E",
    title: "외향성",
    left: "내향적",
    right: "외향적",
    color: "#4298B4",
    help: "사람과의 교류에서 에너지를 얻는 정도. 높을수록 사교적이고 활동적이며, 낮을수록 차분한 혼자만의 시간을 좋아합니다.",
  },
  {
    dim: "A",
    title: "우호성",
    left: "독립적",
    right: "협력적",
    color: "#33A474",
    help: "타인에 대한 공감과 배려의 경향. 높을수록 배려심이 크고 협력적이며, 낮을수록 자기 축을 소중히 하는 독립형입니다.",
  },
  {
    dim: "N",
    title: "정서적 민감성",
    left: "안정적",
    right: "섬세함",
    color: "#F25E62",
    help: "감정의 흔들림·섬세함. 높을수록 감정에 민감하고 공감력이 높으며, 낮을수록 쉽게 동요하지 않고 안정적입니다.",
  },
];

/** 0-10 スコアを 0-100% に変換 (中点 5.0 → 50%)。欠損は 50% (中央)。 */
export function toPercent(score: number | undefined): number {
  const s = typeof score === "number" ? score : 5;
  return Math.max(0, Math.min(100, Math.round(s * 10)));
}

/**
 * 「寄り」ラベル。value(0-100) の 50 からの偏りで 3 段階に分ける。
 *   |d| <= 7        → ほぼ中央
 *   7 < |d| <= 20   → やや◯◯寄り
 *   |d| > 20        → ◯◯寄り
 */
export function leanLabel(
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

export function axesForLocale(locale: ResultLocale): readonly AxisMeta[] {
  return locale === "ko" ? KO_AXES : AXES;
}
