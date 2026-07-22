import type { Metadata } from "next";
import { MBTI_CODE_TO_THIRTYTWO_ID } from "@/lib/love-by-type-32";
import { preferCutImage, preferFaceImage } from "@/lib/character-image";
import { sixteenTypes } from "@/lib/sixteen-types";
import {
  allThirtyTwoTypeIds,
  baseIdOf,
  nAxisOf,
  selfContentFor,
  thirtyTwoCatchphrase,
  thirtyTwoEssence,
  thirtyTwoGroup,
  thirtyTwoImagePath,
  thirtyTwoName,
  thirtyTwoOneLiner,
  thirtyTwoZukanDesc,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import SocialContentLibrary, {
  type SocialCharacter,
} from "./SocialContentLibrary";

export const metadata: Metadata = {
  title: "SNSコンテンツライブラリ",
  description: "社内SNS運用向けの32キャラ素材・性格コピー一覧。",
};

const OCEAN_LABELS = {
  O: { high: "好奇心・柔軟", low: "現実的・堅実" },
  C: { high: "計画的・継続", low: "自由・ひらめき" },
  E: { high: "外向・活発", low: "内向・集中" },
  A: { high: "共感・協調", low: "率直・自立" },
  N: { high: "繊細・敏感", low: "安定・動じない" },
} as const;

const OCEAN_LETTERS = ["O", "C", "E", "A", "N"] as const;

const mbtiByType = Object.entries(MBTI_CODE_TO_THIRTYTWO_ID).reduce(
  (index, [code, typeId]) => {
    index[typeId] = code;
    return index;
  },
  {} as Record<ThirtyTwoTypeId, string>,
);

function oceanFor(id: ThirtyTwoTypeId): SocialCharacter["ocean"] {
  const baseCode = sixteenTypes[baseIdOf(id)].code;
  const flags = OCEAN_LETTERS.map((letter) => {
    const high =
      letter === "N"
        ? nAxisOf(id) === "N"
        : baseCode.includes(`${letter}＋`);

    return {
      letter,
      high,
      label: OCEAN_LABELS[letter][high ? "high" : "low"],
    };
  });

  return {
    code: flags.map(({ letter, high }) => (high ? letter : letter.toLowerCase())).join(""),
    flags,
  };
}

function characterFor(id: ThirtyTwoTypeId): SocialCharacter {
  const mappedCode = mbtiByType[id];
  const [mbti, variantFromMap] = mappedCode.split("_");
  const variant = nAxisOf(id);
  const story = selfContentFor(id)[0];
  const v3Image = thirtyTwoImagePath(id);
  const imageFile = v3Image.slice(v3Image.lastIndexOf("/") + 1);
  const downloadStem = `${mbti}_${variant}_${thirtyTwoEssence(id)}`;

  return {
    id,
    mbti,
    variant: variantFromMap === "N" ? "N" : "R",
    variantLabel: variant === "N" ? "繊細タイプ" : "安定タイプ",
    group: thirtyTwoGroup(id),
    characterName: thirtyTwoEssence(id),
    visualName: thirtyTwoName(id),
    oneLiner: thirtyTwoOneLiner(id),
    catchphrase: thirtyTwoCatchphrase(id),
    shortDescription: thirtyTwoZukanDesc(id),
    ocean: oceanFor(id),
    storyHeading: story?.heading ?? `${thirtyTwoEssence(id)}のトリセツ`,
    storyBody: story?.body ?? thirtyTwoZukanDesc(id),
    normalImage: {
      src: preferCutImage(v3Image),
      fileName: `${downloadStem}_normal.webp`,
      sourceFile: imageFile,
    },
    compatibilityImage: {
      src: preferFaceImage(v3Image),
      fileName: `${downloadStem}_aisho-icon.webp`,
      sourceFile: imageFile,
    },
  };
}

export default function SocialContentPage() {
  const characters = allThirtyTwoTypeIds().map(characterFor);

  return <SocialContentLibrary characters={characters} />;
}
