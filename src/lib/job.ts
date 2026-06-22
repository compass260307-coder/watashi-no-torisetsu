// 動物＋職業システムの「職業」ロジック。
//
// 職業は他者評価 (友達3人以上) の 5 軸平均スコアから決まる。
//   - 最も中立点から離れている軸を選び、その方向 (高/低) の職業にする。
//   - 友達3人未満は職業未定 (null)。
//
// ⚠️ 職業名・一言は「仮」。後で差し替えるため JOBS 定数 1 箇所に集約している。

import type { BigFiveDimension } from "./types";

export type JobDirection = "high" | "low";

export interface Job {
  id: string;
  /** 職業名 (仮・差し替え可)。 */
  name: string;
  /** 一言 (仮・差し替え可)。 */
  oneLiner: string;
  /** tabler アイコンのクラス名 (例 "ti-news")。 */
  icon: string;
  /** 決定軸。 */
  axis: BigFiveDimension;
  /** 軸の方向。 */
  direction: JobDirection;
}

// 10 職業の定義。名前・一言・アイコンはここだけ直せば全画面に反映される (仮の内容)。
export const JOBS = {
  sales: {
    id: "sales",
    name: "営業",
    oneLiner: "人を巻き込む力がある",
    icon: "ti-businessplan",
    axis: "E",
    direction: "high",
  },
  writer: {
    id: "writer",
    name: "作家",
    oneLiner: "ひとりの世界を深く耕す",
    icon: "ti-pencil",
    axis: "E",
    direction: "low",
  },
  nurse: {
    id: "nurse",
    name: "看護師",
    oneLiner: "誰かのために動ける",
    icon: "ti-heart-handshake",
    axis: "A",
    direction: "high",
  },
  revolutionary: {
    id: "revolutionary",
    name: "革命家",
    oneLiner: "常識を疑い、こわす",
    icon: "ti-flame",
    axis: "A",
    direction: "low",
  },
  reporter: {
    id: "reporter",
    name: "記者",
    oneLiner: "気になったら聞かずにいられない",
    icon: "ti-news",
    axis: "O",
    direction: "high",
  },
  mechanic: {
    id: "mechanic",
    name: "整備士",
    oneLiner: "確かなものを、確実に",
    icon: "ti-tool",
    axis: "O",
    direction: "low",
  },
  secretary: {
    id: "secretary",
    name: "秘書",
    oneLiner: "段取りで支える",
    icon: "ti-checklist",
    axis: "C",
    direction: "high",
  },
  traveler: {
    id: "traveler",
    name: "旅人",
    oneLiner: "その時の風まかせ",
    icon: "ti-walk",
    axis: "C",
    direction: "low",
  },
  poet: {
    id: "poet",
    name: "詩人",
    oneLiner: "揺れるからこそ、感じ取れる",
    icon: "ti-feather",
    axis: "N",
    direction: "high",
  },
  captain: {
    id: "captain",
    name: "船長",
    oneLiner: "動じず、舵を取る",
    icon: "ti-anchor",
    axis: "N",
    direction: "low",
  },
} as const satisfies Record<string, Job>;

export type JobId = keyof typeof JOBS;

// perceived_scores のレンジは 0-10 (Phase 0 確認)。中立点は中央の 5.0。
export const JOB_SCORE_MIDPOINT = 5;

// 職業が判明する友達評価人数の閾値 (課金なしの人数ゲート、ロック解除と同条件)。
export const JOB_FRIEND_THRESHOLD = 3;

// タイブレーク順 (偏差が同値のとき先頭の軸を採用)。
const AXIS_PRIORITY: BigFiveDimension[] = ["E", "A", "O", "C", "N"];

// 軸 × 方向 → Job の逆引きテーブル (JOBS から生成)。
const AXIS_DIR_TO_JOB: Record<
  BigFiveDimension,
  Record<JobDirection, Job>
> = (() => {
  const m = {} as Record<BigFiveDimension, Record<JobDirection, Job>>;
  for (const job of Object.values(JOBS) as Job[]) {
    (m[job.axis] ??= {} as Record<JobDirection, Job>)[job.direction] = job;
  }
  return m;
})();

/**
 * 他者評価の 5 軸平均から職業を決定する。
 *
 * @param perceivedAvgScores 友達3人以上の perceived_scores を軸ごとに平均した値 (0-10)。
 *                           欠損軸は中立点 (5) 扱い。null は職業未定。
 * @param friendCount 友達評価人数。
 * @returns 職業 (Job)。friendCount < 閾値 / データ無しは null (職業未定)。
 */
export function computeJob(
  perceivedAvgScores: Partial<Record<BigFiveDimension, number>> | null,
  friendCount: number,
): Job | null {
  if (friendCount < JOB_FRIEND_THRESHOLD) return null;
  if (!perceivedAvgScores) return null;

  let best: { axis: BigFiveDimension; dev: number; score: number } | null = null;
  for (const axis of AXIS_PRIORITY) {
    const raw = perceivedAvgScores[axis];
    const score = typeof raw === "number" ? raw : JOB_SCORE_MIDPOINT;
    const dev = Math.abs(score - JOB_SCORE_MIDPOINT);
    // 厳密に大きいときだけ更新 → 偏差同値は AXIS_PRIORITY 先頭が残る (タイブレーク)。
    if (best === null || dev > best.dev) {
      best = { axis, dev, score };
    }
  }
  if (!best) return null;

  const direction: JobDirection =
    best.score >= JOB_SCORE_MIDPOINT ? "high" : "low";
  return AXIS_DIR_TO_JOB[best.axis][direction];
}
