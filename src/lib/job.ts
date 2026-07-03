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
  /** tabler アイコンのクラス名 (例 "ti-news")。将来アイコンライブラリ導入時用に温存。 */
  icon: string;
  /** バッジ描画用の絵文字 (アイコンライブラリ未導入のため現状はこれを表示)。 */
  emoji: string;
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
    emoji: "💼",
    axis: "E",
    direction: "high",
  },
  writer: {
    id: "writer",
    name: "作家",
    oneLiner: "ひとりの世界を深く耕す",
    icon: "ti-pencil",
    emoji: "✍️",
    axis: "E",
    direction: "low",
  },
  nurse: {
    id: "nurse",
    name: "看護師",
    oneLiner: "誰かのために動ける",
    icon: "ti-heart-handshake",
    emoji: "🩺",
    axis: "A",
    direction: "high",
  },
  revolutionary: {
    id: "revolutionary",
    name: "革命家",
    oneLiner: "常識を疑い、こわす",
    icon: "ti-flame",
    emoji: "🔥",
    axis: "A",
    direction: "low",
  },
  reporter: {
    id: "reporter",
    name: "記者",
    oneLiner: "気になったら聞かずにいられない",
    icon: "ti-news",
    emoji: "📰",
    axis: "O",
    direction: "high",
  },
  mechanic: {
    id: "mechanic",
    name: "整備士",
    oneLiner: "確かなものを、確実に",
    icon: "ti-tool",
    emoji: "🔧",
    axis: "O",
    direction: "low",
  },
  secretary: {
    id: "secretary",
    name: "秘書",
    oneLiner: "段取りで支える",
    icon: "ti-checklist",
    emoji: "📋",
    axis: "C",
    direction: "high",
  },
  traveler: {
    id: "traveler",
    name: "旅人",
    oneLiner: "その時の風まかせ",
    icon: "ti-walk",
    emoji: "🎒",
    axis: "C",
    direction: "low",
  },
  poet: {
    id: "poet",
    name: "詩人",
    oneLiner: "揺れるからこそ、感じ取れる",
    icon: "ti-feather",
    emoji: "🪶",
    axis: "N",
    direction: "high",
  },
  captain: {
    id: "captain",
    name: "船長",
    oneLiner: "動じず、舵を取る",
    icon: "ti-anchor",
    emoji: "⚓",
    axis: "N",
    direction: "low",
  },
} as const satisfies Record<string, Job>;

export type JobId = keyof typeof JOBS;

// perceived_scores のレンジは 0-10 (Phase 0 確認)。中立点は中央の 5.0。
export const JOB_SCORE_MIDPOINT = 5;

// 職業が判明する友達評価人数の閾値 (課金なしの人数ゲート、ロック解除と同条件)。
export const JOB_FRIEND_THRESHOLD = 3;

// 職業単体の説明 (仮・差し替え / AI 生成置換前提)。「その職業がどんな人か」を 1〜2 文で。
// ⚠️ 文言はすべて仮。職業ごとにここだけ直せば章②の表示に反映される。
export const JOB_DESCRIPTION: Record<JobId, string> = {
  sales:
    "気づけば輪の真ん中にいる人。場の空気を温めて、初対面でも人を巻き込んでいく。",
  writer:
    "ひとりの時間で力を発揮する人。口数より、内側に持っている世界のほうが深い。",
  nurse:
    "人の小さな変化に気づく人。困っている人を放っておけず、自然と支える側に回る。",
  revolutionary:
    "流れに乗らない人。みんなが頷く場面でも、違うと思えばはっきり言える。",
  reporter:
    "好奇心が止まらない人。気になったら聞かずにいられないし、新しいものに迷わず飛び込む。",
  mechanic:
    "派手さより確実さの人。慣れたやり方を大事に、任されたことを手堅くこなす。",
  secretary:
    "段取りのいい人。約束を守って抜け漏れなく、気づけば周りの予定まで整えている。",
  traveler: "計画より直感の人。決めすぎず、その時の気分と流れに乗っていく。",
  poet: "感受性が豊かな人。心が揺れるぶん、人の機微や小さな変化によく気づく。",
  captain:
    "動じない人。何があっても落ち着いていて、まわりが慌てる時ほど頼りになる。",
};

// 動物(自己) × 職業(他者) の統合解説 (仮・差し替え / AI 生成置換前提)。
// 職業ごとに 1 パターンの汎用テンプレートを持ち、{animal} に動物名を差し込むだけ。
// 動物固有の作り込みは後で AI 生成に回す前提 (まずは職業名 + ギャップ文を固定)。
export const JOB_INTEGRATION: Record<JobId, string> = {
  sales:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「営業」——自分のペースで過ごしているつもりが、外からは場を温めて人を巻き込む力に見えている。その自覚とのズレこそ、アナタの魅力です。",
  writer:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「作家」——静かに過ごす時間が、外からは内側に深い世界を耕す力に見えている。その自覚とのズレこそ、アナタの魅力です。",
  nurse:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「看護師」——何気ない気づかいが、外からは人の小さな変化を見逃さない優しさに見えている。その自覚とのズレこそ、アナタの魅力です。",
  revolutionary:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「革命家」——素直に感じた違和感が、外からは流れに飲まれずに言い切る強さに見えている。その自覚とのズレこそ、アナタの魅力です。",
  reporter:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「記者」——内向きの好奇心が、外からは聞き出して広める力に見えている。その自覚とのズレこそ、アナタの魅力です。",
  mechanic:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「整備士」——目立たない丁寧さが、外からは任せれば確実という安心感に見えている。その自覚とのズレこそ、アナタの魅力です。",
  secretary:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「秘書」——自然にしている段取りが、外からは周りの予定まで整える気くばりに見えている。その自覚とのズレこそ、アナタの魅力です。",
  traveler:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「旅人」——その時々の気分で選ぶ身軽さが、外からは流れに乗っていく軽やかさに見えている。その自覚とのズレこそ、アナタの魅力です。",
  poet: "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「詩人」——心の揺れやすさが、外からは機微を感じ取る豊かさに見えている。その自覚とのズレこそ、アナタの魅力です。",
  captain:
    "自分では「{animal}」だと思っていたアナタ。でも友達から見たアナタは「船長」——いつも通りの落ち着きが、外からは何があっても動じない頼もしさに見えている。その自覚とのズレこそ、アナタの魅力です。",
};

/** 職業単体の説明を返す (仮・JOB_DESCRIPTION から)。 */
export function getJobDescription(job: Job): string {
  return JOB_DESCRIPTION[job.id as JobId];
}

/** 動物 × 職業の統合解説を返す。テンプレートの {animal} を動物名で置換 (仮・JOB_INTEGRATION から)。 */
export function formatJobIntegration(job: Job, animal: string): string {
  return JOB_INTEGRATION[job.id as JobId].replaceAll("{animal}", animal);
}

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
