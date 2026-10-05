import diagnosisLabels from "../diagnosis/ja";
import type { FooterContent, HeaderContent } from "../types";
import type { NavigationCopy } from "../navigation-types";
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
const copy: NavigationCopy = { header, footer,
nav: {
    "me": "自己診断", "friend": "友達診断", "astrologer": "Alice", "unmei": "運命", "tarot": "タロット"
  },
loading: ["読み込み中…", "閉じる", "読み込みに失敗しました。ページを更新すると、入力中の内容が失われる場合があります。", "ページを更新"],
lock: {
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
  },
labels: {
    ...diagnosisLabels,
"top.TopHeader": {
    "（ロック中）": "（ロック中）",
    "Aliceを試す・本格相談を選ぶ": "Aliceを試す・本格相談を選ぶ"
  },
"top.TopFooter": {
    "（ロック中）": "（ロック中）"
  },
"TakoLockPopover": {
    "テストを受ける": "テストを受ける"
  },
"BottomNav": {
    "グローバルナビゲーション": "グローバルナビゲーション",
    " (準備中)": " (準備中)",
    "（ロック中）": "（ロック中）",
    "Aliceを試す・本格相談を選ぶ": "Aliceを試す・本格相談を選ぶ"
  }
},
};
export default copy;
