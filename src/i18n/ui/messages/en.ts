import type { UnlockPeek } from "@/components/result/PaywallPeek";
import { EN_FULL_ACCESS_LIST_PRICE_USD_CENTS, EN_FULL_ACCESS_PRICE_USD_CENTS } from "@/lib/access-products";
import { peeks as basePeeks, peeks } from "../peeks/en";
import type { FooterContent, HeaderContent, PlanDefinition, UiCopy, UnlockItem } from "../types";
import labels from "./en-labels";
const { ebook: EN_PEEK_EBOOK, friends: EN_PEEK_FRIENDS, alice: EN_PEEK_ALICE, aisho: EN_PEEK_AISHO, unmei: EN_PEEK_UNMEI, alice_fortune: EN_PEEK_ALICE_FORTUNE } = peeks;
const header: HeaderContent = {
  siteName: "Alice Personalities",
  homeHref: "/en",
  nav: [
    {
      label: "Personality test", href: "/en/diagnosis"
    },
    {
      label: "Friend test", href: "/en/tako", tako: true
    },
    {
      label: "Personality types", href: "/en/types"
    },
    {
      label: "Compatibility", href: "/en/aisho"
    },
    {
      label: "Alice", href: "/en/hoshiyomi", course: "astrologer"
    },
    {
      label: "Tarot", href: "/en/tarot"
    },
    {
      label: "Sign in", href: "/en/login", login: true
    },
  ],
  preparing: " (Coming soon)",
  currentLangLabel: "English",
  languageOptions: [
    {
      locale: "ja", localLabel: "Japanese", nativeLabel: "日本語"
    },
    {
      locale: "ko", localLabel: "Korean", nativeLabel: "한국어"
    },
    {
      locale: "id", localLabel: "Indonesian", nativeLabel: "Bahasa Indonesia"
    },
  ],
  languageModalTitle: "Language",
  ariaLangSwitch: "Change language",
  ariaLangMenuClose: "Close language menu",
  menuTitle: "Menu",
  ariaMenuOpen: "Open menu",
  ariaMenuClose: "Close menu",
  reset: {
    label: "Reset local data",
    confirm: "Your test results and invitation links will be removed from this device. This cannot be undone.",
    run: "Reset",
    cancel: "Cancel",
  },
};
const footer: FooterContent = {
  columns: [
    {
      title: "Tests",
      links: [
        {
          label: "Personality test", href: "/en/diagnosis"
        },
        {
          label: "Friend test", href: "/en/tako", tako: true
        },
        {
          label: "Personality types", href: "/en/types"
        },
        {
          label: "Compatibility", href: "/en/aisho"
        },
        {
          label: "Alice", href: "/en/hoshiyomi", course: "astrologer"
        },
        {
          label: "Destiny Blueprint", href: "/en/unmei", course: "unmei"
        },
        {
          label: "Alice Tarot", href: "/en/tarot", course: "tarot"
        },
      ],
    },
    {
      title: "Services",
      links: [
        {
          label: "About this service", href: "/en/about"
        },
        {
          label: "Articles",
          href: "/en/articles",
          children: [
            {
              label: "What is the OCEAN model?", href: "/en/articles/ocean-shindan"
            },
            {
              label: "How to ask for feedback", href: "/en/articles/tako-bunseki"
            },
            {
              label: "Your personality guide", href: "/en/articles/torisetsu-tsukurikata"
            },
            {
              label: "OCEAN vs. 16 types", href: "/en/articles/sixteen-types-vs-ocean"
            },
          ],
        },
        {
          label: "Company",
          href: "https://sora-team.com",
          external: true,
          newTab: true,
        },
      ],
    },
    {
      title: "Support",
      links: [
        {
          label: "Contact us",
          href: "mailto:support@watashi-torisetsu.com",
          external: true,
        },
      ],
    },
  ],
  legalLinks: [
    {
      label: "Terms", href: "/en/terms"
    },
    {
      label: "Privacy Policy", href: "/en/privacy"
    },
    {
      label: "Sales & Refund Policy", href: "/en/legal/commerce"
    },
  ],
  legalAriaLabel: "Legal information",
  copyright: "Alice Personalities",
  disclaimer: "Alice Personalities is a free personality experience based on the Big Five model and feedback from friends. Results are for self-reflection and are not a medical or psychological diagnosis.",
  preparing: " (Coming soon)",
  takoBaseHref: "/en/tako",
};
const EN_SELF_UNLOCKS: UnlockItem[] = [
  {
    title: "Unlock all 9 locked sections of your result",
    desc: "Read every remaining section, from deeper love and career insights to how others see you and how you respond in real-life situations.",
  },
  {
    title: "A personalized ebook with 16+ pages",
    desc: "Receive your personality and defining traits in a book made for you. Save it, print it, and revisit it whenever you like.",
    peek: EN_PEEK_EBOOK,
  },
  {
    title: "Chat with Alice, your personal astrologer",
    desc: "Alice understands your personality and birth chart, and helps you think through love, work, relationships, and whatever is on your mind.",
    peek: EN_PEEK_ALICE,
  },
  {
    title: "Unlock every Alice reading",
    desc: "Get your personal Destiny Blueprint plus one-card, three-card, and YES / NO tarot readings.",
    peek: EN_PEEK_ALICE_FORTUNE,
  },
  {
    title: "Unlock the complete compatibility reading",
    desc: "Explore compatibility in love, friendship, and work, including the points where the two of you are most likely to misunderstand each other.",
    peek: EN_PEEK_AISHO,
  },
  {
    title: "Unlock every friend result after the first",
    desc: "Read each friend's full result sheet, including the character they see, personality gaps, love tendencies, and compatibility.",
  },
  {
    title: "Update your friends' perspective report anytime",
    desc: "Turn everyone's answers into one complete PDF, then regenerate it whenever more friends respond.",
    peek: EN_PEEK_FRIENDS,
  },
];
const EN_TAKO_UNLOCKS: UnlockItem[] = [
  EN_SELF_UNLOCKS[5],
  EN_SELF_UNLOCKS[6],
  EN_SELF_UNLOCKS[2],
  EN_SELF_UNLOCKS[3],
  EN_SELF_UNLOCKS[4],
  EN_SELF_UNLOCKS[0],
  EN_SELF_UNLOCKS[1],
];
const EN_UNMEI: UnlockItem = {
  title: "Your personal Destiny Blueprint",
  desc: "A four-chapter AI reading that combines your personality profile and birth chart, plus one-card, three-card, and YES / NO tarot.",
  peek: EN_PEEK_UNMEI,
};
const EN_FULL_ACCESS_ITEMS = [
  "Unlock all 9 locked sections of your personality result",
  "A personalized ebook with 16+ pages",
  "Unlock every friend result after the first",
  "Update your friends’ perspective PDF anytime",
  "Unlock the complete compatibility reading",
  "Your personal Destiny Blueprint",
  "30 replies from your personal astrologer, Alice",
  "Unlock all three Alice tarot readings",
] as const;
const EN_PLANS: readonly PlanDefinition[] = [
  {
    product: "full_access",
    eyebrow: "Personality, friends, and Alice",
    title: "Complete Edition",
    basePrice: EN_FULL_ACCESS_PRICE_USD_CENTS,
    iconSrc: "/pricing/full-access-connection-felt-transparent.png",
    accent: "#5B5BEF",
    soft: "#EEEEFF",
    inheritedItemCount: 0,
    items: EN_FULL_ACCESS_ITEMS,
  },
] as const;
function peekForItem(item: string): UnlockPeek | undefined {
  if (item.includes("Alice"))
    return peeks.alice;
  if (item.includes("compatibility"))
    return peeks.aisho;
  if (item.includes("Destiny Blueprint"))
    return peeks.unmei;
  if (item.includes("ebook"))
    return peeks.ebook;
  if (item.includes("friend"))
    return peeks.friends;
  return undefined;
}
const copy: UiCopy = {
  koreanLegal: {
    "before": "", "terms": "", "privacy": "", "commerce": "", "after": ""
  }, nav: {
    "me": "My result", "friend": "Friends", "astrologer": "Alice", "unmei": "Destiny", "tarot": "Tarot"
  }, loading: ["Loading…", "Close", "Could not load. Reloading may discard unsaved answers.", "Reload page"], lock: {
    friend: {
      ariaLabel: "Friend test locked",
      heading: "The friend test is still locked",
      bodyLine1: "Complete your personality test",
      bodyLine2: "to invite friends to describe you.",
    },
    astrologer: {
      ariaLabel: "Alice locked",
      heading: "Alice is still locked",
      bodyLine1: "Complete your personality test",
      bodyLine2: "to unlock the Complete Edition.",
    },
    unmei: {
      ariaLabel: "Destiny Blueprint locked",
      heading: "Destiny Blueprint is still locked",
      bodyLine1: "Complete your personality test",
      bodyLine2: "to unlock the Complete Edition.",
    },
    tarot: {
      ariaLabel: "Tarot locked",
      heading: "Tarot is still locked",
      bodyLine1: "Complete your personality test",
      bodyLine2: "to unlock your tarot readings.",
    },
  }, labels, header, footer, peeks, basePeeks,
  promo: {
    heading: ["Your story isn’t", "finished yet"], studentHeading: ["Your story isn’t", "finished yet"], studentCta: "Unlock the Complete Edition →", price: {
      list: `$${(EN_FULL_ACCESS_LIST_PRICE_USD_CENTS / 100).toFixed(2)}`,
      sale: `$${(EN_FULL_ACCESS_PRICE_USD_CENTS / 100).toFixed(2)}`,
      offPercent: Math.round((1 -
        EN_FULL_ACCESS_PRICE_USD_CENTS /
        EN_FULL_ACCESS_LIST_PRICE_USD_CENTS) *
        100),
    }, selfReportPrice: `$${(EN_FULL_ACCESS_PRICE_USD_CENTS / 100).toFixed(2)}`, self: EN_SELF_UNLOCKS, tako: EN_TAKO_UNLOCKS, studentSelf: EN_SELF_UNLOCKS, studentTako: EN_TAKO_UNLOCKS, alice: EN_SELF_UNLOCKS[2], fortune: EN_SELF_UNLOCKS[3], unmei: EN_UNMEI
  },
  carousel: {
    peekForItem, ctaLabel: (product) => { return product === "full_access" ? "Unlock all results →" : "Unlock now →"; }, plans: EN_PLANS, premiumFeatures: [
      {
        title: "A four-part AI reading",
        desc: "Read your story from the path behind you to the turning points ahead.",
      },
      {
        title: "30 replies from your personal astrologer",
        desc: "Ask for guidance from an astrologer who understands your personality and birth chart.",
      },
      {
        title: "Your personal birth-chart wheel",
        desc: "See the sky at the moment you were born drawn as a personal blueprint.",
      },
      {
        title: "Personality and astrology together",
        desc: "Understand yourself more deeply by reading your personality and astrological traits together.",
      },
      {
        title: "Unlock compatibility readings",
        desc: "See S-to-C compatibility ratings with separate readings for love, friendship, and work.",
      },
    ]
  },
};
export default copy;
