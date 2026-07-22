import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import {
  KO_CAREER_BY_TYPE_32,
  KO_LIKABLE_CLOSING,
  KO_LIKABLE_PROSE,
  KO_LOVE_BY_TYPE_32,
  KO_LOVE_FAIL_CLOSING,
  KO_LOVE_FAIL_PROSE,
  KO_PERCEIVED_BY_TYPE_32,
  KO_RELATION_RULES,
  KO_SCENE_RULES,
  KO_SELF_RESULT_CONTENT_32,
} from "@/i18n/ko/me-content-32";
import type { ResolvedDeepDiveSection } from "@/lib/deep-dive-resolve";
import type { ContentItem } from "@/lib/mutual-result-content";
import type {
  RelationView,
  ResolvedPartTwo,
  SceneCaution,
} from "@/lib/part-two-resolve";
import type { SelfSection } from "@/lib/self-result-content";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

type Scores = Partial<Record<BigFiveDimension, number>>;
type Direction = "high" | "low";
type HighLow = "H" | "L";
type Quad = "HH" | "HL" | "LH" | "LL";

const KO_LOVE_LEAD_PARAGRAPH_COUNT: Record<ThirtyTwoTypeId, number> = {
  "smiley-panda__R": 3,
  "smiley-panda__N": 3,
  "caretaker-dog__R": 3,
  "caretaker-dog__N": 3,
  "brisk-tiger__R": 4,
  "brisk-tiger__N": 3,
  "playful-raccoon__R": 3,
  "playful-raccoon__N": 3,
  "idea-monkey__R": 3,
  "idea-monkey__N": 3,
  "sparkle-dolphin__R": 3,
  "sparkle-dolphin__N": 3,
  "ambition-lion__R": 3,
  "ambition-lion__N": 3,
  "whim-fox__R": 3,
  "whim-fox__N": 3,
  "dreamer-rabbit__R": 3,
  "dreamer-rabbit__N": 3,
  "quiet-owl__R": 3,
  "quiet-owl__N": 3,
  "seeker-wolf__R": 3,
  "seeker-wolf__N": 3,
  "fantasy-cat__R": 3,
  "fantasy-cat__N": 3,
  "gentle-koala__R": 3,
  "gentle-koala__N": 3,
  "earnest-elephant__R": 3,
  "earnest-elephant__N": 3,
  "steady-turtle__R": 3,
  "steady-turtle__N": 3,
  "solo-hedgehog__R": 3,
  "solo-hedgehog__N": 3,
};

const AXIS_NAME: Record<BigFiveDimension, string> = {
  O: "개방성",
  C: "성실성",
  E: "외향성",
  A: "우호성",
  N: "정서적 민감성",
};

const AXIS_STRENGTH: Record<
  BigFiveDimension,
  Record<Direction, { title: string; body: string }>
> = {
  O: {
    high: {
      title: "새로운 가능성을 발견하는 눈",
      body: "익숙한 답에 머무르기보다 새로운 관점과 아이디어를 탐색해요. 남들이 지나친 가능성을 발견하고 이야기를 넓히는 힘이 있어요.",
    },
    low: {
      title: "현실을 단단하게 붙잡는 감각",
      body: "검증된 방법과 구체적인 경험을 믿어요. 복잡한 생각을 실제로 실행할 수 있는 형태로 정리하는 힘이 있어요.",
    },
  },
  C: {
    high: {
      title: "끝까지 완성하는 책임감",
      body: "목표를 정하면 순서를 만들고 꾸준히 마무리해요. 약속과 기준을 지켜 주변에 신뢰를 쌓는 편이에요.",
    },
    low: {
      title: "흐름에 맞춰 움직이는 유연함",
      body: "계획이 바뀌어도 상황을 빠르게 읽고 자연스럽게 대응해요. 예상하지 못한 순간에 새로운 길을 만드는 힘이 있어요.",
    },
  },
  E: {
    high: {
      title: "사람과 공간을 움직이는 에너지",
      body: "대화와 활동 속에서 생각이 선명해져요. 먼저 말을 건네고 분위기를 앞으로 움직이는 일이 자연스러워요.",
    },
    low: {
      title: "조용히 깊어지는 집중력",
      body: "혼자 생각을 정리한 뒤 꼭 필요한 말을 건네요. 넓은 관계보다 편안한 사람과 깊게 연결되는 편이에요.",
    },
  },
  A: {
    high: {
      title: "마음을 먼저 알아차리는 다정함",
      body: "상대의 감정과 분위기를 세심하게 살펴요. 함께 편안해질 수 있는 방향을 찾고 관계를 부드럽게 이어 가요.",
    },
    low: {
      title: "필요한 말을 분명히 하는 솔직함",
      body: "관계를 위해 내 기준을 무조건 접지 않아요. 사실과 원칙을 기준으로 솔직하게 판단해 신뢰를 만드는 편이에요.",
    },
  },
  N: {
    high: {
      title: "작은 변화도 놓치지 않는 섬세함",
      body: "표정과 분위기의 미세한 차이를 빠르게 알아차려요. 중요한 일을 깊이 살피고 타인의 마음에 민감하게 반응해요.",
    },
    low: {
      title: "압박 속에서도 중심을 지키는 안정감",
      body: "예상 밖의 일이 생겨도 비교적 차분하게 다음 행동을 찾아요. 주변이 흔들릴 때 든든한 기준이 되어 줘요.",
    },
  },
};

function value(scores: Scores, dimension: BigFiveDimension): number {
  const score = scores[dimension];
  return typeof score === "number" ? score : 5;
}

function direction(scores: Scores, dimension: BigFiveDimension): Direction {
  return value(scores, dimension) >= 5 ? "high" : "low";
}

function highLow(scores: Scores, dimension: BigFiveDimension): HighLow {
  return value(scores, dimension) >= 5 ? "H" : "L";
}

function quad(
  scores: Scores,
  first: BigFiveDimension,
  second: BigFiveDimension,
): Quad {
  return `${highLow(scores, first)}${highLow(scores, second)}` as Quad;
}

function strength(scores: Scores, dimension: BigFiveDimension) {
  return AXIS_STRENGTH[dimension][direction(scores, dimension)];
}

function percent(scores: Scores, dimension: BigFiveDimension): number {
  return Math.max(0, Math.min(100, Math.round(value(scores, dimension) * 10)));
}

function strongestDimensions(scores: Scores): BigFiveDimension[] {
  return (["O", "C", "E", "A", "N"] as BigFiveDimension[]).toSorted(
    (left, right) =>
      Math.abs(value(scores, right) - 5) - Math.abs(value(scores, left) - 5),
  );
}

export function buildKoSelfSections(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
): SelfSection[] {
  const translated = KO_SELF_RESULT_CONTENT_32[typeId];
  if (translated) return translated;

  const type = KO_RESULT_TYPES[typeId];
  const [first, second, third] = strongestDimensions(scores);
  const firstCopy = strength(scores, first);
  const secondCopy = strength(scores, second);
  const thirdCopy = strength(scores, third);

  return [
    {
      title: "사용설명서",
      heading: `${type.name}, 이런 사람이에요`,
      body: `${type.oneLiner} ${firstCopy.body}\n\n${secondCopy.body} ${type.essence}라는 이름처럼, 자신의 리듬을 지킬 때 가장 자연스러운 매력이 드러나요.\n\n사람들이 당신을 편안하게 대하려면 결과만 재촉하기보다 생각과 감정이 움직이는 속도를 존중해 주는 것이 좋아요. 잘하고 있는 부분을 구체적으로 알아봐 주면 훨씬 큰 힘을 낼 수 있어요.\n\n혼자 정리할 시간과 믿을 수 있는 사람과 연결되는 시간이 모두 필요해요. 둘 사이의 균형을 찾으면 가진 장점이 오래 안정적으로 이어져요.`,
    },
    {
      title: "주의해서 다룰 점",
      heading: "장점이 너무 강해질 때를 살펴봐요",
      body: `${firstCopy.title}은 분명한 강점이지만, 여유가 없을 때는 한쪽 방식만 고집하게 만들 수 있어요. 잘하려는 마음이 커질수록 잠깐 멈춰 지금 필요한 것이 무엇인지 확인해 보세요.\n\n${thirdCopy.body} 이 성향이 강하게 나타나는 날에는 혼자 참거나 너무 빠르게 결론 내리지 않는 것이 중요해요.\n\n피곤할수록 익숙한 방식으로 모든 문제를 해결하려 하기 쉬워요. 작은 부탁을 건네고, 바로 답하지 않아도 되는 시간을 스스로 허락해 주세요.\n\n주의점은 고쳐야 할 결함이 아니라 장점을 오래 쓰기 위한 사용법이에요. 내 신호를 먼저 알아차리면 같은 성향이 훨씬 부드러운 힘으로 바뀌어요.`,
    },
  ];
}

function koScoreNote(scores: Scores, dimension: BigFiveDimension): string {
  return `당신의 ${AXIS_NAME[dimension]}은 ${percent(scores, dimension)}%예요.`;
}

function buildKoLoveFailure(scores: Scores): string {
  const paragraph = (dimension: "N" | "A" | "E" | "C") =>
    KO_LOVE_FAIL_PROSE[dimension][highLow(scores, dimension)];
  return [
    paragraph("N"),
    paragraph("A"),
    `${paragraph("E")}${paragraph("C")}`,
    KO_LOVE_FAIL_CLOSING,
  ].join("\n\n");
}

export function buildKoDeepDiveSections(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
  unlocked: boolean,
): ResolvedDeepDiveSection[] {
  const e = strength(scores, "E");
  const a = strength(scores, "A");
  const c = strength(scores, "C");
  const n = strength(scores, "N");
  const o = strength(scores, "O");

  const translatedLove = KO_LOVE_BY_TYPE_32[typeId];
  const translatedLoveParagraphs = translatedLove?.body.split("\n\n") ?? [];
  const translatedLoveLeadCount = KO_LOVE_LEAD_PARAGRAPH_COUNT[typeId];
  const translatedLoveLead = translatedLoveParagraphs
    .slice(0, translatedLoveLeadCount)
    .join("\n\n");
  const translatedLovePayoff = translatedLoveParagraphs
    .slice(translatedLoveLeadCount)
    .join("\n\n");
  const loveBlocks = translatedLove
    ? [
        {
          heading: "나의 연애 매력",
          body: translatedLoveLead,
        },
        unlocked
          ? {
              heading: "나를 좋아하게 된 사람이 읽는 사용설명서",
              body: translatedLovePayoff,
            }
          : {
              heading: "나를 좋아하게 된 사람이 읽는 사용설명서",
              body: "",
              locked: true,
            },
        unlocked
          ? {
              heading: "연애가 잘 풀리지 않을 때의 특징",
              body: buildKoLoveFailure(scores),
            }
          : {
              heading: "연애가 잘 풀리지 않을 때의 특징",
              body: "",
              locked: true,
            },
      ]
    : [
    {
      heading: "나의 연애 매력",
      body: `${a.body}\n\n연애에서는 ${e.title.toLowerCase()}이 자연스럽게 드러나요. 억지로 매력을 만들기보다 평소의 속도와 말투를 지킬 때 상대가 더 편안함을 느껴요.`,
    },
    unlocked
      ? {
          heading: "나를 좋아하게 된 사람이 읽는 사용설명서",
          body: `${n.body}\n\n당신의 마음을 얻고 싶다면 눈치만 보기보다 솔직하고 일관된 표현이 필요해요. 가까워질수록 혼자 추측하지 않고 짧게라도 마음을 확인해 주는 관계가 잘 맞아요.`,
        }
      : {
          heading: "나를 좋아하게 된 사람이 읽는 사용설명서",
          body: "",
          locked: true,
        },
    unlocked
      ? {
          heading: "연애가 잘 풀리지 않을 때의 패턴",
          body: `${direction(scores, "N") === "high" ? "작은 변화에 의미를 너무 많이 붙이며 혼자 불안을 키울 수 있어요." : "상대의 작은 불안 신호를 대수롭지 않게 넘겨 뒤늦게 알아차릴 수 있어요."}\n\n${direction(scores, "A") === "high" ? "맞춰 주기만 하다가 내 마음을 늦게 꺼내면 조용한 오해가 쌓여요." : "정확한 말이 필요한 순간에도 상대는 먼저 공감을 원할 수 있어요."}\n\n이것은 연애에 서툴다는 뜻이 아니라 자주 걸리는 돌의 위치를 알게 되었다는 뜻이에요. 위치를 알면 같은 방식으로 넘어지지 않을 수 있어요.`,
        }
      : {
          heading: "연애가 잘 풀리지 않을 때의 패턴",
          body: "",
          locked: true,
        },
      ];

  const translatedCareer = KO_CAREER_BY_TYPE_32[typeId];
  const translatedCareerParagraphs =
    translatedCareer?.body.split("\n\n") ?? [];
  const careerBlocks = translatedCareer
    ? [
        {
          heading: "나의 일하는 방식",
          body: translatedCareerParagraphs.slice(0, 2).join("\n\n"),
        },
        unlocked
          ? {
              heading: "잘 맞는 일과 피하는 편이 좋은 직장",
              body: translatedCareerParagraphs[2] ?? "",
            }
          : {
              heading: "잘 맞는 일과 피하는 편이 좋은 직장",
              body: "",
              locked: true,
            },
        unlocked
          ? {
              heading: "일에서 인정받는 뜻밖의 재능",
              body: translatedCareerParagraphs.slice(3).join("\n\n"),
            }
          : {
              heading: "일에서 인정받는 뜻밖의 재능",
              body: "",
              locked: true,
            },
      ]
    : [
    {
      heading: "나의 일하는 방식",
      body: `${c.body}\n\n${o.body} 두 성향이 함께 작동할 때 자신만의 방식으로 문제를 정리하고 결과를 만들어 내요.`,
    },
    unlocked
      ? {
          heading: "잘 맞는 일과 피하고 싶은 환경",
          body: `${direction(scores, "C") === "high" ? "역할과 목표가 분명하고 책임 있게 완성할 수 있는 환경" : "방법을 스스로 선택하고 변화에 유연하게 대응할 수 있는 환경"}에서 강점이 잘 살아나요. 반대로 장점을 쓸 여지가 없고 한 가지 방식만 강요하는 곳에서는 에너지가 빠르게 줄 수 있어요.`,
        }
      : {
          heading: "잘 맞는 일과 피하고 싶은 환경",
          body: "",
          locked: true,
        },
    unlocked
      ? {
          heading: "일에서 인정받는 뜻밖의 재능",
          body: `본인은 당연하다고 생각하는 ${strongestDimensions(scores)
            .slice(0, 2)
            .map((dimension) => AXIS_STRENGTH[dimension][direction(scores, dimension)].title)
            .join("과 ")}이 주변에는 희소한 능력으로 보여요. 위기일수록 평소 습관처럼 꺼내는 이 힘이 팀의 기준이 돼요.`,
        }
      : {
          heading: "일에서 인정받는 뜻밖의 재능",
          body: "",
          locked: true,
        },
      ];

  return [
    {
      key: "love",
      tab: "연애 성향",
      note: koScoreNote(scores, "A"),
      body: loveBlocks
        .filter((block) => !block.locked)
        .map((block) => block.body)
        .join("\n\n"),
      blocks: loveBlocks,
      locked: false,
    },
    {
      key: "career",
      tab: "커리어 성향",
      note: koScoreNote(scores, "C"),
      body: careerBlocks
        .filter((block) => !block.locked)
        .map((block) => block.body)
        .join("\n\n"),
      blocks: careerBlocks,
      locked: false,
    },
  ];
}

function buildKoWeapons(scores: Scores): ContentItem[] {
  const dimensions = strongestDimensions(scores);
  return dimensions.concat(dimensions[0]).slice(0, 6).map((dimension, index) => {
    const copy = strength(scores, dimension);
    const tails = [
      "본인에게는 자연스럽지만 주변에는 분명한 능력으로 보여요.",
      "이 힘 덕분에 안심하고 기대는 사람이 있어요.",
      "가까운 사람일수록 이 장점을 더 또렷하게 느껴요.",
      "의식해서 사용하면 관계와 일 모두에서 큰 무기가 돼요.",
      "쉽게 흉내 내기 어려운 당신만의 방식이에요.",
      "스스로 생각하는 것보다 훨씬 큰 장점이에요.",
    ];
    return { title: copy.title, body: `${copy.body} ${tails[index]}` };
  });
}

function buildKoLikable(scores: Scores): string[] {
  const paragraph = (dimension: BigFiveDimension) =>
    KO_LIKABLE_PROSE[dimension][highLow(scores, dimension)];
  return [
    paragraph("E"),
    `${paragraph("A")}${paragraph("C")}`,
    `${paragraph("O")}${paragraph("N")}`,
    KO_LIKABLE_CLOSING,
  ];
}

function buildKoDislikable(scores: Scores): ContentItem[] {
  const dimensions = strongestDimensions(scores);
  return dimensions.concat(dimensions[0]).slice(0, 6).map((dimension, index) => {
    const high = direction(scores, dimension) === "high";
    const variants: Record<BigFiveDimension, [string, string]> = {
      O: ["아이디어가 너무 멀리 갈 때", "새로운 방식을 바로 닫을 때"],
      C: ["기준이 너무 엄격해질 때", "마무리가 뒤로 밀릴 때"],
      E: ["상대의 속도보다 앞설 때", "마음을 너무 늦게 보여 줄 때"],
      A: ["맞춰 주다 지칠 때", "솔직함이 차갑게 들릴 때"],
      N: ["작은 신호를 너무 오래 생각할 때", "상대의 걱정을 가볍게 넘길 때"],
    };
    return {
      title: variants[dimension][high ? 0 : 1],
      body: `장점이 강하게 나온 순간에 생기는 오해예요. 가까운 사람은 나쁜 의도가 없다는 것을 알지만, 짧게 이유를 말해 주면 불필요한 거리를 줄일 수 있어요. ${index % 2 === 0 ? "알아차린 순간부터 충분히 바꿀 수 있어요." : "단점이라기보다 조절이 필요한 사용 습관에 가까워요."}`,
    };
  });
}

function buildKoRelations(scores: Scores): RelationView[] {
  return [
    {
      relation: "친구에게",
      body: KO_RELATION_RULES.FRIEND[quad(scores, "E", "A")],
    },
    {
      relation: "연인에게",
      body: KO_RELATION_RULES.LOVER[quad(scores, "A", "N")],
    },
    {
      relation: "가족에게",
      body: KO_RELATION_RULES.FAMILY[quad(scores, "C", "E")],
    },
    {
      relation: "상사·선배에게",
      body: KO_RELATION_RULES.BOSS[quad(scores, "C", "A")],
    },
    {
      relation: "후배에게",
      body: KO_RELATION_RULES.JUNIOR[quad(scores, "A", "E")],
    },
    {
      relation: "처음 만난 사람에게",
      body: KO_RELATION_RULES.FIRST[quad(scores, "E", "O")],
    },
  ];
}

function buildKoSceneCautions(scores: Scores): SceneCaution[] {
  return [
    {
      scene: "친구와 있을 때",
      body: KO_SCENE_RULES.FRIEND[quad(scores, "E", "A")],
    },
    {
      scene: "연인과 있을 때",
      body: KO_SCENE_RULES.LOVER[quad(scores, "A", "N")],
    },
    {
      scene: "커리어에서",
      body: KO_SCENE_RULES.CAREER[quad(scores, "C", "N")],
    },
    {
      scene: "가족과 있을 때",
      body: KO_SCENE_RULES.FAMILY[quad(scores, "C", "E")],
    },
  ];
}

const DREAMER_LIKABLE = [
  "당신의 매력은 조용한 안도감이에요. 요란하게 나서지 않기 때문에 오히려 이야기를 제대로 받아 주는 사람으로 여겨지고, 둘만 있을 때의 당신이 가장 많은 사랑을 받아요. ‘그 사람에게는 말할 수 있어’——그렇게 생각하는 친구가 분명히 있을 거예요.",
  "또한 부탁받기 전에 먼저 움직이는 자연스러운 배려가 있어요. 당신에게는 너무 당연해서 잘 모르겠지만, 주변 사람들은 그 작은 다정함에 여러 번 도움받았어요. 약속도 비밀도 제대로 지키는 성실함으로 ‘저 사람이라면 괜찮아’라는 믿음이 조용히 쌓여 있는 것도 큰 매력이에요.",
  "유행에 휩쓸리지 않는 안정감도 당신이 가진 좋은 점이에요. 언제 만나도 같은 온도로 곁에 있어 주는 편안함은 오래 만날수록 더 크게 느껴져요. 그리고 누군가 기운이 가라앉아 있을 때 가장 먼저 알아차리는 사람도 아마 당신일 거예요. 무심코 건넨 그 한마디에 구원받은 친구가 분명히 있어요.",
  "스스로는 잘 모를 수 있지만, 이 조합은 꽤 많은 사랑을 받는 성격이에요. 억지로 더 꾸밀 필요는 없어요. 평소의 당신 모습 그대로 이미 충분히 사랑받고 있어요.",
];

const DREAMER_RELATIONS: RelationView[] = [
  {
    relation: "친구에게",
    body: "조용하지만 곁에 있으면 안심되는 사람으로 보여요. 여러 사람이 있는 자리에서는 눈에 띄지 않아도 둘만 남으면 가장 이야기하기 편한 사람. 어느새 고민 상담이 모여드는 타입이에요.",
  },
  {
    relation: "연인에게",
    body: "상대의 마음을 먼저 헤아려 움직이는 헌신적인 사람으로 보여요. 그 다정함은 충분히 전해지고 있어요. 다만 참는 마음도 함께 쌓기 쉬워서, 연인은 당신의 진짜 마음을 조금 더 듣고 싶어 할지도 몰라요.",
  },
  {
    relation: "가족에게",
    body: "손이 가지 않는 조용하고 믿음직한 사람으로 보여요. ‘걱정하지 않아도 된다’고 여겨지는 만큼, 힘들 때일수록 말하지 않으면 알아차려 주기 어려워요.",
  },
  {
    relation: "상사·선배에게",
    body: "안심하고 일을 맡길 수 있고 배려까지 할 줄 아는 모범적인 사람으로 보여요. 다만 편리한 사람처럼 계속 의지받기 쉬우니, 가끔은 거절하는 법을 익혀도 괜찮아요.",
  },
  {
    relation: "후배에게",
    body: "조용하지만 자신을 제대로 지켜봐 주는 선배로 보여요. 말수는 많지 않아도 어려울 때 가장 먼저 도와주는 사람이라는 걸 후배들은 알고 있어요.",
  },
  {
    relation: "처음 만난 사람에게",
    body: "첫인상은 차분하고 조금은 신비로운 사람으로 보여요. 금방 가까워지지는 않기 때문에, 오히려 친해진 사람은 특별한 관계가 되었다고 느껴요.",
  },
];

const DREAMER_SCENE_CAUTIONS: SceneCaution[] = [
  {
    scene: "친구와 있을 때",
    body: "주변에 너무 많이 맞춘 뒤 집으로 돌아가는 길에 한꺼번에 지치기 쉬워요. 거절하지 못해 나간 모임은 즐기지도 못하고 피로만 남아요. ‘이번에는 쉬어 갈게’라고 말할 수 있는 사람을 조금씩 늘려 가세요.",
  },
  {
    scene: "연인과 있을 때",
    body: "헌신하면서 참는 마음까지 함께 쌓아 두었다가, 한계에 다다른 날 한꺼번에 터뜨리는 패턴을 조심하세요. 상대에게는 ‘갑자기 폭발한 것’처럼 보여도 사실은 몇 달 치가 쌓인 거예요. 조금씩 꺼내 말하는 편이 훨씬 더 다정해요.",
  },
  {
    scene: "커리어에서",
    body: "완벽주의와 지나친 걱정이 겹치면 자기 자신을 몰아붙이기 쉬워요. 100점짜리 준비보다 60점에서 먼저 내놓고 고치는 편이 더 좋은 평가를 받는 장면도 많아요. 시작하기 전에 ‘이 정도면 충분하다’는 선을 정해 두세요.",
  },
  {
    scene: "가족과 있을 때",
    body: "집에서는 에너지를 아끼느라 근황을 거의 말하지 않는 편이에요. ‘걱정할 필요 없는 아이’로 여겨지는 만큼, 힘들 때 알아차려 주기 어려워요. 한 달에 한 번만 짧게 근황을 전해도 크게 달라져요.",
  },
];

export function buildKoPartTwo(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
  unlocked: boolean,
): ResolvedPartTwo {
  const top = strongestDimensions(scores)[0];
  const translated = KO_PERCEIVED_BY_TYPE_32[typeId];
  const isDreamer = typeId === "earnest-elephant__N";
  return {
    weapons: translated?.strengths ?? buildKoWeapons(scores),
    likable: isDreamer ? DREAMER_LIKABLE : buildKoLikable(scores),
    dislikable: unlocked
      ? (translated?.surprises ?? buildKoDislikable(scores))
      : null,
    relations: unlocked
      ? isDreamer
        ? DREAMER_RELATIONS
        : buildKoRelations(scores)
      : null,
    sceneCautions: unlocked
      ? isDreamer
        ? DREAMER_SCENE_CAUTIONS
        : buildKoSceneCautions(scores)
      : null,
    gapTeaser: `스스로 가장 강하다고 느끼는 ${AXIS_NAME[top]}. 친구의 눈에는 조금 다른 농도로 보일 수 있어요.`,
    locked: !unlocked,
  };
}

export const KO_ME_COPY = {
  heroLabel: "나의 성격 유형:",
  selfAriaLabel: "내가 보는 나",
  bigFiveTitle: "다섯 가지 성격 경향",
  friendSectionTitle: "친구가 보는 나",
  cautionTitle: "주의해서 다룰 점",
  unlockNow: "지금 잠금 해제",
  accessNow: "지금 확인하기",
  friendLockDescription:
    "완전판 리포트에서 친구에게 오해받기 쉬운 포인트를 확인해 보세요.",
  teaseAnimal: (animal: string) =>
    `친구의 눈에는 당신이 ‘${animal}’ 같은 사람으로 보이기 시작했어요…`,
} as const;
