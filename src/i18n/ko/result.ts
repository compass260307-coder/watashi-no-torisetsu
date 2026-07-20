import type { BigFiveDimension } from "@/lib/types";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";

export interface KoResultTypeCopy {
  name: string;
  animal: string;
  essence: string;
  oneLiner: string;
}

export interface KoResultAxisCopy {
  dim: BigFiveDimension;
  title: string;
  left: string;
  right: string;
  color: string;
  lowTitle: string;
  lowDescription: string;
  highTitle: string;
  highDescription: string;
}

export const KO_RESULT_COPY = {
  metadataTitle: "나의 진단 결과 | 나의 사용설명서",
  metadataDescription:
    "Big Five 성격 특성과 32가지 캐릭터 유형으로 알아보는 나의 무료 진단 결과예요.",
  loading: "진단 결과를 불러오고 있어요",
  heroLabel: "나의 유형은",
  characterSuffix: " 유형",
  summaryEyebrow: "MY CHARACTER",
  summaryTitle: "한눈에 보는 나",
  axesTitle: "5가지 성격 축으로 보는 나",
  axesDescription:
    "가운데를 기준으로 어느 쪽 성향이 더 자연스럽게 나타나는지 보여 줘요.",
  axesNote:
    "수치는 좋고 나쁨을 뜻하지 않아요. 상황에 따라 달라질 수 있는 현재의 성향이에요.",
  signalsEyebrow: "KEY SIGNALS",
  signalsTitle: "지금 가장 두드러지는 경향",
  signalsDescription:
    "점수 차이가 큰 축부터 살펴보고, 가운데에 가까운 축은 균형 포인트로 보여 드려요.",
  nextEyebrow: "NEXT STEP",
  nextBadge: "준비 중",
  nextTitle: "더 자세한 한국어 사용설명서",
  nextDescription:
    "친구가 보는 나, 관계에서의 강점, 나를 편안하게 대하는 방법을 담은 상세 결과는 다음 단계에서 연결할게요.",
  restart: "다시 진단하기",
  home: "홈으로",
  missingTitle: "저장된 진단 결과를 찾지 못했어요",
  missingDescription: "잠시 후 한국어 진단 페이지로 이동할게요.",
} as const;

export const KO_RESULT_AXES: readonly KoResultAxisCopy[] = [
  {
    dim: "O",
    title: "개방성",
    left: "현실적",
    right: "탐구적",
    color: "#E4AE3A",
    lowTitle: "익숙한 것에서 안정감을 찾아요",
    lowDescription:
      "검증된 방법과 구체적인 경험을 바탕으로 판단할 때 편안함을 느끼는 편이에요.",
    highTitle: "새로운 가능성을 먼저 발견해요",
    highDescription:
      "낯선 아이디어와 경험에 호기심을 느끼고, 여러 관점으로 생각을 확장하는 편이에요.",
  },
  {
    dim: "C",
    title: "성실성",
    left: "유연함",
    right: "계획적",
    color: "#88619A",
    lowTitle: "상황에 맞춰 유연하게 움직여요",
    lowDescription:
      "미리 정한 순서보다 지금의 흐름과 에너지를 살피며 자연스럽게 대응하는 편이에요.",
    highTitle: "목표를 정하면 차근차근 나아가요",
    highDescription:
      "해야 할 일을 구조화하고, 계획한 것을 끝까지 완성할 때 만족감을 느끼는 편이에요.",
  },
  {
    dim: "E",
    title: "외향성",
    left: "내향적",
    right: "외향적",
    color: "#4298B4",
    lowTitle: "혼자만의 시간에서 에너지를 채워요",
    lowDescription:
      "말하기 전에 충분히 생각하고, 넓은 관계보다 편안한 소수와 깊이 연결되는 편이에요.",
    highTitle: "사람과의 교류에서 에너지를 얻어요",
    highDescription:
      "대화와 활동 속에서 생각이 선명해지고, 먼저 분위기를 움직이는 일이 자연스러운 편이에요.",
  },
  {
    dim: "A",
    title: "우호성",
    left: "독립적",
    right: "협력적",
    color: "#33A474",
    lowTitle: "필요할 때 내 기준을 분명히 지켜요",
    lowDescription:
      "관계를 소중히 여기면서도 사실과 원칙을 기준으로 솔직하게 판단하는 편이에요.",
    highTitle: "사람의 마음과 조화를 먼저 살펴요",
    highDescription:
      "상대의 감정을 세심하게 읽고, 함께 편안해질 수 있는 방향을 찾는 편이에요.",
  },
  {
    dim: "N",
    title: "정서적 민감성",
    left: "안정적",
    right: "섬세함",
    color: "#F25E62",
    lowTitle: "압박 속에서도 비교적 차분해요",
    lowDescription:
      "예상 밖의 일이 생겨도 감정의 균형을 되찾고 다음 행동으로 넘어가는 편이에요.",
    highTitle: "작은 변화도 빠르게 알아차려요",
    highDescription:
      "분위기와 감정의 미세한 차이를 잘 느끼며, 중요한 일을 깊이 살피는 편이에요.",
  },
] as const;

export const KO_RESULT_TYPES: Record<ThirtyTwoTypeId, KoResultTypeCopy> = {
  "quiet-owl__N": {
    name: "반짝 잉꼬",
    animal: "잉꼬",
    essence: "시인",
    oneLiner: "말하지 못한 마음을 건져 올려 다정한 언어로 피워 내요.",
  },
  "quiet-owl__R": {
    name: "의젓한 독수리",
    animal: "독수리",
    essence: "현자",
    oneLiner: "많이 말하지 않아도 흔들림 없는 모습으로 주변을 밝혀요.",
  },
  "seeker-wolf__N": {
    name: "쌩쌩 제비",
    animal: "제비",
    essence: "이론가",
    oneLiner: "알고 싶은 마음을 따라 혼자서도 멀리 탐구해 나가요.",
  },
  "seeker-wolf__R": {
    name: "쿨한 매",
    animal: "매",
    essence: "전략가",
    oneLiner: "바람의 흐름까지 읽고 가장 좋은 한 수를 골라요.",
  },
  "dreamer-rabbit__N": {
    name: "사이좋은 펭귄",
    animal: "펭귄",
    essence: "몽상가",
    oneLiner: "마음속 세상을 언제나 부드럽고 다정한 색으로 채워요.",
  },
  "dreamer-rabbit__R": {
    name: "우아한 백조",
    animal: "백조",
    essence: "표현가",
    oneLiner: "남과 비교하지 않고 자신만의 아름다움을 차분히 표현해요.",
  },
  "fantasy-cat__N": {
    name: "변덕쟁이 까마귀",
    animal: "까마귀",
    essence: "수집가",
    oneLiner: "모두가 지나치는 것 앞에 멈춰 나만의 보물을 발견해요.",
  },
  "fantasy-cat__R": {
    name: "느긋한 펠리컨",
    animal: "펠리컨",
    essence: "장인",
    oneLiner: "서두르거나 휩쓸리지 않고 마음에 든 것을 끝까지 다듬어요.",
  },
  "caretaker-dog__N": {
    name: "살뜰한 강아지",
    animal: "강아지",
    essence: "어텐던트",
    oneLiner: "사람들의 작은 변화를 누구보다 먼저 알아차리고 챙겨요.",
  },
  "caretaker-dog__R": {
    name: "든든한 말",
    animal: "말",
    essence: "총무",
    oneLiner: "어떤 순간에도 곁을 지키며 믿고 기댈 수 있는 버팀목이 돼요.",
  },
  "brisk-tiger__N": {
    name: "노력파 호랑이",
    animal: "호랑이",
    essence: "사범",
    oneLiner: "매일 쌓아 올린 한 걸음이 결국 큰 결과를 만든다고 믿어요.",
  },
  "brisk-tiger__R": {
    name: "묵직한 곰",
    animal: "곰",
    essence: "매니저",
    oneLiner: "큰 압박 앞에서도 중심을 잃지 않고 전체를 안정시켜요.",
  },
  "smiley-panda__N": {
    name: "싱글벙글 판다",
    animal: "판다",
    essence: "연출가",
    oneLiner: "함께 있는 것만으로도 굳은 분위기를 부드럽게 풀어 줘요.",
  },
  "smiley-panda__R": {
    name: "느긋한 코끼리",
    animal: "코끼리",
    essence: "낙천가",
    oneLiner: "내일은 분명 좋은 날이 될 거라고 진심으로 믿을 수 있어요.",
  },
  "playful-raccoon__N": {
    name: "장난꾸러기 너구리",
    animal: "너구리",
    essence: "개척자",
    oneLiner: "즐거운 일은 기다리지 않고 직접 시작해 주변까지 움직여요.",
  },
  "playful-raccoon__R": {
    name: "호쾌한 코뿔소",
    animal: "코뿔소",
    essence: "승부사",
    oneLiner: "망설여질수록 앞으로 나아가며 승부의 흐름을 만들어요.",
  },
  "sparkle-dolphin__N": {
    name: "반짝 돌고래",
    animal: "돌고래",
    essence: "동행자",
    oneLiner: "사람의 마음에 다정히 발맞추며 새로운 세계로 함께 나아가요.",
  },
  "sparkle-dolphin__R": {
    name: "냉철한 범고래",
    animal: "범고래",
    essence: "선도자",
    oneLiner: "여러 마음을 하나로 모아 같은 꿈을 향해 힘차게 이끌어요.",
  },
  "ambition-lion__N": {
    name: "다정한 해마",
    animal: "해마",
    essence: "지휘자",
    oneLiner: "전체를 세심하게 살피고 사람과 자리를 가장 알맞게 연결해요.",
  },
  "ambition-lion__R": {
    name: "유유자적 바다거북",
    animal: "바다거북",
    essence: "장군",
    oneLiner: "큰 흐름을 내다보고 흔들림 없는 판단으로 모두를 이끌어요.",
  },
  "idea-monkey__N": {
    name: "꿈꾸는 해파리",
    animal: "해파리",
    essence: "저널리스트",
    oneLiner: "마음을 울린 것을 발견해 자신의 언어로 세상에 전해요.",
  },
  "idea-monkey__R": {
    name: "느긋한 개복치",
    animal: "개복치",
    essence: "페스티벌 스타",
    oneLiner: "순식간에 분위기를 밝히고 모두를 즐거움 속으로 끌어들여요.",
  },
  "whim-fox__N": {
    name: "자유로운 흰동가리",
    animal: "흰동가리",
    essence: "달변가",
    oneLiner: "자신만의 언어로 사람을 끌어당기고 편안하게 마음을 움직여요.",
  },
  "whim-fox__R": {
    name: "마이페이스 상어",
    animal: "상어",
    essence: "혁명가",
    oneLiner: "당연하다고 여긴 것을 의심하고 믿는 미래를 향해 나아가요.",
  },
  "earnest-elephant__N": {
    name: "순수한 유니콘",
    animal: "유니콘",
    essence: "몽상가",
    oneLiner: "곧고 다정한 이상만큼은 어떤 순간에도 쉽게 놓지 않아요.",
  },
  "earnest-elephant__R": {
    name: "흔들림 없는 드래곤",
    animal: "드래곤",
    essence: "수호자",
    oneLiner: "지키기로 한 것은 끝까지 지켜 내는 조용한 강함이 있어요.",
  },
  "steady-turtle__N": {
    name: "동경하는 페가수스",
    animal: "페가수스",
    essence: "비상가",
    oneLiner: "아무에게도 드러내지 않은 채 더 높은 곳을 향해 날아올라요.",
  },
  "steady-turtle__R": {
    name: "불굴의 피닉스",
    animal: "피닉스",
    essence: "불굴의 도전자",
    oneLiner: "넘어져도 다시 일어나는 힘만큼은 누구에게도 지지 않아요.",
  },
  "gentle-koala__N": {
    name: "배려하는 천사",
    animal: "천사",
    essence: "심미가",
    oneLiner: "누군가의 행복을 바라며 마음을 쓰는 순간 가장 행복해져요.",
  },
  "gentle-koala__R": {
    name: "부동의 골렘",
    animal: "골렘",
    essence: "애호가",
    oneLiner: "좋아하는 것을 조용하고 깊게 오래 사랑하고 싶어 해요.",
  },
  "solo-hedgehog__N": {
    name: "수줍은 유령",
    animal: "유령",
    essence: "탐정",
    oneLiner: "말은 많지 않아도 주변에서 일어나는 일을 세심하게 보고 있어요.",
  },
  "solo-hedgehog__R": {
    name: "태평한 해골",
    animal: "해골",
    essence: "풍운아",
    oneLiner: "무엇에도 얽매이지 않고 자신만의 바람을 따라 자유롭게 살아가요.",
  },
};
