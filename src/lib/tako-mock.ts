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
import type { ResultLocale } from "@/i18n/result";

const SITE_URL = resolveSiteUrl();

// ?previewType=<32タイプID> 指定時のモック解除後データ (dev / fromPreview=1 のみ)。実DBは介さない。
// /me のプレビュー機構と同型。実 compute 関数を流用して現実的な描画にする。
export function mockTakoData(
  previewType: ThirtyTwoTypeId,
  locale: ResultLocale = "ja",
): OwnerReportData {
  const isKo = locale === "ko";
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
    // E+4: 自己が低E(2)のタイプで 2→6 (60%) になり、④ジョハリの盲点の窓を再現できる。
    { E: 4, N: -2 },
  ];
  const clamp = (v: number) => Math.max(0, Math.min(10, v));
  const mockOwnTypes: (ThirtyTwoTypeId | null)[] = [
    "whim-fox__N" as ThirtyTwoTypeId,
    "quiet-owl__N" as ThirtyTwoTypeId,
    null, // 3人目 = 未診断 (④相性のティザー状態を確認できるように)
  ];
  const friendNames = isKo ? ["지유", "서아", "하린"] : ["ゆい", "そら", "はる"];
  const friendMessages = isKo
    ? [
        "늘 차분하고 믿음직해요. 주변을 정말 잘 보고 있죠.",
        "자기 생각을 분명히 가지고 있는 점이 멋지다고 생각해요!",
      ]
    : [
        "いつも冷静で頼れる。周りをよく見てるよね。",
        "自分の考えをちゃんと持ってて素敵だと思う！",
      ];
  const friends = shifts.map((s, i) => ({
    name: friendNames[i],
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
      display_name: isKo ? "미리보기" : "プレビュー",
      invite_code: "preview",
      owner_token: "preview",
    },
    selfScores,
    friendEvalCount: friends.length,
    friendAvgScores,
    friendNames: friends.map((f) => f.name),
    friendMessages: [
      { name: friendNames[0], message: friendMessages[0] },
      { name: friendNames[1], message: friendMessages[1] },
    ],
    friends: friends
      .map((f, i) => {
        const message =
          i === 0
            ? isKo
              ? "늘 차분하고 믿음직해요. 주변을 정말 잘 보고 있죠. 만날 때마다 마음이 편해져요."
              : "いつも冷静で頼れる。周りをよく見てるよね。会うたびに落ち着くわ〜"
            : i === 1
              ? isKo
                ? "자기 생각을 분명히 가지고 있는 점이 멋지다고 생각해요!"
                : "自分の考えをちゃんと持ってて素敵だと思う！"
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
    inviteUrl: `${SITE_URL}${isKo ? "/ko" : ""}/friend/preview`,
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
