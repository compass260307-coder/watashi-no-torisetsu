import type { FaqItem } from "@/lib/faq-data";

export const KO_ABOUT_STEPS = [
  {
    num: "1",
    title: "자기 진단 시작하기",
    body: "50문항, 약 3분. Big Five 심리학을 바탕으로 한 질문에 답하면 32가지 유형 중 나와 닮은 캐릭터를 찾을 수 있어요.",
  },
  {
    num: "2",
    title: "친구에게 친구 진단 부탁하기",
    body: "전용 초대 링크를 친구에게 보내면 돼요. 친구는 익명으로 약 5분 안에 나에 대한 인상을 답할 수 있어요.",
  },
  {
    num: "3",
    title: "친구 눈에 비친 나 확인하기",
    body: "내가 보는 나와 친구가 보는 나의 차이를 비교하며, 나만의 사용설명서를 완성해 갈 수 있어요.",
  },
] as const;

export const KO_ABOUT_PRIVACY_ITEMS = [
  "친구의 답변은 익명으로 표시되며, 누가 어떻게 답했는지는 공개되지 않아요.",
  "모르는 사람과 연결되지 않아요. 진단과 초대는 언제나 내가 직접 시작해요.",
  "서비스 안에 광고를 게재하지 않아요.",
  "수집한 데이터는 서비스 제공과 자기 이해 경험을 개선하는 목적에 맞게 다뤄요.",
] as const;

export const KO_ABOUT_GALLERY = [
  { name: "사이좋은 펭귄", src: "/characters/v3/penguin_N.webp" },
  { name: "쿨한 매", src: "/characters/v3/hawk_R.webp" },
  { name: "미소 판다", src: "/characters/v3/fox_N.webp" },
  { name: "듬직한 곰", src: "/characters/v3/bear_R.webp" },
  { name: "반짝 돌고래", src: "/characters/v3/jellyfish_N.webp" },
  { name: "마이페이스 상어", src: "/characters/v3/shark_R.webp" },
  { name: "배려심 많은 천사", src: "/characters/v3/angel_N.webp" },
  { name: "흔들림 없는 드래곤", src: "/characters/v3/dragon_R.webp" },
] as const;

export const KO_ABOUT_FAQ: readonly FaqItem[] = [
  {
    question: "나의 사용설명서는 어떤 서비스인가요?",
    answer:
      "나의 사용설명서는 자기 진단과 친구의 평가를 함께 살펴보는 자기 이해 서비스예요. Big Five 심리학을 바탕으로 내가 보는 나와 친구 눈에 비친 나를 비교해, 스스로 미처 몰랐던 모습을 발견할 수 있어요.",
  },
  {
    question: "Big Five(OCEAN) 성격 진단이 무엇인가요?",
    answer:
      "Big Five는 사람의 성격을 개방성, 성실성, 외향성, 우호성, 정서적 민감성의 다섯 가지 특성으로 살펴보는 심리학 모델이에요. 다섯 특성의 영문 앞글자를 따 OCEAN 모델이라고도 불리며, 세계 여러 연구와 실무에서 활용되고 있어요.",
  },
  {
    question: "16가지 성격 유형 검사와 무엇이 다른가요?",
    answer:
      "나의 사용설명서는 Big Five(OCEAN) 이론을 바탕으로 성격을 32가지 캐릭터 유형으로 표현해요. 자기 답변만으로 끝나지 않고 친구의 평가까지 함께 비교해, 주변 사람에게 보이는 모습도 확인할 수 있다는 점이 가장 큰 차이예요.",
  },
  {
    question: "무료로 이용할 수 있나요?",
    answer:
      "자기 진단과 기본 결과, 친구에게 진단을 부탁하는 기능은 무료로 이용할 수 있어요. 잠긴 상세 분석과 완전판 PDF, 추가 친구 결과 등은 1회 결제형 완전판 패키지에서 제공해요.",
  },
  {
    question: "회원가입이 필요한가요?",
    answer:
      "진단을 시작할 때는 회원가입이 필요하지 않아요. 결과를 다른 기기에서 복구하거나 구매한 콘텐츠를 다시 확인하려면 이메일 로그인 링크를 이용할 수 있어요.",
  },
  {
    question: "진단에는 얼마나 걸리나요?",
    answer:
      "자기 진단은 50문항으로 약 3분 정도 걸려요. 친구 진단은 30문항으로 약 5분 안에 답할 수 있도록 구성되어 있어요.",
  },
  {
    question: "결과가 다른 사람에게 공개되나요?",
    answer:
      "개인 결과 링크는 검색 결과에 공개되지 않아요. 본인이 캐릭터 공유 링크나 초대 링크를 직접 전달하지 않는 한 다른 사람이 결과에 접근할 수 없어요.",
  },
  {
    question: "친구 한 명만 답해도 결과를 볼 수 있나요?",
    answer:
      "네. 친구 한 명이 답하면 친구가 보는 나와 자기 평가의 차이를 확인할 수 있어요. 친구의 답변이 늘어날수록 여러 시선을 모아 더 입체적으로 비교할 수 있어요.",
  },
  {
    question: "어떤 사람에게 추천하나요?",
    answer:
      "자기소개나 진로 준비를 위해 나를 더 잘 설명하고 싶은 분, 친구나 연인과 서로를 이해하고 싶은 분, 내 성격을 부담 없이 재미있게 들여다보고 싶은 분에게 추천해요.",
  },
];
