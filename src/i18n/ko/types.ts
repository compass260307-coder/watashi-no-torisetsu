import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";

export const KO_TYPES_COPY = {
  title: "성격 유형",
  description:
    "나의 사용설명서의 32가지 성격 유형을 바다, 육지, 하늘, 미지의 네 그룹으로 소개해요. Big Five 이론을 바탕으로 나와 친구의 성격 유형을 확인해 보세요.",
  cta: "테스트 해보기 →",
  resultAriaLabel: (essence: string) => `${essence} 결과 페이지 보기`,
  groups: {
    sea: { name: "바다 그룹", giant: "바다" },
    land: { name: "육지 그룹", giant: "육지" },
    sky: { name: "하늘 그룹", giant: "하늘" },
    unknown: { name: "미지 그룹", giant: "미지" },
  },
} as const;

export const KO_TYPE_ZUKAN_DESCRIPTIONS: Record<
  ThirtyTwoTypeId,
  string
> = {
  "quiet-owl__N":
    "말로 표현되지 않은 미묘한 마음을 포착해 표현으로 바꿔요. 섬세하고 감수성이 풍부해요.",
  "quiet-owl__R":
    "많은 말을 하지 않아도 태도로 보여 줘요. 흔들리지 않는 중심이 있어요.",
  "seeker-wolf__N":
    "알고 싶은 마음을 따라 끝까지 파고들어요. 탐구심이 강하고 섬세해요.",
  "seeker-wolf__R":
    "조용히 최선의 한 수를 골라요. 냉정하고 계산이 빨라요.",
  "dreamer-rabbit__N":
    "마음속 세계를 소중히 여겨요. 다정하고 섬세해요.",
  "dreamer-rabbit__R":
    "남과 비교하지 않고 나다움을 지켜요. 차분하고 우아한 분위기가 있어요.",
  "fantasy-cat__N":
    "모두가 지나치는 것 앞에 멈춰요. 자신만의 시선을 지녔어요.",
  "fantasy-cat__R":
    "서두르지 않고 자신이 정한 답을 끝까지 다듬어요. 자기 속도를 지키고 쉽게 흔들리지 않아요.",
  "caretaker-dog__N":
    "상대의 작은 변화를 알아차리고 챙겨요. 섬세하고 헌신적이에요.",
  "caretaker-dog__R":
    "사람을 맞이하고 자리를 편안하게 만들어요. 살뜰하고 믿음직해요.",
  "brisk-tiger__N":
    "꾸준히 쌓아 올리며 전체를 세심하게 살펴요. 꼼꼼하고 주변을 잘 챙겨요.",
  "brisk-tiger__R":
    "질서를 지키고 조직을 안정적으로 움직여요. 압박 앞에서도 흔들리지 않아요.",
  "smiley-panda__N":
    "자리의 공기를 부드럽게 바꾸고 매력을 보여 줘요. 사람들의 반응을 빠르게 알아차려요.",
  "smiley-panda__R":
    "분위기를 띄우고 모두를 즐겁게 해요. 배짱이 있고 남의 시선에 쉽게 흔들리지 않아요.",
  "playful-raccoon__N":
    "즐거움을 직접 만들어 내요. 행동력이 있으면서도 섬세해요.",
  "playful-raccoon__R":
    "망설이지 않고 곧장 나아가요. 배짱이 있고 두려움에 쉽게 물러서지 않아요.",
  "sparkle-dolphin__N":
    "사람의 마음에 발맞추며 힘이 되어 줘요. 섬세하고 공감 능력이 뛰어나요.",
  "sparkle-dolphin__R":
    "사람들을 하나로 모아 같은 목표로 이끌어요. 결단이 빠르고 흔들리지 않아요.",
  "ambition-lion__N":
    "전체를 살피고 가장 알맞은 배치를 만들어요. 책임감이 강하고 세부까지 꼼꼼해요.",
  "ambition-lion__R":
    "큰 흐름을 보며 집단을 이끌어요. 흔들리지 않는 판단력이 있어요.",
  "idea-monkey__N":
    "마음을 울린 것을 발견해 세상에 전해요. 감수성이 풍부해요.",
  "idea-monkey__R":
    "자리를 밝히고 사람들을 자연스럽게 끌어들여요. 호기심을 따라 움직여요.",
  "whim-fox__N":
    "자신만의 말로 사람을 끌어당기고 움직여요. 발상이 독창적이고 섬세해요.",
  "whim-fox__R":
    "당연한 것을 의심하고 믿는 길로 나아가요. 남의 흐름에 쉽게 휩쓸리지 않아요.",
  "earnest-elephant__N":
    "곧은 이상을 쉽게 놓지 않아요. 순수하고 섬세해요.",
  "earnest-elephant__R":
    "지키기로 한 것을 끝까지 지켜요. 조용한 강함이 있어요.",
  "steady-turtle__N":
    "아무에게도 드러내지 않고 더 높은 곳을 바라봐요. 이상이 높고 섬세해요.",
  "steady-turtle__R":
    "넘어져도 몇 번이고 다시 일어나요. 끈기 있고 쉽게 흔들리지 않아요.",
  "gentle-koala__N":
    "누군가의 행복을 바라며 마음을 다해요. 다정하고 감수성이 풍부해요.",
  "gentle-koala__R":
    "좋아하는 것을 조용하고 깊게 사랑해요. 말수가 적고 자기 속도를 지켜요.",
  "solo-hedgehog__N":
    "많은 말을 하지 않아도 전체를 보고 있어요. 관찰력이 뛰어나고 섬세해요.",
  "solo-hedgehog__R":
    "무엇에도 얽매이지 않고 태연하게 살아가요. 자유롭고 쉽게 흔들리지 않아요.",
};
