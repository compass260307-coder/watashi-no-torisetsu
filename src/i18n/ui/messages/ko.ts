import type { UnlockPeek } from "@/components/result/PaywallPeek";
import { KO_TOP_CONTENT } from "@/i18n/ko/top";
import { FULL_ACCESS_DISCOUNT_PERCENT_KRW, FULL_ACCESS_LIST_PRICE_KRW, FULL_ACCESS_PRICE_KRW, SELF_REPORT_PRICE_KRW } from "@/lib/access-products";
import { peeks as basePeeks } from "../peeks/ja";
import { peeks } from "../peeks/ko";
import type { FooterContent, HeaderContent, PlanDefinition, UiCopy, UnlockItem } from "../types";
import labels from "./ko-labels";
const { ebook: KO_PEEK_EBOOK, friends: KO_PEEK_FRIENDS, alice: KO_PEEK_ALICE, aisho: KO_PEEK_AISHO, unmei: KO_PEEK_UNMEI, alice_fortune: KO_PEEK_ALICE_FORTUNE } = peeks;
const header: HeaderContent = {
  siteName: KO_TOP_CONTENT.siteName,
  homeHref: "/ko",
  nav: [
    {
      label: KO_TOP_CONTENT.navigation.diagnosis, href: "/ko/diagnosis"
    },
    {
      label: KO_TOP_CONTENT.navigation.friend, href: "/ko/tako", tako: true
    },
    {
      label: KO_TOP_CONTENT.navigation.types, href: "/ko/types"
    },
    {
      label: "궁합 진단", href: "/ko/aisho"
    },
    {
      label: "Alice",
      href: "/ko/hoshiyomi",
      course: "astrologer",
    },
    {
      label: "타로", href: "/ko/tarot"
    },
    {
      label: KO_TOP_CONTENT.navigation.login, href: "/ko/login", login: true
    },
  ],
  preparing: `(${KO_TOP_CONTENT.navigation.preparing})`,
  currentLangLabel: "한국어",
  languageOptions: [
    {
      locale: "ja", localLabel: "일본어", nativeLabel: "日本語"
    },
    {
      locale: "en", localLabel: "영어", nativeLabel: "English"
    },
    {
      locale: "id", localLabel: "인도네시아어", nativeLabel: "Bahasa Indonesia"
    },
  ],
  languageModalTitle: "언어",
  ariaLangSwitch: "언어 변경",
  ariaLangMenuClose: "언어 메뉴 닫기",
  menuTitle: KO_TOP_CONTENT.navigation.menu,
  ariaMenuOpen: KO_TOP_CONTENT.navigation.menuOpen,
  ariaMenuClose: KO_TOP_CONTENT.navigation.menuClose,
  reset: {
    label: "데이터 초기화",
    confirm: "진단 결과와 초대 링크가 이 기기에서 삭제되며 되돌릴 수 없어요.",
    run: "초기화",
    cancel: "취소",
  },
};
const footer: FooterContent = {
  columns: [
    {
      title: KO_TOP_CONTENT.footer.diagnosisTitle,
      links: [
        {
          label: KO_TOP_CONTENT.navigation.diagnosis, href: "/ko/diagnosis"
        },
        {
          label: KO_TOP_CONTENT.navigation.friend,
          href: "/ko/tako",
          tako: true,
        },
        {
          label: KO_TOP_CONTENT.navigation.types, href: "/ko/types"
        },
        {
          label: "궁합 진단", href: "/ko/aisho"
        },
        {
          label: "Alice",
          href: "/ko/hoshiyomi",
          course: "astrologer",
        },
        {
          label: "운명의 설계도",
          href: "/ko/unmei",
          course: "unmei",
        },
        {
          label: "타로", href: "/ko/tarot", course: "tarot"
        },
      ],
    },
    {
      title: KO_TOP_CONTENT.footer.serviceTitle,
      links: [
        {
          label: KO_TOP_CONTENT.siteName, href: "/ko"
        },
        {
          label: KO_TOP_CONTENT.footer.about, href: "/ko/about"
        },
        {
          label: KO_TOP_CONTENT.footer.articles,
          href: "/ko/articles",
          children: [
            {
              label: "OCEAN 진단이란?", href: "/ko/articles/ocean-shindan"
            },
            {
              label: "타인 분석 방법", href: "/ko/articles/tako-bunseki"
            },
            {
              label: "사용설명서 만드는 법",
              href: "/ko/articles/torisetsu-tsukurikata",
            },
            {
              label: "16가지 유형과의 차이",
              href: "/ko/articles/sixteen-types-vs-ocean",
            },
          ],
        },
        {
          label: KO_TOP_CONTENT.footer.company,
          href: "https://sora-team.com",
          external: true,
          newTab: true,
        },
      ],
    },
    {
      title: KO_TOP_CONTENT.footer.supportTitle,
      links: [
        {
          label: KO_TOP_CONTENT.footer.contact,
          href: "mailto:support@watashi-torisetsu.com",
          external: true,
        },
      ],
    },
  ],
  legalLinks: [
    {
      label: KO_TOP_CONTENT.footer.terms, href: "/ko/terms"
    },
    {
      label: KO_TOP_CONTENT.footer.privacy, href: "/ko/privacy"
    },
    {
      label: KO_TOP_CONTENT.footer.commerce, href: "/ko/legal/commerce"
    },
  ],
  legalAriaLabel: "법적 고지",
  copyright: KO_TOP_CONTENT.footer.copyright,
  disclaimer: KO_TOP_CONTENT.footer.disclaimer,
  preparing: "(준비 중)",
  takoBaseHref: "/ko/tako",
};
const KO_SELF_UNLOCKS: UnlockItem[] = [
  {
    title: "내 결과의 잠긴 섹션 9개 모두 보기",
    desc: "연애와 커리어 심층 분석, 주변 사람들이 보는 나의 모습, 다양한 상황에서 드러나는 성격까지 나머지 결과를 모두 읽을 수 있어요.",
  },
  {
    title: "16페이지 이상의 나만의 전자책",
    desc: "나의 성격 유형을 주인공으로 한 이야기를 한 권에 담았어요. PDF로 저장하거나 인쇄해 언제든 다시 읽을 수 있어요.",
    peek: KO_PEEK_EBOOK,
  },
  {
    title: "나만의 AI 점술가 Alice와 대화",
    desc: "내 성격과 출생 차트를 이해하는 Alice가 연애·일·인간관계 등 다양한 고민에 맞춰 답해 줘요.",
    peek: KO_PEEK_ALICE,
  },
  {
    title: "Alice의 모든 운세 기능 이용",
    desc: "나만의 ‘운명의 설계도’를 읽고, Alice의 타로로 연애·일·인간관계에서 고민되는 일을 살펴볼 수 있어요.",
    peek: KO_PEEK_ALICE_FORTUNE,
  },
  {
    title: "궁합 진단 기능 모두 이용",
    desc: "연애·우정·일에서 두 사람이 얼마나 잘 맞는지, 어떤 부분에서 오해가 생기기 쉬운지 자세히 알아볼 수 있어요.",
    peek: KO_PEEK_AISHO,
  },
  {
    title: "두 번째 친구부터의 진단 결과 모두 보기",
    desc: "친구가 보는 내 캐릭터부터 서로 느끼는 성격의 차이, 연애 성향, 궁합까지 친구별 결과를 모두 읽을 수 있어요.",
  },
  {
    title: "친구들이 보는 나의 리포트 무제한 업데이트",
    desc: "친구들의 답변을 모아 나를 바라보는 시선을 PDF 리포트로 정리해요. 새 답변이 들어올 때마다 횟수 제한 없이 업데이트할 수 있어요.",
    peek: KO_PEEK_FRIENDS,
  },
];
const KO_TAKO_UNLOCKS: UnlockItem[] = [
  KO_SELF_UNLOCKS[5],
  KO_SELF_UNLOCKS[6],
  KO_SELF_UNLOCKS[2],
  KO_SELF_UNLOCKS[3],
  KO_SELF_UNLOCKS[4],
  KO_SELF_UNLOCKS[0],
  KO_SELF_UNLOCKS[1],
];
const KO_STUDENT_LITE_UNLOCKS: UnlockItem[] = [
  KO_SELF_UNLOCKS[0],
  KO_SELF_UNLOCKS[5],
  KO_SELF_UNLOCKS[6],
  KO_SELF_UNLOCKS[1],
];
const KO_STUDENT_LITE_TAKO_UNLOCKS: UnlockItem[] = [
  KO_SELF_UNLOCKS[5],
  KO_SELF_UNLOCKS[6],
  KO_SELF_UNLOCKS[0],
  KO_SELF_UNLOCKS[1],
];
const KO_UNMEI: UnlockItem = {
  title: "나만의 ‘운명의 설계도’",
  desc: "성격 진단과 출생 차트를 함께 해석한 4장 구성의 AI 리포트예요. 오늘의 한 장·세 장 뽑기·YES / NO 타로도 즐길 수 있어요.",
  peek: KO_PEEK_UNMEI,
};
const KO_AISHO_ITEM = "두 사람의 궁합 진단 결과 모두 보기";
const KO_FULL_ACCESS_ITEMS = [
  "성격 진단의 상세 결과 9개 모두 보기",
  "16페이지 이상의 전용 전자책",
  "두 번째 친구부터 모든 진단 결과 보기",
  "횟수 제한 없이 업데이트하는 친구 시선 분석 리포트(PDF)",
  "나만을 위한 ‘운명의 설계도’",
  "점성술사 ‘Alice’와 채팅 30회",
  "Alice의 타로 3종 모두 이용",
  KO_AISHO_ITEM,
] as const;
const KO_PLANS: readonly PlanDefinition[] = [
  {
    product: "full_access",
    eyebrow: "자기 진단·친구 진단·운세까지",
    title: "완전판",
    basePrice: FULL_ACCESS_PRICE_KRW,
    listPrice: FULL_ACCESS_LIST_PRICE_KRW,
    badge: `출시 기념 ${FULL_ACCESS_DISCOUNT_PERCENT_KRW}% 할인`,
    iconSrc: "/pricing/full-access-connection-felt-transparent.png",
    accent: "#5B5BEF",
    soft: "#EEEEFF",
    inheritedItemCount: 0,
    items: KO_FULL_ACCESS_ITEMS,
  },
] as const;
function peekForItem(item: string): UnlockPeek | undefined {
  if (item.includes("Alice") || item.includes("점성술사 채팅")) {
    return peeks.alice;
  }
  if (item.includes("궁합"))
    return peeks.aisho;
  if (item.includes("운명의 설계도"))
    return peeks.unmei;
  if (item.includes("전자책"))
    return peeks.ebook;
  if (item.includes("친구 진단") || item.includes("친구부터") || item.includes("친구 시선 분석")) {
    return peeks.friends;
  }
  return undefined;
}
const copy: UiCopy = {
  koreanLegal: {
    "before": "구매 버튼을 누르면", "terms": "이용약관", "privacy": "개인정보처리방침", "commerce": "판매·환불 조건", "after": "을 확인하고 동의한다는 의사를 표시하게 됩니다. 상품은 결제 확인 후 즉시 제공되는 디지털 콘텐츠이며, 결제일로부터 30일 이내에 전액 환불을 요청할 수 있습니다. 미성년자는 법정대리인의 동의를 받아야 하며, 동의 없이 체결한 계약은 본인 또는 법정대리인이 취소할 수 있습니다."
  }, nav: {
    "me": "자기 진단", "friend": "친구 진단", "astrologer": "Alice", "unmei": "운명", "tarot": "타로"
  }, loading: ["불러오는 중…", "닫기", "불러오지 못했습니다. 새로고침하면 입력 중인 내용이 사라질 수 있습니다.", "새로고침"], lock: {
    friend: {
      ariaLabel: "친구 진단 잠금 안내",
      heading: "친구 진단은 아직 잠겨 있어요",
      bodyLine1: "자기 진단을 완료하면",
      bodyLine2: "친구에게 진단을 받을 수 있어요",
    },
    astrologer: {
      ariaLabel: "상담사 잠금 안내",
      heading: "상담사는 아직 잠겨 있어요",
      bodyLine1: "자기 진단을 완료하면",
      bodyLine2: "상담 코스를 선택할 수 있어요",
    },
    unmei: {
      ariaLabel: "운명의 설계도 잠금 안내",
      heading: "운명의 설계도는 아직 잠겨 있어요",
      bodyLine1: "자기 진단을 완료하면",
      bodyLine2: "설계도 코스를 선택할 수 있어요",
    },
    tarot: {
      ariaLabel: "타로 잠금 안내",
      heading: "타로는 아직 잠겨 있어요",
      bodyLine1: "자기 진단을 완료하면",
      bodyLine2: "타로점을 즐길 수 있어요",
    },
  }, labels, header, footer, peeks, basePeeks,
  promo: {
    heading: ["당신의 이야기는", "아직 끝나지 않았어요"], studentHeading: ["자기 진단을", "더 깊이"], studentCta: "학생 플랜으로 해제 →", price: {
      list: `₩${FULL_ACCESS_LIST_PRICE_KRW.toLocaleString("ko-KR")}`,
      sale: `₩${FULL_ACCESS_PRICE_KRW.toLocaleString("ko-KR")}`,
      offPercent: Math.round((1 - FULL_ACCESS_PRICE_KRW / FULL_ACCESS_LIST_PRICE_KRW) * 100),
    }, selfReportPrice: `₩${SELF_REPORT_PRICE_KRW.toLocaleString("ko-KR")}`, self: KO_SELF_UNLOCKS, tako: KO_TAKO_UNLOCKS, studentSelf: KO_STUDENT_LITE_UNLOCKS, studentTako: KO_STUDENT_LITE_TAKO_UNLOCKS, alice: KO_SELF_UNLOCKS[2], fortune: KO_SELF_UNLOCKS[3], unmei: KO_UNMEI
  },
  carousel: {
    peekForItem, ctaLabel: (product) => {
      if (product === "self_report")
        return "학생 플랜으로 잠금 해제"; if (product === "full_access")
        return "완전판으로 잠금 해제"; return "프리미엄으로 잠금 해제";
    }, plans: KO_PLANS, premiumFeatures: [
      {
        title: "4장으로 구성된 AI 별자리 리포트",
        desc: "지금까지의 걸음부터 앞으로 찾아올 전환점까지 읽어 드려요.",
      },
      {
        title: "전담 AI 점성술사와 상담 30회",
        desc: "성격 진단과 출생 차트를 이해한 점성술사에게 고민을 상담할 수 있어요.",
      },
      {
        title: "나만의 출생 차트",
        desc: "태어난 순간의 천체 배치를 한 장의 설계도로 그려 드려요.",
      },
      {
        title: "성격 진단과 별의 교차 해석",
        desc: "성격과 별의 기질을 함께 살펴 나만의 모습을 깊이 이해해요.",
      },
      {
        title: "궁합 진단 이용",
        desc: "궁금한 상대와의 궁합을 S~C 등급으로 확인하고 연애·우정·일 등 상황별 해석까지 읽을 수 있어요.",
      },
    ]
  },
};
export default copy;
