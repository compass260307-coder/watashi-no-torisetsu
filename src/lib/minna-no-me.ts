// 「みんなの目」タブの純粋ロジック (AI 非依存)。
//   - 友達の perceived_scores を平均 → classifyThirtyTwoType で「みんなから見たタイプ」
//   - 自己スコアと友達平均の「最大乖離軸」を特定し、数値を出さない定型文に変換
//   - 好きなところ (favorite_point) / 動物 (animal) を素材として整形
// ページ (表示用 props) と API/生成 (プロンプト材料) の両方から使う。
// ⚠ 画面には数値を一切出さない。数値は AI プロンプトの入力にのみ渡す。

import type { BigFiveDimension } from "./types";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoName,
  type ThirtyTwoTypeId,
} from "./thirty-two-types";

const DIMS: BigFiveDimension[] = ["E", "A", "O", "C", "N"];

// 軸ごと・方向ごとの「数値を出さない」ギャップ定型文。
// higher = 友達平均が自己より高い (周りはもっと〜と見ている)。
// lower  = 友達平均が自己より低い (周りはもっと〜な側と見ている)。
const GAP_SENTENCE: Record<
  BigFiveDimension,
  { higher: string; lower: string }
> = {
  E: {
    higher:
      "あなたが思うより、周りはあなたを『人の輪に自然と入っていける人』として見ているみたい。",
    lower:
      "あなたが思うより、周りはあなたを『静けさを大事にできる人』として見ているみたい。",
  },
  A: {
    higher:
      "あなたが思うより、周りはあなたを『まわりを立てられる優しい人』として見ているみたい。",
    lower:
      "あなたが思うより、周りはあなたを少し『自分を持った人』として見ているみたい。",
  },
  O: {
    higher:
      "あなたが思うより、周りはあなたを『新しいものに開かれた人』として見ているみたい。",
    lower:
      "あなたが思うより、周りはあなたを『地に足のついた人』として見ているみたい。",
  },
  C: {
    higher:
      "あなたが思うより、周りはあなたを『きちんと物事を進められる人』として見ているみたい。",
    lower:
      "あなたが思うより、周りはあなたを『肩の力の抜けた自由な人』として見ているみたい。",
  },
  N: {
    higher:
      "あなたが思うより、周りはあなたを『人の機微を繊細に拾える人』として見ているみたい。",
    lower:
      "あなたが思うより、周りはあなたを『どっしり構えた安定感のある人』として見ているみたい。",
  },
};

// AI プロンプト用の軸ラベル (数値と併記して渡す。画面表示には使わない)。
export const GAP_AXIS_LABEL: Record<BigFiveDimension, string> = {
  E: "外向性",
  A: "協調性",
  O: "開放性",
  C: "誠実性",
  N: "繊細さ",
};

export type MinnaFriendInput = {
  name: string;
  perceivedScores: Record<string, unknown> | null;
  qualitative: Record<string, unknown> | null;
};

export type MinnaNoMeContext = {
  friendAvgScores: Partial<Record<BigFiveDimension, number>>;
  selfType32: ThirtyTwoTypeId;
  friendType32: ThirtyTwoTypeId;
  selfEssence: string;
  friendEssence: string;
  friendTypeName: string;
  friendPreviewPath: string; // /preview/{id}
  matched: boolean;
  // 表示用 (数値なし)
  gapSentence: string | null;
  // AI プロンプト用 (数値あり・画面には出さない)
  topGapAxis: BigFiveDimension | null;
  gapDirection: "higher" | "lower" | null;
  selfVal: number | null;
  friendVal: number | null;
  favoritePoints: string[];
  animals: string[];
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 友達全員の perceived_scores を軸ごとに平均 (数値のある行だけ母数)。0 件なら null。 */
export function averageFriendScores(
  friends: MinnaFriendInput[],
): Partial<Record<BigFiveDimension, number>> | null {
  if (friends.length === 0) return null;
  const acc: Record<BigFiveDimension, { sum: number; n: number }> = {
    E: { sum: 0, n: 0 },
    A: { sum: 0, n: 0 },
    O: { sum: 0, n: 0 },
    C: { sum: 0, n: 0 },
    N: { sum: 0, n: 0 },
  };
  for (const f of friends) {
    const ps = (f.perceivedScores ?? {}) as Record<string, unknown>;
    for (const d of DIMS) {
      const v = num(ps[d]);
      if (v !== null) {
        acc[d].sum += v;
        acc[d].n += 1;
      }
    }
  }
  const avg: Partial<Record<BigFiveDimension, number>> = {};
  for (const d of DIMS) if (acc[d].n > 0) avg[d] = acc[d].sum / acc[d].n;
  return Object.keys(avg).length > 0 ? avg : null;
}

/**
 * 「みんなの目」表示・生成に必要な文脈をまとめて算出する純粋関数。
 * friends が 0 件 or 友達平均が算出不能なら null。
 */
export function computeMinnaNoMeContext(input: {
  selfScores: Partial<Record<BigFiveDimension, number>>;
  friends: MinnaFriendInput[];
}): MinnaNoMeContext | null {
  const friendAvg = averageFriendScores(input.friends);
  if (!friendAvg) return null;

  const selfType32 = classifyThirtyTwoType(input.selfScores);
  const friendType32 = classifyThirtyTwoType(friendAvg);
  const matched = selfType32 === friendType32;

  // 最大乖離軸: 自己・友達平均どちらも数値がある軸で |self - friend| 最大。
  let topGapAxis: BigFiveDimension | null = null;
  let gapDirection: "higher" | "lower" | null = null;
  let selfVal: number | null = null;
  let friendVal: number | null = null;
  let maxDiff = -1;
  for (const d of DIMS) {
    const s = num(input.selfScores[d]);
    const f = num(friendAvg[d]);
    if (s === null || f === null) continue;
    const diff = Math.abs(s - f);
    if (diff > maxDiff) {
      maxDiff = diff;
      topGapAxis = d;
      gapDirection = f >= s ? "higher" : "lower";
      selfVal = s;
      friendVal = f;
    }
  }
  const gapSentence =
    topGapAxis && gapDirection ? GAP_SENTENCE[topGapAxis][gapDirection] : null;

  // 好きなところ / 動物 の素材抽出 (空・欠損は除外)。
  const favoritePoints: string[] = [];
  const animals: string[] = [];
  for (const f of input.friends) {
    const q = (f.qualitative ?? {}) as Record<string, unknown>;
    const fav = typeof q.favorite_point === "string" ? q.favorite_point.trim() : "";
    if (fav) favoritePoints.push(fav);
    const an = typeof q.animal === "string" ? q.animal.trim() : "";
    if (an) animals.push(an);
  }

  return {
    friendAvgScores: friendAvg,
    selfType32,
    friendType32,
    selfEssence: thirtyTwoEssence(selfType32),
    friendEssence: thirtyTwoEssence(friendType32),
    friendTypeName: thirtyTwoName(friendType32),
    friendPreviewPath: `/preview/${friendType32}`,
    matched,
    gapSentence,
    topGapAxis,
    gapDirection,
    selfVal,
    friendVal,
    favoritePoints,
    animals,
  };
}

// ─── 「みんなの言葉」空状態フォールバック (B-1) ───────────────────────────
// 友達の質的入力 (owner_message=手紙 / favorite_point=チップ) が両方空のとき、
// second self のスコア (friend-average Big Five, 0-10 スケール) から読んだ印象を
// 1 行返す純ルールベース (LLM 非依存)。本物の手紙とは別枠・別ラベルで出す想定。

// スコアの中央値。perceived_scores は 0-10 スケールで、既存 classify と同じ中央 5.0。
const MINNA_SCORE_CENTER = 5.0;
// 発火の最小偏差 = フルレンジ (10) の約 8%。これ未満のフラットさなら FINAL_FALLBACK。
// ★調整ノブ: 大きくするほど「はっきり出た軸」だけ拾い、FINAL_FALLBACK が増える。
const MINNA_SCORE_THRESHOLD = 0.8;

// 軸の評価順 (固定。同点はこの順で先勝ち)。※ 通常の DIMS (E,A,O,C,N) とは別順。
const MINNA_SCORE_AXES: BigFiveDimension[] = ["O", "C", "E", "A", "N"];

const MINNA_SCORE_TABLE: Record<
  BigFiveDimension,
  { high: string; low: string }
> = {
  O: {
    high: "新しいものや面白い視点に、まっさきに反応する人だと映ってるみたい。",
    low: "地に足のついた、安心して頼れる人だと見られてるみたい。",
  },
  C: {
    high: "やると決めたことをちゃんとやりきる人だと思われてるみたい。",
    low: "その場の流れを楽しめる、しなやかな人だと映ってるみたい。",
  },
  E: {
    high: "一緒にいると場が明るくなる人だと感じられてるみたい。",
    low: "静かに深くつながれる人だと見られてるみたい。",
  },
  A: {
    high: "まず相手の気持ちを考えられる、やさしい人だと映ってるみたい。",
    low: "自分の芯を持って正直に向き合う人だと思われてるみたい。",
  },
  N: {
    high: "人の痛みに気づける、繊細なアンテナを持つ人だと見られてるみたい。",
    low: "どっしり構えて、まわりを安心させる人だと映ってるみたい。",
  },
};

const MINNA_SCORE_FINAL_FALLBACK =
  "まだ言葉は届いてないけど、みんなの目に映るあなたが、少しずつ形になってきてるよ。";

/**
 * second self スコアから「スコアから見えるあなた」1 行を返す (純ルールベース)。
 * 手紙/チップが両方空のときだけ呼ぶ想定。最大乖離軸が中央からフラット (< THRESHOLD)
 * or スコアが皆無なら FINAL_FALLBACK。スケールは friendAvgScores と同一 (再正規化なし)。
 */
export function scoreImpressionLine(
  scores: Partial<Record<BigFiveDimension, number>>,
): string {
  let best: BigFiveDimension | null = null;
  let bestDev = -1;
  for (const axis of MINNA_SCORE_AXES) {
    const v = scores[axis];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const dev = Math.abs(v - MINNA_SCORE_CENTER);
    if (dev > bestDev) {
      bestDev = dev; // 厳密 > なので同点は MINNA_SCORE_AXES の先頭が勝つ
      best = axis;
    }
  }
  if (!best || bestDev < MINNA_SCORE_THRESHOLD) {
    return MINNA_SCORE_FINAL_FALLBACK;
  }
  const level = (scores[best] as number) >= MINNA_SCORE_CENTER ? "high" : "low";
  return MINNA_SCORE_TABLE[best][level];
}
