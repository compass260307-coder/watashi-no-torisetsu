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
  const gaps = buildDimensionGaps(selfScores, otherScores);
  const mutual = calcMutualUnderstanding(gaps);
  const sortedGaps = topGaps(gaps, 5);

  const displayName = (input.ownerDisplayName ?? "").trim() || "アナタ";
  const perceiverFull = (input.perceiverName ?? "").trim() || "友達";
  const myTrisetsuUrl = `/me/${input.ownerToken ?? ""}`;

  const perceivedTypeId = classifySixteenType(otherScores);
  const perceivedType16 = sixteenTypes[perceivedTypeId];
  const flag32 = isThirtyTwoEnabled();
  const perceived32Id = classifyThirtyTwoType(otherScores);

  const perceivedTypeName = flag32
    ? thirtyTwoName(perceived32Id)
    : perceivedType16.name;
  const dispEssence = flag32
    ? thirtyTwoEssence(perceived32Id)
    : perceivedType16.essence;
  const dispImage = flag32
    ? thirtyTwoImagePath(perceived32Id)
    : characterImagePath(perceivedTypeId);
  const dispDesc = flag32
    ? thirtyTwoOneLiner(perceived32Id)
    : perceivedType16.oneLiner;
  const perceivedGroup: ThirtyTwoGroup = flag32
    ? thirtyTwoGroup(perceived32Id)
    : "unknown";
  const hero = heroColorsForGroup(perceivedGroup);
  const dispImageCut = preferCutImage(dispImage);

  const [perceivedLookBody, perceivedTipsBody] = (
    flag32
      ? perceivedManualFor(perceived32Id)
      : perceivedManualContent[perceivedTypeId]
  ).split("\n\n");

  const foundContent = flag32
    ? perceivedContentFor(perceived32Id)
    : getPerceivedContent(perceivedTypeId);
  const foundSeed = seedFromTypeId(perceivedTypeId);
  const strengthParas = foundContent
    ? weaveFound(foundContent.strengths, "strengths", foundSeed, perceivedTypeId)
    : [];
  const surpriseParas = foundContent
    ? weaveFound(foundContent.surprises, "surprises", foundSeed + 1)
    : [];

  const maxGap = sortedGaps[0];
  const maxGapDir = gapDir3(maxGap.selfPercent, maxGap.otherPercent);
  const relationFactBody = relationGapFact[maxGap.key][maxGapDir];
  const relationGapBody = relationGapNote[maxGap.key][maxGapDir];
  const relationTipBody = relationGapTip[maxGap.key][maxGapDir];
  const relationTipKey = relationGapTipKey[maxGap.key][maxGapDir];
  const tipsKey = flag32
    ? perceivedTipsKeyFor(perceived32Id)
    : PERCEIVED_TIPS_KEY[perceivedTypeId];

  const q = input.qualitative;
  const qualEntries = (
    [
      { label: "好きなところ", value: q?.favorite_point },
      { label: "動物にたとえると", value: q?.animal },
      { label: "印象的なシーン", value: q?.impression_scene },
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
