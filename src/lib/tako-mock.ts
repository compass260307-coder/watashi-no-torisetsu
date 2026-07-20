// /tako と /tako-report のプレビュー用モックデータ (dev / fromPreview=1 のみ)。
// 実 compute 関数を流用して現実的な描画にする。実DBは介さない。
// 2026-07-21: /tako/[token]/page.tsx から移動 (完全版レポートのプレビューでも使うため)。

import type { OwnerReportData } from "./owner-report-data";
import { computeMinnaNoMeContext } from "./minna-no-me";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "./perception-analysis";
import { REPORT_FRIEND_THRESHOLD } from "./report-data";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoName,
  thirtyTwoImagePath,
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "./thirty-two-types";
import { preferCutImage } from "./character-image";
import { sixteenTypes } from "./sixteen-types";
import { resolveSiteUrl } from "./site-url";
import type { BigFiveDimension } from "./types";

const SITE_URL = resolveSiteUrl();

// ?previewType=<32タイプID> 指定時のモック解除後データ (dev / fromPreview=1 のみ)。実DBは介さない。
// /me のプレビュー機構と同型。実 compute 関数を流用して現実的な描画にする。
export function mockTakoData(previewType: ThirtyTwoTypeId): OwnerReportData {
  const code = sixteenTypes[baseIdOf(previewType)].code;
  const hi = (ax: string) => (code.includes(`${ax}＋`) ? 8 : 2);
  const selfScores = {
    O: hi("O"),
    C: hi("C"),
    E: hi("E"),
    A: hi("A"),
    N: nAxisOf(previewType) === "N" ? 8 : 2,
  };
  // 友達3人: 本人スコアを少しずらして「自己認知ギャップ」が見えるように。
  const shifts: Record<string, number>[] = [
    { E: 2, O: -2 },
    { E: 1, A: 1 },
    { E: 3, N: -2 },
  ];
  const clamp = (v: number) => Math.max(0, Math.min(10, v));
  const mockOwnTypes: (ThirtyTwoTypeId | null)[] = [
    "whim-fox__N" as ThirtyTwoTypeId,
    "quiet-owl__N" as ThirtyTwoTypeId,
    null, // はる = 未診断 (④相性のティザー状態を確認できるように)
  ];
  const friends = shifts.map((s, i) => ({
    name: ["ゆい", "そら", "はる"][i],
    perceivedScores: Object.fromEntries(
      (["O", "C", "E", "A", "N"] as const).map((k) => [
        k,
        clamp(selfScores[k] + (s[k] ?? 0)),
      ]),
    ) as Record<string, number>,
    qualitative: null,
  }));
  const friendAvgScores = Object.fromEntries(
    (["O", "C", "E", "A", "N"] as const).map((k) => [
      k,
      friends.reduce((a, f) => a + (f.perceivedScores[k] as number), 0) /
        friends.length,
    ]),
  ) as Partial<Record<BigFiveDimension, number>>;
  const t = classifyThirtyTwoType(friendAvgScores);
  return {
    user: {
      id: "preview",
      type_id: null,
      scores: selfScores,
      display_name: "プレビュー",
      invite_code: "preview",
      owner_token: "preview",
    },
    selfScores,
    friendEvalCount: friends.length,
    friendAvgScores,
    friendNames: friends.map((f) => f.name),
    friendMessages: [
      { name: "ゆい", message: "いつも冷静で頼れる。周りをよく見てるよね。" },
      { name: "そら", message: "自分の考えをちゃんと持ってて素敵だと思う！" },
    ],
    friends: friends
      .map((f, i) => {
        const message =
          f.name === "ゆい"
            ? "いつも冷静で頼れる。周りをよく見てるよね。会うたびに落ち着くわ〜"
            : f.name === "そら"
              ? "自分の考えをちゃんと持ってて素敵だと思う！"
              : "";
        return {
          perceptionId: `preview-${i}`,
          name: f.name,
          perceivedScores: f.perceivedScores as Partial<
            Record<BigFiveDimension, number>
          >,
          mutual: calcMutualUnderstanding(
            buildDimensionGaps(selfScores, f.perceivedScores as BigFiveScores),
          ),
          hasMessage: message.length > 0,
          message,
          perceivedType32: null,
          perceivedImageSrc: null,
          perceiverUserId: mockOwnTypes[i] ? `preview-user-${i}` : null,
          friendOwnType32: mockOwnTypes[i],
        };
      })
      .sort((a, b) => b.mutual - a.mutual),
    minnaContext: computeMinnaNoMeContext({ selfScores, friends }),
    pendingFriendCount: 0,
    inviteCode: "preview",
    inviteUrl: `${SITE_URL}/friend/preview`,
    threshold: REPORT_FRIEND_THRESHOLD,
    unlocked: true,
    friendCharacter: {
      type32: t,
      essence: thirtyTwoEssence(t),
      name: thirtyTwoName(t),
      imageSrc: preferCutImage(thirtyTwoImagePath(t)),
      previewPath: `/preview/${t}`,
    },
    ownerType32: classifyThirtyTwoType(selfScores),
  };
}
