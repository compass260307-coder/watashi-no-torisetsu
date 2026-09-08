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

export const KO_PEEK_EBOOK: UnlockPeek = {
  img: "/paywall-peek/ko-self-story-page-jellyfish_N-2026.webp",
  alt: "한국어로 작성된 성격 유형 전용 스토리 본문",
  width: 560,
  height: 793,
  points: [
    "나의 성격 유형을 주인공으로 한 16페이지 분량의 짧은 이야기",
    "내 성격과 특징을 한 편의 이야기처럼 읽을 수 있어요",
    "구매 후 바로 나만의 PDF로 받을 수 있어요",
  ],
  pages: [
    {
      img: "/paywall-peek/ko-self-story-page-jellyfish_N-2026.webp",
      alt: "한국어로 작성된 성격 유형 전용 스토리 본문",
      width: 560,
      height: 793,
    },
    {
      img: "/paywall-peek/ko-self-cover-jellyfish_N-2026.webp",
      alt: "나의 사용설명서 동행자의 이야기 표지",
      width: 560,
      height: 793,
    },
  ],
};

export const KO_PEEK_FRIENDS: UnlockPeek = {
  img: "/paywall-peek/ko-friends-ch1-jellyfish_N-2026.webp",
  alt: "친구 진단 종합 리포트 예시",
  width: 560,
  height: 793,
  points: [
    "친구 한 명 한 명이 바라본 내 모습을 개별적으로 읽을 수 있어요",
    "친구별 결과 시트를 모두 확인할 수 있어요",
    "사람마다 나를 다르게 보는 지점까지 자세히 알 수 있어요",
  ],
  pages: [
    {
      img: "/paywall-peek/ko-friends-ch1-jellyfish_N-2026.webp",
      alt: "친구 진단 종합 리포트 본문 예시",
      width: 560,
      height: 793,
    },
    {
      img: "/paywall-peek/ko-friends-cover-jellyfish_N-2026.webp",
      alt: "친구 진단 종합 리포트 표지",
      width: 560,
      height: 793,
    },
  ],
};

export const KO_PEEK_ALICE: UnlockPeek = {
  img: "/paywall-peek/ko-alice-scene-1.webp",
  alt: "AI 점성술사 Alice와 대화하는 화면",
  width: 560,
  height: 718,
  points: [
    "나의 성격 유형을 바탕으로 고민에 공감하며 답해 줘요",
    "연애·인간관계·진로 등 다양한 주제를 상담할 수 있어요",
    "말로 설명하기 어려운 고민도 대화를 통해 정리할 수 있어요",
    "완전판에서는 Alice와 바로 대화를 시작할 수 있어요",
  ],
  pages: [
    {
      img: "/paywall-peek/ko-alice-scene-0.webp",
      alt: "AI 점성술사 Alice와 대화하는 화면",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/ko-alice-scene-3.webp",
      alt: "Alice에게 진로를 상담하는 화면",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/ko-alice-scene-1.webp",
      alt: "Alice에게 연애를 상담하는 화면",
      width: 560,
      height: 718,
    },
  ],
};

export const KO_PEEK_AISHO: UnlockPeek = {
  img: "/paywall-peek/ko-aisho-result-summary-screen-2026.webp",
  alt: "실제 궁합 진단 결과 화면",
  width: 560,
  height: 718,
  points: [
    "두 사람의 궁합을 S~C 등급과 궁합도로 보여 줘요",
    "배려·정서·가치관·생활 리듬·사교 균형을 분석해요",
    "두 사람의 좋은 점과 주의할 부분을 알 수 있어요",
    "연애·우정·일·엇갈림의 네 가지 상황을 자세히 읽을 수 있어요",
  ],
  pages: [
    {
      img: "/paywall-peek/ko-aisho-result-balance-screen-2026.webp",
      alt: "실제 궁합 진단의 5축 균형 분석 화면",
      width: 560,
      height: 718,
    },
    {
      img: "/paywall-peek/ko-aisho-result-summary-screen-2026.webp",
      alt: "실제 궁합 진단의 등급과 총평 화면",
      width: 560,
      height: 718,
    },
  ],
};

export const KO_PEEK_UNMEI: UnlockPeek = {
  img: "/paywall-peek/ko-unmei-scene-1.webp",
  alt: "실제 운명의 설계도 감정 화면",
  width: 390,
  height: 500,
  points: [
    "생년월일·출생 시각·출생지로 나만의 출생 차트를 만들어요",
    "성격 진단과 별의 배치를 함께 읽는 4장 구성의 AI 감정이에요",
    "사람을 대하는 방식부터 앞으로 찾아올 전환점까지 읽어 줘요",
    "구매 후 완성된 운명의 설계도를 언제든 다시 볼 수 있어요",
  ],
  pages: [
    {
      img: "/paywall-peek/ko-unmei-scene-0.webp",
      alt: "운명의 설계도 출생 차트 화면",
      width: 390,
      height: 500,
    },
    {
      img: "/paywall-peek/ko-unmei-scene-1.webp",
      alt: "운명의 설계도 맞춤 감정 화면",
      width: 390,
      height: 500,
    },
    {
      img: "/paywall-peek/ko-unmei-scene-2.webp",
      alt: "운명의 설계도에서 전환점을 읽는 화면",
      width: 390,
      height: 500,
    },
  ],
};

export const KO_PEEK_ALICE_FORTUNE: UnlockPeek = {
  ...KO_PEEK_UNMEI,
  alt: "운명의 설계도와 Alice 타로 화면 예시",
  points: [
    "생년월일·출생 시각·출생지로 나만의 출생 차트를 만들어요",
    "성격 진단과 별의 배치를 함께 읽는 4장 구성의 AI 감정이에요",
    "오늘의 한 장·세 장 뽑기·YES / NO 타로를 이용할 수 있어요",
    "구매 후 운명의 설계도와 타로를 언제든 즐길 수 있어요",
  ],
  pages: [
    ...(KO_PEEK_UNMEI.pages?.slice(0, 2) ?? []),
    {
      img: "/paywall-peek/ko-tarot-reading-result.webp",
      alt: "Alice가 타로 카드 세 장을 해석하는 실제 결과 화면",
      width: 390,
      height: 600,
    },
  ],
};
