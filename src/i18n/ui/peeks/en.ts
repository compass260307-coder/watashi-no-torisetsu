import type { UnlockPeek } from "@/components/result/PaywallPeek";
const EN_PEEK_EBOOK: UnlockPeek = {
  img: "/paywall-peek/en-actual-ebook-page.webp",
  alt: "A sample page from your personality story",
  width: 560,
  height: 792,
  points: [
    "A 16+ page short story starring your personality type",
    "See your traits reflected in a story you can read at your own pace",
    "Receive your personal PDF immediately after purchase",
  ],
  pages: [
    {
      img: "/paywall-peek/en-actual-ebook-page.webp",
      alt: "A page from your personality story",
      width: 560,
      height: 792,
    },
    {
      img: "/paywall-peek/en-actual-ebook-cover.webp",
      alt: "The cover of your personal ebook",
      width: 560,
      height: 841,
    },
  ],
};
const EN_PEEK_FRIENDS: UnlockPeek = {
  img: "/paywall-peek/en-actual-friends-summary.webp",
  alt: "A sample page from the friend-analysis report",
  width: 560,
  height: 718,
  points: [
    "Read how each friend sees you",
    "Unlock every individual friend result",
    "See where different people perceive you differently",
  ],
  pages: [
    {
      img: "/paywall-peek/en-actual-friends-summary.webp",
      alt: "A page from the friend-analysis report",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/en-actual-friends-cover.webp",
      alt: "The friend-analysis report cover",
      width: 560,
      height: 718,
    },
  ],
};
const EN_PEEK_ALICE: UnlockPeek = {
  img: "/paywall-peek/en-actual-alice-chat-1.webp",
  alt: "A conversation with Alice, your AI astrologer",
  width: 560,
  height: 718,
  points: [
    "Alice responds with your personality type in mind",
    "Talk through love, relationships, work, and life choices",
    "Use conversation to organize feelings that are hard to explain",
    "Start talking with Alice as soon as the Complete Edition is unlocked",
  ],
  pages: [
    {
      img: "/paywall-peek/en-actual-alice-chat-1.webp",
      alt: "Talking with Alice",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/en-actual-alice-chat-2.webp",
      alt: "Asking Alice about your path",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/en-actual-alice-chat-3.webp",
      alt: "Asking Alice about love",
      width: 560,
      height: 718,
    },
  ],
};
const EN_PEEK_AISHO: UnlockPeek = {
  img: "/paywall-peek/en-actual-aisho-summary.webp",
  alt: "A sample compatibility result",
  width: 560,
  height: 718,
  points: [
    "See your compatibility grade and score",
    "Compare empathy, emotions, values, daily rhythm, and social balance",
    "Understand what works naturally and where to take care",
    "Read detailed guidance for love, friendship, work, and misunderstandings",
  ],
  pages: [
    {
      img: "/paywall-peek/en-actual-aisho-balance.webp",
      alt: "The five compatibility dimensions",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/en-actual-aisho-summary.webp",
      alt: "A compatibility grade and summary",
      width: 560,
      height: 718,
    },
  ],
};
const EN_PEEK_UNMEI: UnlockPeek = {
  img: "/paywall-peek/en-actual-unmei-reading.webp",
  alt: "A sample Destiny Blueprint reading",
  width: 390,
  height: 500,
  points: [
    "Create your birth chart from your date, time, and place of birth",
    "Combine your personality result and birth chart in a four-chapter AI reading",
    "Explore how you relate to people and the turning points ahead",
    "Return to your completed Destiny Blueprint whenever you like",
  ],
  pages: [
    {
      img: "/paywall-peek/en-actual-unmei-chart.webp",
      alt: "Your birth-chart wheel",
      width: 390,
      height: 500,
    },
    {
      img: "/paywall-peek/en-actual-unmei-reading.webp",
      alt: "Your personal Destiny Blueprint reading",
      width: 390,
      height: 500,
    },
    {
      img: "/paywall-peek/en-actual-unmei-turning.webp",
      alt: "A reading of your future turning points",
      width: 390,
      height: 500,
    },
  ],
};
const EN_PEEK_ALICE_FORTUNE: UnlockPeek = {
  img: "/paywall-peek/en-actual-tarot-result.webp",
  alt: "Destiny Blueprint and Alice Tarot previews",
  width: 390,
  height: 600,
  points: [
    "Create your personal birth-chart wheel",
    "Receive a four-chapter reading combining personality and astrology",
    "Use one-card, three-card, and YES / NO tarot readings",
    "Return to your Destiny Blueprint and tarot whenever you like",
  ],
  pages: [
    ...(EN_PEEK_UNMEI.pages?.slice(0, 2) ?? []),
    {
      img: "/paywall-peek/en-actual-tarot-result.webp",
      alt: "Alice interpreting a three-card tarot reading",
      width: 390,
      height: 600,
    },
  ],
};
export const peeks = {
  ebook: EN_PEEK_EBOOK,
  friends: EN_PEEK_FRIENDS,
  alice: EN_PEEK_ALICE,
  aisho: EN_PEEK_AISHO,
  unmei: EN_PEEK_UNMEI,
  alice_fortune: EN_PEEK_ALICE_FORTUNE
};
