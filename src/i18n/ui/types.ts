import type { UnlockPeek } from "@/components/result/PaywallPeek";
import type { AccessProduct } from "@/lib/access-products";
import type { SwitchLocale } from "@/lib/locale-switch";
export type NavItem = {
  label: string;
  href: string;
  // 友達診断テスト: owner_token があれば /tako/[token] に解決、無ければロック表示
  // (BottomNav の友達診断タブと同じ挙動)。
  tako?: boolean;
  // ログイン: 別ページ遷移ではなく、現在のページの上にモーダルで重ねる。
  login?: boolean;
  // disabled: 準備中 (グレー表示・リンクなし)。ページが公開できたら外す。
  disabled?: boolean;
  // Alice: 購入権限がある場合だけリンク化し、それ以外は鍵付き課金導線にする。
  course?: "astrologer";
};
export type HeaderContent = {
  siteName: string;
  homeHref: string;
  nav: NavItem[];
  preparing: string;
  currentLangLabel: string;
  languageOptions: {
    locale: SwitchLocale;
    localLabel: string;
    nativeLabel: string;
  }[];
  languageModalTitle: string;
  ariaLangSwitch: string;
  ariaLangMenuClose: string;
  menuTitle: string;
  ariaMenuOpen: string;
  ariaMenuClose: string;
  reset: {
    label: string;
    confirm: string;
    run: string;
    cancel: string;
  };
};
export type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
  newTab?: boolean;
  disabled?: boolean;
  tako?: boolean;
  course?: "astrologer" | "unmei" | "tarot";
  children?: {
    label: string;
    href: string;
  }[];
};
export type FooterContent = {
  columns: {
    title: string;
    links: FooterLink[];
  }[];
  legalLinks: {
    label: string;
    href: string;
  }[];
  legalAriaLabel: string;
  copyright: string;
  disclaimer: string;
  preparing: string;
  takoBaseHref: string;
};
export type UnlockItem = {
  title: string;
  desc: string;
  peek?: UnlockPeek;
};
export type PlanDefinition = Readonly<{
  product: AccessProduct;
  eyebrow: string;
  title: string;
  basePrice: number;
  listPrice?: number;
  badge?: string;
  iconSrc?: string;
  accent: string;
  soft: string;
  items: readonly string[];
  inheritedItemCount: number;
}>;
export interface UiCopy {
  koreanLegal: Record<"before" | "terms" | "privacy" | "commerce" | "after", string>;
  loading: readonly [
    string,
    string,
    string,
    string
  ];
  lock: Record<"friend" | "astrologer" | "unmei" | "tarot", {
    ariaLabel: string;
    heading: string;
    bodyLine1: string;
    bodyLine2: string;
  }>;
  nav: Record<"me" | "friend" | "astrologer" | "unmei" | "tarot", string>;
  labels: Record<string, Record<string, string>>;
  header: HeaderContent;
  footer: FooterContent;
  peeks: Record<"ebook" | "friends" | "alice" | "aisho" | "unmei" | "alice_fortune", UnlockPeek>;
  basePeeks: UiCopy["peeks"];
  promo: {
    heading: [
      string,
      string
    ];
    studentHeading: [
      string,
      string
    ];
    studentCta: string;
    price: {
      list: string;
      sale: string;
      offPercent: number;
    };
    selfReportPrice: string;
    self: UnlockItem[];
    tako: UnlockItem[];
    studentSelf: UnlockItem[];
    studentTako: UnlockItem[];
    alice: UnlockItem;
    fortune: UnlockItem;
    unmei: UnlockItem;
  };
  carousel: {
    peekForItem: (item: string, ebookPeek?: UnlockPeek) => UnlockPeek | undefined;
    ctaLabel: (product: AccessProduct) => string;
    plans: readonly PlanDefinition[];
    premiumFeatures: {
      title: string;
      desc: string;
    }[];
  };
}

// Purchase/result dictionaries do not carry navigation or question-screen copy.
export type PurchaseUiCopy = Omit<UiCopy, "header" | "footer" | "nav" | "lock" | "loading">;
