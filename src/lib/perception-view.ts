// 評価者1人分 (friend_perceptions 1 行) から、相互理解ページの表示データを一括導出する。
// 評価者完了ページ (/evaluate/result) と本人向け個別ページ (/tako/[token]/friend/[perceptionId])
// で共有する「計算ロジック」。スコア計算・タイプ判定・ギャップは perception-analysis 等の
// 既存ロジックをそのまま使い、ここでは表示用の文字列/データに束ねるだけ (意味は不変)。

import { classifySixteenType, sixteenTypes, characterImagePath } from "./sixteen-types";
import { isThirtyTwoEnabled } from "./feature-flags";
import {
  classifyThirtyTwoType,
  perceivedManualFor,
  perceivedContentFor,
  perceivedTipsKeyFor,
  thirtyTwoName,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoOneLiner,
  thirtyTwoGroup,
} from "./thirty-two-types";
import type { ThirtyTwoGroup } from "./thirty-two-content/character-32";
import { heroColorsForGroup } from "./hero-colors";
import { preferCutImage } from "./character-image";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  topGaps,
  type BigFiveScores,
  type DimensionGap,
} from "./perception-analysis";
import { gapDir3 } from "./perception-gap-detail";
import {
  relationGapNote,
  relationGapTip,
  relationGapFact,
  relationGapTipKey,
} from "./perception-relation-content";
import { getPerceivedContent } from "./mutual-result-content";
import {
  weaveFound,
  seedFromTypeId,
  type FoundParagraph,
} from "./perception-found-text";
import {
  perceivedManualContent,
  PERCEIVED_TIPS_KEY,
} from "./perception-manual-content";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import {
  KO_PERCEIVED_BY_TYPE_32,
  KO_SELF_RESULT_CONTENT_32,
} from "@/i18n/ko/me-content-32";
import type { ResultLocale } from "@/i18n/result";
import { estimateCompatFromGaps } from "./tako-deepdive";

export interface PerceptionViewInput {
  /** 本人 (評価対象者) の自己スコア。 */
  selfScores: BigFiveScores;
  /** その友達が付けた perceived_scores。 */
  otherScores: BigFiveScores;
  /** 評価者ニックネーム。 */
  perceiverName: string | null;
  /** 本人の表示名。 */
  ownerDisplayName: string | null;
  /** 本人の owner_token (「自分のトリセツに戻る」用)。 */
  ownerToken: string | null;
  /** おまけ3問の自由回答。 */
  qualitative: Record<string, string> | null;
  locale?: ResultLocale;
}

export interface PerceptionView {
  mutual: number;
  gaps: DimensionGap[];
  sortedGaps: DimensionGap[];
  displayName: string;
  perceiverFull: string;
  myTrisetsuUrl: string;
  // ヒーロー
  dispEssence: string;
  perceivedTypeName: string;
  dispDesc: string;
  dispImageCut: string;
  heroBg: string;
  codeTint: string;
  /** その友達が見たタイプのグループ (sky/land/sea/unknown)。グループ別挿絵の解決に使う。 */
  perceivedGroup: ThirtyTwoGroup;
  // 本文
  perceivedLookBody: string;
  perceivedTipsBody: string | undefined;
  strengthParas: FoundParagraph[];
  surpriseParas: FoundParagraph[];
  hasFound: boolean;
  // ④ 関係性
  relationFactBody: string;
  relationGapBody: string;
  relationTipBody: string;
  relationTipKey: string;
  tipsKey: string;
  // おまけ3問
  qualEntries: { label: string; value: string }[];
}

export function buildPerceptionView(input: PerceptionViewInput): PerceptionView {
  const { selfScores, otherScores } = input;
  const locale = input.locale ?? "ja";
  const isKo = locale === "ko";
  const koAxisLabels = {
    O: "개방성",
    C: "성실성",
    E: "외향성",
    A: "우호성",
    N: "정서적 민감성",
  } as const;
  const gaps = buildDimensionGaps(selfScores, otherScores).map((gap) =>
    isKo ? { ...gap, label: koAxisLabels[gap.key] } : gap,
  );
  const mutual = calcMutualUnderstanding(gaps);
  const sortedGaps = topGaps(gaps, 5);

  const displayName =
    (input.ownerDisplayName ?? "").trim() || (isKo ? "나" : "あなた");
  const perceiverFull =
    (input.perceiverName ?? "").trim() || (isKo ? "친구" : "友達");
  const myTrisetsuUrl = `${isKo ? "/ko" : ""}/me/${input.ownerToken ?? ""}`;

  const perceivedTypeId = classifySixteenType(otherScores);
  const perceivedType16 = sixteenTypes[perceivedTypeId];
  const flag32 = isKo || isThirtyTwoEnabled();
  const perceived32Id = classifyThirtyTwoType(otherScores);
  const koType = KO_RESULT_TYPES[perceived32Id];

  const perceivedTypeName = isKo
    ? koType.name
    : flag32
      ? thirtyTwoName(perceived32Id)
      : perceivedType16.name;
  const dispEssence = isKo
    ? koType.essence
    : flag32
      ? thirtyTwoEssence(perceived32Id)
      : perceivedType16.essence;
  const dispImage = flag32
    ? thirtyTwoImagePath(perceived32Id)
    : characterImagePath(perceivedTypeId);
  const dispDesc = isKo
    ? koType.oneLiner
    : flag32
      ? thirtyTwoOneLiner(perceived32Id)
      : perceivedType16.oneLiner;
  const perceivedGroup: ThirtyTwoGroup = flag32
    ? thirtyTwoGroup(perceived32Id)
    : "unknown";
  const hero = heroColorsForGroup(perceivedGroup);
  const dispImageCut = preferCutImage(dispImage);

  const perceivedManual = isKo
    ? KO_SELF_RESULT_CONTENT_32[perceived32Id]?.[0]?.body ??
      "친구의 눈에 비친 모습에는 스스로 미처 알아차리지 못한 장점이 담겨 있어요."
    : flag32
      ? perceivedManualFor(perceived32Id)
      : perceivedManualContent[perceivedTypeId];
  const [perceivedLookBody, perceivedTipsBody] = perceivedManual.split("\n\n");

  const foundContent = isKo
    ? KO_PERCEIVED_BY_TYPE_32[perceived32Id]
    : flag32
      ? perceivedContentFor(perceived32Id)
      : getPerceivedContent(perceivedTypeId);
  const foundSeed = seedFromTypeId(perceivedTypeId);
  const strengthParas = foundContent
    ? isKo
      ? foundContent.strengths.slice(0, 3).map((item) => [
          { text: `${item.title}. `, pink: true },
          { text: item.body },
        ])
      : weaveFound(foundContent.strengths, "strengths", foundSeed, perceivedTypeId)
    : [];
  const surpriseParas = foundContent
    ? isKo
      ? foundContent.surprises.slice(0, 3).map((item) => [
          { text: `${item.title}. `, pink: true },
          { text: item.body },
        ])
      : weaveFound(foundContent.surprises, "surprises", foundSeed + 1)
    : [];

  const maxGap = sortedGaps[0];
  const maxGapDir = gapDir3(maxGap.selfPercent, maxGap.otherPercent);
  const koRelation = isKo
    ? estimateCompatFromGaps(
        selfScores,
        otherScores,
        perceiverFull === "친구" ? perceiverFull : `${perceiverFull}님`,
        "ko",
      )
    : null;
  const koRelationMiddle = koRelation?.summaryParas.slice(1, -1).join(" ") ?? "";
  const relationFactBody = isKo
    ? koRelation?.summaryParas[0] ?? "두 사람이 서로를 바라보는 방식에는 특별한 장점이 있어요."
    : relationGapFact[maxGap.key][maxGapDir];
  const relationGapBody = isKo
    ? koRelationMiddle || "서로 다른 시선은 틀림이 아니라 새로운 모습을 발견할 기회예요."
    : relationGapNote[maxGap.key][maxGapDir];
  const relationTipBody = isKo
    ? koRelation?.summaryParas.at(-1) ?? "차이를 편하게 이야기할수록 관계는 더 깊어질 수 있어요."
    : relationGapTip[maxGap.key][maxGapDir];
  const relationTipKey = isKo ? "" : relationGapTipKey[maxGap.key][maxGapDir];
  const tipsKey = isKo
    ? ""
    : flag32
      ? perceivedTipsKeyFor(perceived32Id)
      : PERCEIVED_TIPS_KEY[perceivedTypeId];

  const q = input.qualitative;
  const qualEntries = (
    [
      { label: isKo ? "좋아하는 점" : "好きなところ", value: q?.favorite_point },
      { label: isKo ? "동물로 비유하면" : "動物にたとえると", value: q?.animal },
      { label: isKo ? "인상적인 장면" : "印象的なシーン", value: q?.impression_scene },
    ] as { label: string; value: string | undefined }[]
  ).filter(
    (e): e is { label: string; value: string } =>
      typeof e.value === "string" && e.value.trim().length > 0,
  );

  return {
    mutual,
    gaps,
    sortedGaps,
    displayName,
    perceiverFull,
    myTrisetsuUrl,
    dispEssence,
    perceivedTypeName,
    dispDesc,
    dispImageCut,
    perceivedGroup,
    heroBg: hero.heroBg,
    codeTint: hero.codeTint,
    perceivedLookBody,
    perceivedTipsBody,
    strengthParas,
    surpriseParas,
    hasFound: !!foundContent,
    relationFactBody,
    relationGapBody,
    relationTipBody,
    relationTipKey,
    tipsKey,
    qualEntries,
  };
}
