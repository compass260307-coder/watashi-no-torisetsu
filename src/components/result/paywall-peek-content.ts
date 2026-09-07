import type { UnlockPeek } from "./PaywallPeek";

export const PEEK_SECTIONS: UnlockPeek = {
  img: "/paywall-peek/sections.webp",
  alt: "解放される自己診断セクションの画面例",
  width: 640,
  height: 1067,
  lead: "無料版で鍵がかかっていた「続き」が、結果ページでそのまま読めるようになります。",
  points: [
    "恋愛・キャリアの深掘りの続きを全解放",
    "恋人が密かに我慢していることも読める",
    "「もしもの時のあなた」などシーン集つき",
    "注意点の続きと、その対処法まで",
  ],
};

export const PEEK_EBOOK: UnlockPeek = {
  img: "/paywall-peek/self-story-page-jellyfish_N-2026.webp",
  alt: "性格タイプを主人公にした短編小説の本文ページ",
  width: 560,
  height: 792,
  points: [
    "あなたの性格タイプを主人公にした、16ページの短編ストーリー",
    "縦書きの小説形式で、自分らしさを物語として読める",
    "購入後すぐに、あなた専用PDFとして受け取れます",
  ],
  pages: [
    {
      img: "/paywall-peek/self-story-page-jellyfish_N-2026.webp",
      alt: "性格タイプを主人公にした短編小説の本文ページ",
      width: 560,
      height: 792,
    },
    {
      img: "/paywall-peek/self-cover-jellyfish_N-2026.webp",
      alt: "電子書籍の表紙",
      width: 560,
      height: 841,
    },
  ],
};

export const PEEK_FRIENDS: UnlockPeek = {
  img: "/paywall-peek/friends-ch1.webp",
  alt: "友達診断まとめレポートの紙面例",
  width: 560,
  height: 841,
  points: [
    "友達一人ひとりから見たあなたも、個別に読める",
    "友達ごとの結果シートも、すべて確認できる",
    "一人ひとりの見え方の違いまで、個別に読める",
  ],
  pages: [
    {
      img: "/paywall-peek/friends-ch1.webp",
      alt: "友達診断まとめレポート第1章「みんなの目に映るあなたの全体像」",
      width: 560,
      height: 841,
    },
    {
      img: "/paywall-peek/friends-cover-sky-full-bleed-2026.webp",
      alt: "友達とのつながりを描いた友達診断まとめレポートの表紙",
      width: 560,
      height: 841,
    },
  ],
};

export const PEEK_ALICE: UnlockPeek = {
  img: "/paywall-peek/alice-scene-1.webp",
  alt: "AI占い師「Alice」とのチャットの様子",
  width: 560,
  height: 718,
  points: [
    "あなたの性格タイプを踏まえて、相談に寄り添ってくれる",
    "恋愛・人間関係・進路まで、幅広いテーマに対応",
    "言葉にしにくい悩みも、対話を通して整理できる",
    "完全版なら、すぐにAliceとの対話を始められる",
  ],
  pages: [
    {
      img: "/paywall-peek/alice-scene-0.webp",
      alt: "AI占い師「Alice」と話す画面",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/alice-scene-3.webp",
      alt: "Aliceに進路の相談をしているチャットの様子",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/alice-scene-1.webp",
      alt: "Aliceに恋愛相談をしているチャットの様子",
      width: 560,
      height: 718,
    },
  ],
};

export const PEEK_AISHO: UnlockPeek = {
  img: "/paywall-peek/aisho-result-summary-screen-2026.webp",
  alt: "実際の相性診断結果ページ",
  width: 560,
  height: 718,
  points: [
    "ふたりの相性をS〜Cのランクと相性度で表示",
    "思いやり・情緒・価値観・生活リズム・社交バランスを分析",
    "ふたりのいいところと、ここだけ注意したい点がわかる",
    "恋愛・友情・仕事・すれ違いの4場面を詳しく読める",
  ],
  pages: [
    {
      img: "/paywall-peek/aisho-result-balance-screen-2026.webp",
      alt: "実際の相性診断の5軸バランス分析画面",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/aisho-result-summary-screen-2026.webp",
      alt: "実際の相性診断のランクと総評画面",
      width: 560,
      height: 718,
    },
  ],
};

export const PEEK_UNMEI: UnlockPeek = {
  img: "/paywall-peek/unmei-scene-1.webp",
  alt: "実際の運命の設計図の鑑定画面",
  width: 390,
  height: 500,
  points: [
    "生年月日・出生時刻・出生地から、あなただけの出生図を作成",
    "性格診断と星の配置を掛け合わせた、4章仕立てのAI鑑定",
    "人との関わり方から、これから訪れる転換点まで読み解ける",
    "購入後は、完成した設計図をいつでも読み返せる",
  ],
  pages: [
    {
      img: "/paywall-peek/unmei-scene-0.webp",
      alt: "運命の設計図の出生図画面",
      width: 390,
      height: 500,
    },
    {
      img: "/paywall-peek/unmei-scene-1.webp",
      alt: "運命の設計図のあなた専用鑑定画面",
      width: 390,
      height: 500,
    },
    {
      img: "/paywall-peek/unmei-scene-2.webp",
      alt: "運命の設計図の転換点を読み解く画面",
      width: 390,
      height: 500,
    },
  ],
};

export const PEEK_ALICE_FORTUNE: UnlockPeek = {
  ...PEEK_UNMEI,
  alt: "運命の設計図とAliceのタロット占いの画面例",
  points: [
    "生年月日・出生時刻・出生地から、あなただけの出生図を作成",
    "性格診断と星の配置を掛け合わせた、4章仕立てのAI鑑定",
    "今日の1枚・3枚引き・YES / NOのタロット占い",
    "購入後は、運命の設計図とタロットをいつでも楽しめる",
  ],
  pages: [
    ...(PEEK_UNMEI.pages?.slice(0, 2) ?? []),
    {
      img: "/paywall-peek/tarot-reading-result.jpg",
      alt: "Aliceが3枚のタロットカードを読み解いている実際の結果画面",
      width: 390,
      height: 600,
    },
  ],
};
