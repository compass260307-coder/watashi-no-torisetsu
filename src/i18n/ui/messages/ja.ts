import type { UnlockPeek } from "@/components/result/PaywallPeek";
import { FULL_ACCESS_LIST_PRICE_JPY, FULL_ACCESS_PRICE_JPY, PREMIUM_BUNDLE_LIST_PRICE_JPY, PREMIUM_BUNDLE_PRICE_JPY, SELF_REPORT_PRICE_JPY, SELF_REPORT_UNLOCK_LABEL } from "@/lib/access-products";
import { peeks as basePeeks, peeks } from "../peeks/ja";
import type { FooterContent, HeaderContent, PlanDefinition, UiCopy, UnlockItem } from "../types";
import labels from "./ja-labels";
const { ebook: PEEK_EBOOK, friends: PEEK_FRIENDS, alice: PEEK_ALICE, aisho: PEEK_AISHO, unmei: PEEK_UNMEI, alice_fortune: PEEK_ALICE_FORTUNE } = peeks;
const header: HeaderContent = {
  siteName: "ワタシのトリセツ",
  homeHref: "/",
  nav: [
    {
      label: "性格診断テスト", href: "/diagnosis"
    },
    {
      label: "友達診断テスト", href: "/tako", tako: true
    },
    {
      label: "性格タイプ", href: "/types"
    },
    {
      label: "相性診断", href: "/aisho"
    },
    {
      label: "Alice", href: "/hoshiyomi", course: "astrologer"
    },
    {
      label: "タロット", href: "/tarot"
    },
    {
      label: "ログイン", href: "/login", login: true
    },
  ],
  preparing: "（準備中）",
  currentLangLabel: "日本語",
  languageOptions: [
    {
      locale: "en", localLabel: "英語", nativeLabel: "English"
    },
    {
      locale: "ko", localLabel: "韓国語", nativeLabel: "한국어"
    },
    {
      locale: "id", localLabel: "インドネシア語", nativeLabel: "Bahasa Indonesia"
    },
  ],
  languageModalTitle: "言語",
  ariaLangSwitch: "言語を切り替え",
  ariaLangMenuClose: "言語メニューを閉じる",
  menuTitle: "メニュー",
  ariaMenuOpen: "メニューを開く",
  ariaMenuClose: "メニューを閉じる",
  reset: {
    label: "データをリセット",
    confirm: "診断結果や招待リンクがこの端末から消えます。もとに戻せません。",
    run: "リセットする",
    cancel: "キャンセル",
  },
};
const footer: FooterContent = {
  // 3 カラム (診断 / サービス / サポート)。規約系は最下段 (コピーライト横) に移動。
  columns: [
    {
      title: "診断",
      links: [
        {
          label: "性格診断テスト", href: "/diagnosis"
        },
        {
          label: "友達診断テスト", href: "/tako", tako: true
        },
        {
          label: "性格タイプ", href: "/types"
        },
        {
          label: "相性診断", href: "/aisho"
        },
        {
          label: "Alice",
          href: "/hoshiyomi",
          course: "astrologer",
        },
        {
          label: "運命の設計図",
          href: "/unmei",
          course: "unmei",
        },
        {
          label: "タロット占い", href: "/tarot", course: "tarot"
        },
      ],
    },
    {
      title: "サービス",
      links: [
        {
          label: "サービスについて", href: "/about"
        },
        {
          label: "記事・コラム",
          href: "/articles",
          // 主要記事への入れ子リンク。フッターは全ページ共通なので、サイト全域からの
          // 内部リンクになる (クロール促進)。ラベルは短縮形・4本まで。
          children: [
            {
              label: "OCEAN診断とは", href: "/articles/ocean-shindan"
            },
            {
              label: "他己分析のやり方", href: "/articles/tako-bunseki"
            },
            {
              label: "トリセツの作り方",
              href: "/articles/torisetsu-tsukurikata",
            },
            {
              label: "16タイプとの違い",
              href: "/articles/sixteen-types-vs-ocean",
            },
          ],
        },
        {
          label: "運営会社",
          href: "https://sora-team.com",
          external: true,
          newTab: true,
        },
        // ⚠️ note / 記事: URL が決まったら有効化する。
        // { label: "note / 記事", href: "", external: true, newTab: true },
      ],
    },
    {
      title: "サポート",
      links: [
        {
          label: "お問い合わせ",
          href: "mailto:support@watashi-torisetsu.com",
          external: true,
        },
        // ⚠️ よくある質問: 専用ページ未実装のため一旦非表示 (現状は /about 内の一節のみ)。
        // { label: "よくある質問", href: "/faq" },
      ],
    },
  ],
  // 最下段 (コピーライト横に小さく横並び) の規約リンク。
  legalLinks: [
    {
      label: "利用規約", href: "/terms"
    },
    {
      label: "プライバシーポリシー", href: "/privacy"
    },
    {
      label: "特定商取引法に基づく表記", href: "/legal/commerce"
    },
  ],
  legalAriaLabel: "規約",
  copyright: "ワタシのトリセツ",
  disclaimer: "ワタシのトリセツ（私の取説）は、OCEAN（ビッグファイブ）診断と友達の回答で「自分の取扱説明書」を作る無料の性格診断サービスです。診断結果は Big Five 理論をベースにした、自分を知るための参考情報です。医学的・心理学的な診断を行うものではありません。",
  preparing: "（準備中）",
  takoBaseHref: "/tako",
};
const LEGACY_FULL_ACCESS_DISCOUNT_PERCENT = Math.round((1 - FULL_ACCESS_PRICE_JPY / FULL_ACCESS_LIST_PRICE_JPY) * 100);
const U_FRIEND_RESULTS: UnlockItem = {
  title: "2人目以降の友達診断結果をすべて解放",
  desc: "友達から見たキャラ・性格のギャップ・恋愛傾向・相性まで、友達ごとの結果シートをすべて読めます。",
};
const U_FRIEND_REPORT: UnlockItem = {
  title: "みんなから見たあなたの分析レポートを何度でも更新",
  desc: "友達の回答をまとめた他己分析PDFを作成。回答が増えるたびに、最新の内容へ何度でも更新できます。",
  peek: PEEK_FRIENDS,
};
const U_ALICE_FORTUNE: UnlockItem = {
  title: "Aliceによる占い機能をすべて解放",
  desc: "あなただけの「運命の設計図」に加えて、Aliceがタロットを引き、恋愛・仕事・人間関係の悩みや迷いを占ってくれます。",
  peek: PEEK_ALICE_FORTUNE,
};
const U_UNMEI: UnlockItem = {
  title: "あなた専用「運命の設計図」",
  desc: "性格診断と出生図を掛け合わせた4章仕立てのAI鑑定。今日の1枚・3枚引き・YES / NOのタロットも楽しめます。",
  peek: PEEK_UNMEI,
};
const U_ALICE: UnlockItem = {
  title: "あなたの専属占い師「Alice」とのチャット",
  desc: "あなたの性格や星を理解したAliceが、恋愛・仕事・人間関係など、あなたの悩みに合わせて答えます。",
  peek: PEEK_ALICE,
};
const U_AISHO: UnlockItem = {
  title: "相性診断機能をすべて解放",
  desc: "恋愛・友情・仕事での相性から、すれ違いやすいポイントまで、2人の関係を詳しく読み解けます。",
  peek: PEEK_AISHO,
};
const SELF_UNLOCKS: UnlockItem[] = [
  {
    // 覗き見(?)は付けない (2026-08-17 オーナー指示)。
    title: "あなたの結果のロック中の9セクションをすべて解放",
    desc: "恋愛・キャリアの深掘りから、周りから見た印象、もしもの時のあなたまで、診断結果の続きをすべて読めます。",
  },
  {
    title: "16ページ以上のあなただけの電子書籍",
    desc: "あなたの性格や特徴を一冊にまとめてお届け。保存・印刷できるので、いつでも読み返せます。",
    peek: PEEK_EBOOK,
  },
];
const FULL_ACCESS_SELF_UNLOCKS: UnlockItem[] = [
  SELF_UNLOCKS[0],
  SELF_UNLOCKS[1],
  U_ALICE,
  U_ALICE_FORTUNE,
  U_AISHO,
  U_FRIEND_RESULTS,
  U_FRIEND_REPORT,
];
const FULL_ACCESS_TAKO_UNLOCKS: UnlockItem[] = [
  U_FRIEND_RESULTS,
  U_FRIEND_REPORT,
  U_ALICE,
  U_ALICE_FORTUNE,
  U_AISHO,
  SELF_UNLOCKS[0],
  SELF_UNLOCKS[1],
];
const STUDENT_LITE_UNLOCKS: UnlockItem[] = [
  SELF_UNLOCKS[0],
  SELF_UNLOCKS[1],
  U_FRIEND_RESULTS,
  U_FRIEND_REPORT,
  U_AISHO,
];
const STUDENT_LITE_TAKO_UNLOCKS: UnlockItem[] = [
  U_FRIEND_RESULTS,
  U_FRIEND_REPORT,
  SELF_UNLOCKS[0],
  SELF_UNLOCKS[1],
  U_AISHO,
];
const JA_DESTINY_ITEM = "あなた専用「運命の設計図」";
const JA_AISHO_ITEM = "相性診断機能を解放";
const JA_TAROT_ITEM = "Aliceのタロット占い3種類をすべて解放";
const JA_LIGHT_ACCESS_ITEMS = [
  "自己診断結果のロック9つ全て",
  "16ページ以上の専用の電子書籍",
  "２人目以降の友達診断の結果",
  "何度でも作り直せる他己分析PDF",
  JA_AISHO_ITEM,
] as const;
const JA_FULL_ACCESS_ITEMS = [
  ...JA_LIGHT_ACCESS_ITEMS,
  JA_DESTINY_ITEM,
  "占い師『Alice』とのチャット30回",
  JA_TAROT_ITEM,
] as const;
const JA_PLANS: readonly PlanDefinition[] = [
  {
    product: "self_report",
    eyebrow: "学生の方へ",
    title: "学生向けプラン",
    basePrice: SELF_REPORT_PRICE_JPY,
    iconSrc: "/pricing/self-report-felt-transparent.png",
    accent: "#4F92A7",
    soft: "#EAF6F8",
    inheritedItemCount: 0,
    items: JA_LIGHT_ACCESS_ITEMS,
  },
  {
    product: "full_access",
    eyebrow: "自己・友達・占いまで",
    title: "完全版コース",
    basePrice: FULL_ACCESS_PRICE_JPY,
    iconSrc: "/pricing/full-access-connection-felt-transparent.png",
    accent: "#5B5BEF",
    soft: "#EEEEFF",
    inheritedItemCount: 0,
    items: JA_FULL_ACCESS_ITEMS,
  },
  {
    product: "premium_bundle",
    eyebrow: "すべてを、これひとつで",
    title: "全部入り・買い切り",
    basePrice: PREMIUM_BUNDLE_PRICE_JPY,
    listPrice: PREMIUM_BUNDLE_LIST_PRICE_JPY,
    iconSrc: "/pricing/premium-destiny-felt-transparent.png",
    accent: "#9A6A24",
    soft: "#FFF6DF",
    inheritedItemCount: 0,
    items: ["完全版コースのすべての機能"],
  },
] as const;
function peekForItem(item: string, ebookPeek?: UnlockPeek): UnlockPeek | undefined {
  if (item.includes("Alice"))
    return peeks.alice;
  if (item.includes("相性診断"))
    return peeks.aisho;
  if (item.includes("運命の設計図"))
    return peeks.unmei;
  if (item.includes("電子書籍") || item.includes("自己分析PDF")) {
    return ebookPeek ?? peeks.ebook;
  }
  if (item.includes("友達診断") || item.includes("他己分析PDF")) {
    return peeks.friends;
  }
  return undefined;
}
const copy: UiCopy = {
  koreanLegal: {
    "before": "", "terms": "", "privacy": "", "commerce": "", "after": ""
  }, nav: {
    "me": "自己診断", "friend": "友達診断", "astrologer": "Alice", "unmei": "運命", "tarot": "タロット"
  }, loading: ["読み込み中…", "閉じる", "読み込みに失敗しました。ページを更新すると、入力中の内容が失われる場合があります。", "ページを更新"], lock: {
    friend: {
      ariaLabel: "友達診断はロック中",
      heading: "友達診断はまだロック中",
      bodyLine1: "自己診断が完了すると、",
      bodyLine2: "友達に診断してもらえるよ",
    },
    astrologer: {
      ariaLabel: "Aliceはロック中",
      heading: "Aliceはまだロック中",
      bodyLine1: "自己診断が完了すると、",
      bodyLine2: "Aliceのコースを選べるよ",
    },
    unmei: {
      ariaLabel: "運命の設計図はロック中",
      heading: "運命の設計図はまだロック中",
      bodyLine1: "自己診断が完了すると、",
      bodyLine2: "設計図のコースを選べるよ",
    },
    tarot: {
      ariaLabel: "タロットはロック中",
      heading: "タロットはまだロック中",
      bodyLine1: "自己診断が完了すると、",
      bodyLine2: "タロット占いを楽しめるよ",
    },
  }, labels, header, footer, peeks, basePeeks,
  promo: {
    heading: ["あなたの物語は", "まだ完結していません"], studentHeading: ["あなたの物語は", "まだ完結していません"], studentCta: SELF_REPORT_UNLOCK_LABEL, price: {
      list: `¥${FULL_ACCESS_LIST_PRICE_JPY.toLocaleString("ja-JP")}`,
      sale: `¥${FULL_ACCESS_PRICE_JPY.toLocaleString("ja-JP")}`,
      offPercent: LEGACY_FULL_ACCESS_DISCOUNT_PERCENT,
    }, selfReportPrice: `¥${SELF_REPORT_PRICE_JPY.toLocaleString("ja-JP")}`, self: FULL_ACCESS_SELF_UNLOCKS, tako: FULL_ACCESS_TAKO_UNLOCKS, studentSelf: STUDENT_LITE_UNLOCKS, studentTako: STUDENT_LITE_TAKO_UNLOCKS, alice: U_ALICE, fortune: U_ALICE_FORTUNE, unmei: U_UNMEI
  },
  carousel: {
    peekForItem, ctaLabel: (product) => {
      if (product === "self_report")
        return "学生向けプランで開放する →"; if (product === "full_access")
        return "完全版で開放する →"; return "全部入りを解放する →";
    }, plans: JA_PLANS, premiumFeatures: [
      {
        title: "4章立てのAI鑑定文",
        desc: "幼少期から、これから訪れる転換点まで。あなたの物語を最初から最後まで読み解きます。",
      },
      {
        title: "専属AI占い師に相談30回",
        desc: "あなたの性格と星を全部知っている相手だから、話が早い。迷ったとき、いつでも。",
      },
      {
        title: "出生図ホイール",
        desc: "生まれた瞬間の星の配置から、あなたが本来持っている素質を一枚に。",
      },
      {
        title: "性格診断 × 星の掛け合わせ",
        desc: "「診断結果、当たってたけどなんで?」の答えが、星側から見えてきます。",
      },
      {
        title: "相性診断機能を解放",
        desc: "気になる相手との相性をS〜Cランクで判定。恋愛・友情・仕事、場面ごとの読み解きまで。",
      },
    ]
  },
};
export default copy;
