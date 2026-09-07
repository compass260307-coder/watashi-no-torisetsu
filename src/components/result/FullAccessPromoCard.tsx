"use client";

// PR3: 課金案内カード (トップ以外の全ページ最下部に常設)。
// 2026-07-11: MBTI 参考でデザイン刷新 (画像 + 横並び・グループ色・折り紙装飾・値引き表記)。
//
// 目的: 旧導線は「キャリア」しか訴求できておらず「友達の個人結果も解放される」ことが
//   伝わらなかった。MBTI 式に「解放される中身を項目で見せて価値を可視化」する。
//
// 解放される項目 (見出し+説明。UNLOCKS 定数で管理)。完全版一本化:
//   - 自己診断結果の完全解放
//   - 16ページ以上の自己分析完全版PDFレポート
//   - 友達診断結果の完全解放
//   - 何度もダウンロードできる友達分析完全版PDFレポート
//   - Aliceによる占い機能 (運命の設計図・タロット3種類)
//   - 専属占い師 Aliceとのチャット
//
// id="fullaccess-promo": ページ内のロック要素からの scrollToPaywall() のスクロール先
//   (着地パルスも同 id を対象にするため必ず維持)。
// CTA は既存 FullAccessCta を全幅で再利用 (未ログイン=401 はトップへ funnel)。
//
// props はすべて任意 (未指定でも従来どおり動く):
//   - imageSrc: あるとき横並び (md+) の MBTI レイアウト。無いとき中央 1 カラム。
//   - group:    カードの地色/アクセント/装飾のグループ色。未指定は unknown (ラベンダー)。

import { useEffect, useRef } from "react";
import { KoreanPurchaseLegalNotice } from "@/components/checkout/KoreanPurchaseLegalNotice";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { FullAccessCta } from "./FullAccessCta";
import { PeekButton, type UnlockPeek } from "./PaywallPeek";
import {
  PEEK_AISHO,
  PEEK_ALICE,
  PEEK_ALICE_FORTUNE,
  PEEK_EBOOK,
  PEEK_FRIENDS,
  PEEK_UNMEI,
} from "./paywall-peek-content";
import { SelfAccessPlanCarousel } from "./SelfAccessPlanCarousel";
import {
  cardColorsForGroup,
  heroColorsForGroup,
  resultActionColorsForGroup,
} from "@/lib/hero-colors";
import { paywallCardMode, type PaywallCardMode } from "@/lib/feature-flags";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import { DIAGNOSIS_COUNT_SNAPSHOT } from "@/lib/proof-stats";
import {
  friendReportPeekImagePath,
  selfReportPeekImagePath,
  selfReportStoryPreviewPagePath,
} from "@/lib/report-story-images";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import type { ResultLocale } from "@/i18n/result";
import {
  FULL_ACCESS_LIST_PRICE_JPY,
  FULL_ACCESS_PRICE_JPY,
  FULL_ACCESS_PRICE_KRW,
  SELF_REPORT_PRICE_JPY,
  SELF_REPORT_PRICE_KRW,
  SELF_REPORT_UNLOCK_LABEL,
  SINGLE_ALL_ACCESS_PAYWALL_PRODUCT,
  THREE_COURSE_PAYWALL_VERSION,
  type AccessEntitlements,
  type AccessProduct,
} from "@/lib/access-products";

const LEGACY_FULL_ACCESS_DISCOUNT_PERCENT = Math.round(
  (1 - FULL_ACCESS_PRICE_JPY / FULL_ACCESS_LIST_PRICE_JPY) *
    100,
);

// 値引き表記に使うロケール別価格。実課金額はサーバ側のStripe Priceで検証する。
const PRICE_COPY = {
  ja: {
    list: `¥${FULL_ACCESS_LIST_PRICE_JPY.toLocaleString("ja-JP")}`,
    sale: `¥${FULL_ACCESS_PRICE_JPY.toLocaleString("ja-JP")}`,
    offPercent: LEGACY_FULL_ACCESS_DISCOUNT_PERCENT,
  },
  ko: {
    list: "₩12,900",
    sale: `₩${FULL_ACCESS_PRICE_KRW.toLocaleString("ko-KR")}`,
    offPercent: 62,
  },
} as const;

const SELF_REPORT_PRICE_COPY = {
  ja: `¥${SELF_REPORT_PRICE_JPY.toLocaleString("ja-JP")}`,
  ko: `₩${SELF_REPORT_PRICE_KRW.toLocaleString("ko-KR")}`,
} as const;

// 解放される項目 (見出し + マイクロコピー)。2026-07-22: 自己診断＋友達診断を
// すべて含む完全版パッケージに一本化。パッと価値が伝わる項目に集約。
// 解放項目。設置ページで並びを変える (自己診断=自分の解放が先 / 友達診断=友達の解放が先)。
type UnlockItem = { title: string; desc: string; peek?: UnlockPeek };

// 自己分析の電子書籍/PDF・自己/友達の解放の共通パーツ (ページ間で文言を揃える)。
const U_FRIEND_RESULTS: UnlockItem = {
  title: "2人目以降の友達診断結果をすべて解放",
  desc: "友達から見たキャラ・性格のギャップ・恋愛傾向・相性まで、友達ごとの結果シートをすべて読めます。",
};
const U_FRIEND_REPORT: UnlockItem = {
  title: "何度でも作り直せる他己分析PDF",
  desc: "みんなの回答を集約した総合レポート。回答が増えるたびに何度でも更新できます。",
  peek: PEEK_FRIENDS,
};
// 完全版に含むAliceの占い機能。運命の設計図とタロットを1項目にまとめる。
const U_ALICE_FORTUNE: UnlockItem = {
  title: "Aliceによる占い機能をすべて解放",
  desc: "あなた専用の「運命の設計図」と、今日の1枚・3枚引き・YES / NOのタロットをすべて楽しめます。",
  peek: PEEK_ALICE_FORTUNE,
};
// 運命タブから開いたカードでは、設計図そのものを主役にして先頭へ置く。
const U_UNMEI: UnlockItem = {
  title: "あなた専用「運命の設計図」",
  desc: "性格診断と出生図を掛け合わせた4章仕立てのAI鑑定。今日の1枚・3枚引き・YES / NOのタロットも楽しめます。",
  peek: PEEK_UNMEI,
};
const U_ALICE: UnlockItem = {
  title: "あなたの専属占い師「Alice」とのチャット",
  desc: "あなたの性格と星を理解したAliceに、悩みや迷いを相談できます。",
  peek: PEEK_ALICE,
};
const U_AISHO: UnlockItem = {
  title: "相性診断機能をすべて解放",
  desc: "気になる相手との相性を、恋愛・友情・仕事・すれ違いなどの場面別に詳しく読めます。",
  peek: PEEK_AISHO,
};
// 自己診断結果ページ (/me) 用。
const SELF_UNLOCKS: UnlockItem[] = [
  {
    // 覗き見(?)は付けない (2026-08-17 オーナー指示)。
    title: "あなたの結果のロック中の9セクションをすべて解放",
    desc: "恋愛・キャリアの深掘りから、周りから見た印象、もしもの時のあなたまで、鍵つきの続きがぜんぶ読める。",
  },
  {
    title: "16ページ以上のあなたの電子書籍",
    desc: "あなたのタイプを一冊にまとめてメールでお届け。保存・印刷でき、いつでも見返せます。",
    peek: PEEK_EBOOK,
  },
];

// 日本語完全版カードの並び。設置ページに関連する項目を先頭へ置く。
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
  U_FRIEND_RESULTS,
  U_FRIEND_REPORT,
  SELF_UNLOCKS[1],
];
const STUDENT_LITE_TAKO_UNLOCKS: UnlockItem[] = [
  U_FRIEND_RESULTS,
  U_FRIEND_REPORT,
  SELF_UNLOCKS[0],
  SELF_UNLOCKS[1],
];

const KO_SELF_UNLOCKS: UnlockItem[] = [
  {
    title: "내 결과의 잠긴 9개 섹션 전체 해제",
    desc: "연애와 커리어 심층 분석부터 주변에서 보는 인상, 만약의 순간에 드러나는 모습까지 잠긴 내용을 모두 읽을 수 있어요.",
  },
  {
    title: "16페이지 이상의 나만의 전자책",
    desc: "나의 유형을 한 권으로 정리해 이메일로 보내 드려요. 저장하거나 인쇄하고 언제든 다시 확인할 수 있어요.",
  },
  {
    title: "당신의 전담 점성술사 ‘Alice’와 채팅",
    desc: "내 성격과 별을 이해한 Alice에게 고민이나 망설임을 상담할 수 있어요.",
    peek: PEEK_ALICE,
  },
  {
    title: "Alice의 운세 기능 전체 해제",
    desc: "나만의 ‘운명의 설계도’와 오늘의 한 장·세 장 뽑기·YES / NO 타로를 모두 이용할 수 있어요.",
    peek: PEEK_ALICE_FORTUNE,
  },
  {
    title: "궁합 진단 기능 전체 해제",
    desc: "궁금한 상대와의 궁합을 연애·우정·일·엇갈림 등 상황별로 자세히 읽을 수 있어요.",
    peek: PEEK_AISHO,
  },
  {
    title: "두 번째 친구부터 친구 진단 결과 전체 해제",
    desc: "친구가 보는 캐릭터, 성격 차이, 연애 성향과 궁합까지 친구별 결과 시트를 모두 읽을 수 있어요.",
  },
  {
    title: "몇 번이든 다시 만들 수 있는 타인 분석 PDF",
    desc: "모두의 답변을 한데 모은 종합 리포트예요. 답변이 늘 때마다 몇 번이든 업데이트할 수 있어요.",
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
  desc: "성격 진단과 출생도를 함께 읽는 4장 구성의 AI 감정이에요. 오늘의 한 장·세 장 뽑기·YES / NO 타로도 즐길 수 있어요.",
  peek: PEEK_UNMEI,
};

function promoteUnlockItem(
  items: UnlockItem[],
  target: UnlockItem,
  replacement = target,
): UnlockItem[] {
  const targetIndex = items.indexOf(target);
  if (targetIndex < 0) return items;
  return [
    replacement,
    ...items.slice(0, targetIndex),
    ...items.slice(targetIndex + 1),
  ];
}

// 現行日本版では、相性診断も ¥499 の完全版で解放する。
const AISHO_PRODUCTS: readonly AccessProduct[] = [
  "full_access",
];

// 相性ページ (variant="aisho") 用のピンク基調トーン。グループ色ではなく固定。
//   mid は隅の折り紙装飾の中間色 (heroBg 相当)。
const PINK_TONE = {
  accent: "#D14E86",
  softBg: "#FDEEF5",
  border: "#F6D2E2",
  panelBg: "#FBE1EC",
  mid: "#EF93BC",
};

// お試しコースの専用トーン。自己分析レポートのイラストにある
// ネイビー・青緑・生成りを拾い、相性カードのピンクとは分ける。
const STUDENT_LITE_TONE = {
  accent: "#3A8995",
  softBg: "#F8F4E9",
  border: "#BDDDE0",
  panelBg: "#E8F4F2",
  mid: "#79B7BF",
};

// カード隅の折り紙風ダイヤ装飾 (グループ色の3トーンで折り目の陰影)。
function CornerDecor({
  dark,
  mid,
  light,
  className,
  mirror = false,
}: {
  dark: string;
  mid: string;
  light: string;
  className?: string;
  mirror?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      <path d="M50 4 L4 50 L50 50 Z" fill={light} />
      <path d="M50 4 L96 50 L50 50 Z" fill={mid} />
      <path d="M96 50 L50 96 L50 50 Z" fill={dark} />
      <path d="M4 50 L50 96 L50 50 Z" fill={mid} />
    </svg>
  );
}

function CheckItem({
  title,
  desc,
  accent,
  peek,
}: {
  title: string;
  desc: string;
  accent: string;
  peek?: UnlockPeek;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: accent }}
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="min-w-0">
        {/* タイトル + 覗き見(?)。? は文章の末尾にインラインで続ける
            (2行に折り返しても最後の文字のすぐ後ろに来る。右端に浮かせない)。
            [text-wrap:pretty] で ? のぶん幅が詰まっても1文字孤立行を防ぐ。 */}
        <span className="block text-[14px] font-black leading-snug text-[#2E2E5C] [text-wrap:pretty]">
          {title}
          {peek && <PeekButton peek={peek} title={title} accent={accent} />}
        </span>
        <span className="body-gothic block text-[12px] leading-[1.6] text-[#5A5A6E]">
          {desc}
        </span>
      </span>
    </li>
  );
}

export function FullAccessPromoCard({
  ownerToken,
  imageSrc,
  reportCharacterImageSrc,
  imageAlt = "",
  group = "unknown",
  // ページ別の配色のみ切替 (コピー・項目・レイアウトは共通)。
  //   "aisho" = 相性ページ用ピンク基調 / "self" (既定) = その人のグループ色。
  variant = "self",
  locale = "ja",
  // 購入後の着地。/tako のロックから使うときは "tako" を渡して元の /tako に戻す。
  returnTo,
  // アンカー id。既定 "fullaccess-promo"。モーダル内で描画するときは別値を渡して
  // 最下部の常設カードと id 重複させない (PaywallModal が "fullaccess-promo-modal" を渡す)。
  anchorId = "fullaccess-promo",
  // モーダル表示時に渡す閉じるハンドラ。指定時は右上の折り紙装飾の中心に×を乗せる。
  onClose,
  // 解放項目の並び。"self"=自己診断ページ / "tako"=友達診断ページ (既定 self)。
  surface = "self",
  ctaSource,
  products,
  previewMode = false,
  previewJapaneseThreeCourse = false,
  previewEntitlements,
  legacyPlanStyle = false,
  cardMode,
  standaloneProduct,
  defaultProduct,
  heading,
  noShadow = false,
  benefitsBeforePrice = false,
}: {
  ownerToken?: string;
  imageSrc?: string | null;
  /** キャラ別PDF表紙の解決に使う元キャラ画像。カード装飾の imageSrc とは分けて渡す。 */
  reportCharacterImageSrc?: string | null;
  imageAlt?: string;
  group?: ThirtyTwoGroup;
  variant?: "self" | "aisho";
  locale?: ResultLocale;
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  anchorId?: string;
  onClose?: () => void;
  surface?: "self" | "tako";
  ctaSource?: string;
  products?: readonly AccessProduct[];
  /** ローカルUI確認用。計測・権利確認・Checkoutを実行しない。 */
  previewMode?: boolean;
  /** ローカルプレビューでだけ、日本版の旧松竹梅を3コースで表示する。 */
  previewJapaneseThreeCourse?: boolean;
  /** ローカルプレビューでだけ、購入済み権利を模擬して差額表示を確認する。 */
  previewEntitlements?: AccessEntitlements;
  /** 運命の設計図ページ用のコンパクトな単一課金カード表示。 */
  legacyPlanStyle?: boolean;
  /** 開発プレビュー用。未指定時は共通の課金カード設定を使う。 */
  cardMode?: PaywallCardMode;
  /** 単一カードとして特定の商品を表示する。学生ライトのモーダル導線で使用。 */
  standaloneProduct?: "self_report";
  /** 3コース比較で最初に中央表示するコース。 */
  defaultProduct?: AccessProduct;
  /** 3コース比較の導線別見出し。 */
  heading?: string;
  /** ページ背景と自然につなげたいインライン表示ではカード影を付けない。 */
  noShadow?: boolean;
  /** 自己診断結果ページ末尾では、解放内容を価格・購入導線より先に見せる。 */
  benefitsBeforePrice?: boolean;
}) {
  const isKorean = locale === "ko";
  const isStandaloneSelfReport = standaloneProduct === "self_report";
  // 通常カードは feature flag 1か所で旧単一カードと松竹梅を切り替える。
  // legacyPlanStyle は設計図ページ専用の単一カードを表示する個別導線なので優先する。
  const resolvedCardMode = cardMode ?? paywallCardMode();
  const usesLegacyFullAccessCard =
    !isStandaloneSelfReport &&
    !legacyPlanStyle &&
    resolvedCardMode === "legacy";
  const isSelfReportProduct =
    isStandaloneSelfReport ||
    (!usesLegacyFullAccessCard &&
      surface === "self" &&
      variant === "self");
  const usesPlanCarousel =
    !isStandaloneSelfReport &&
    (legacyPlanStyle ||
      variant === "aisho" ||
      (resolvedCardMode === "three-course" &&
        (variant === "self" || variant === "aisho")));
  const product = isSelfReportProduct ? "self_report" : "full_access";
  const paywallProduct = usesPlanCarousel
    ? SINGLE_ALL_ACCESS_PAYWALL_PRODUCT
    : product;
  const paywallVersion =
    usesPlanCarousel || isStandaloneSelfReport || usesLegacyFullAccessCard
      ? THREE_COURSE_PAYWALL_VERSION
      : "legacy";
  const paywallPlacement = onClose ? "modal" : "inline";
  const baseUnlocks = isKorean
    ? product === "self_report"
      ? surface === "tako"
        ? KO_STUDENT_LITE_TAKO_UNLOCKS
        : KO_STUDENT_LITE_UNLOCKS
      : surface === "tako"
        ? KO_TAKO_UNLOCKS
        : KO_SELF_UNLOCKS
    : product === "self_report"
      ? surface === "tako"
        ? STUDENT_LITE_TAKO_UNLOCKS
        : STUDENT_LITE_UNLOCKS
      : surface === "tako"
        ? FULL_ACCESS_TAKO_UNLOCKS
        : FULL_ACCESS_SELF_UNLOCKS;
  const contextualUnlocks =
    returnTo === "hoshiyomi"
      ? promoteUnlockItem(
          baseUnlocks,
          isKorean ? KO_SELF_UNLOCKS[2] : U_ALICE,
        )
      : returnTo === "unmei"
        ? promoteUnlockItem(
            baseUnlocks,
            isKorean ? KO_SELF_UNLOCKS[3] : U_ALICE_FORTUNE,
            isKorean ? KO_UNMEI : U_UNMEI,
          )
        : baseUnlocks;
  const reportCharacterSource = reportCharacterImageSrc ?? imageSrc;
  const characterFriendCover = friendReportPeekImagePath(reportCharacterSource);
  const characterSelfCover = selfReportPeekImagePath(reportCharacterSource);
  const characterSelfStoryPage =
    selfReportStoryPreviewPagePath(reportCharacterSource);
  const characterEbookPeek: UnlockPeek | null = characterSelfCover
    ? {
        ...PEEK_EBOOK,
        pages: PEEK_EBOOK.pages?.map((page, index) => {
          if (index === 0 && characterSelfStoryPage) {
            return {
              ...page,
              img: characterSelfStoryPage,
              alt: `${imageAlt || "あなた"}を主人公にした短編小説の本文`,
              width: 560,
              height: 792,
            };
          }
          if (index === 1) {
            return {
              ...page,
              img: characterSelfCover,
              alt: `${imageAlt || "あなた"}の短編ストーリー表紙`,
              width: 560,
              height: 841,
            };
          }
          return page;
        }),
      }
    : null;
  const characterFriendsPeek: UnlockPeek | null = characterFriendCover
    ? {
        ...PEEK_FRIENDS,
        pages: PEEK_FRIENDS.pages?.map((page, index) =>
          index === 1
            ? {
                ...page,
                img: characterFriendCover,
                alt: `${imageAlt || "あなた"}の友達診断まとめレポート表紙`,
                width: 560,
                height: 841,
              }
            : page,
        ),
      }
    : null;
  const unlocks = contextualUnlocks.map((item) => {
    if (characterEbookPeek && item.peek === PEEK_EBOOK) {
      return { ...item, peek: characterEbookPeek };
    }
    if (characterFriendsPeek && item.peek === PEEK_FRIENDS) {
      return { ...item, peek: characterFriendsPeek };
    }
    return item;
  });
  const price = PRICE_COPY[locale];
  // 色だけ variant で切替 (コピー・項目・レイアウトは全 variant 共通)。
  // aisho は相性ページ用にピンク基調、それ以外はその人のグループ色。
  const groupTone = cardColorsForGroup(group);
  const actionTone = resultActionColorsForGroup(group);
  const tone = isStandaloneSelfReport
    ? STUDENT_LITE_TONE
    : variant === "aisho"
      ? PINK_TONE
      : groupTone;
  const midTone = isStandaloneSelfReport
    ? STUDENT_LITE_TONE.mid
    : variant === "aisho"
      ? PINK_TONE.mid
      : heroColorsForGroup(group).heroBg;
  const hasImage = !!imageSrc;
  // 学生向けリンクは現行の完全版カードから外す。学生向け商品設定は維持する。
  const showFullAccessLink = isStandaloneSelfReport && !!onClose;
  const courseSwitchLabel = showFullAccessLink
    ? isKorean
      ? "완전판 보기"
      : "完全版はこちら"
    : null;
  const unlockBenefitsPanel = (
    <div
      className={
        benefitsBeforePrice
          ? "mt-6 text-left"
          : "mt-6 rounded-[20px] bg-white px-4 py-5 text-left shadow-[0_8px_24px_rgba(46,46,92,0.06)] md:px-6 md:py-6"
      }
    >
      {benefitsBeforePrice ? null : (
        <h3 className="text-[16px] font-bold leading-snug text-[#2E2E5C]">
          {isKorean
            ? "업그레이드로 이용할 수 있는 항목"
            : "アップグレードで手に入るもの"}
        </h3>
      )}
      <ul
        className={`${benefitsBeforePrice ? "" : "mt-4"} grid gap-2.5 text-left`}
      >
        {unlocks.map(({ title, desc, peek }) => (
          <CheckItem
            key={title}
            title={title}
            desc={desc}
            accent={tone.accent}
            peek={peek}
          />
        ))}
      </ul>
    </div>
  );

  function handleCourseSwitch() {
    onClose?.();
  }

  // 課金ファネル計測: カードがビューポートに入ったら paywall_viewed を1回送る。
  // dedup はページ単位で sessionStorage (タブ内1回)。
  // threshold は 0.2: カードは縦長 (画像つきで1000px級) で、背の低い端末では
  // 50% が同時に画面へ入らず「見たのに未計測」になるため低めにする (2026-07-13)。
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (previewMode) return;
    const el = cardRef.current;
    if (!el) return;
    const page = trackingPageFromPathname(window.location.pathname);
    const dedupKey = `torisetsu_paywall_viewed_${page}_${paywallVersion}_${paywallPlacement}`;
    try {
      if (sessionStorage.getItem(dedupKey)) return;
    } catch {
      // sessionStorage 不可 (プライベートモード等) でも計測は試みる
    }
    const fire = () => {
      // 送信を先に、dedup フラグは後 (先にフラグを立てると送信失敗時に永久欠測)
      track("paywall_viewed", {
        ownerToken: ownerToken ?? null,
        metadata: {
          page,
          variant,
          product: paywallProduct,
          paywall_version: paywallVersion,
          placement: paywallPlacement,
          surface: surface ?? "self",
        },
      });
      try {
        sessionStorage.setItem(dedupKey, "1");
      } catch {
        /* noop */
      }
    };
    // IntersectionObserver 非対応環境はマウント時に発火 (無計測より過大side良し)
    if (typeof IntersectionObserver === "undefined") {
      fire();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fire();
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [
    ownerToken,
    paywallPlacement,
    paywallProduct,
    paywallVersion,
    previewMode,
    surface,
    variant,
  ]);

  // 日本版・韓国版とも3コースを横スワイプで比較する。
  if (usesPlanCarousel) {
    return (
      <div
        ref={cardRef}
        className={
          onClose
            ? "px-3 pb-6 pt-3 md:px-6 md:pb-10 md:pt-6"
            : "pb-8 pt-2 md:pb-10 md:pt-4"
        }
      >
        <SelfAccessPlanCarousel
          ownerToken={ownerToken}
          anchorId={anchorId}
          onClose={onClose}
          ctaSource={
            ctaSource ?? (surface === "tako" ? "tako_promo_card" : undefined)
          }
          frameless={!onClose}
          returnTo={returnTo ?? (surface === "tako" ? "tako" : "me")}
          locale={locale}
          products={
            products ?? (variant === "aisho" ? AISHO_PRODUCTS : undefined)
          }
          previewMode={previewMode}
          previewJapaneseThreeCourse={previewJapaneseThreeCourse}
          previewEntitlements={previewEntitlements}
          legacyStyle={legacyPlanStyle}
          defaultProduct={defaultProduct}
          heading={heading}
          ebookPeek={characterEbookPeek ?? PEEK_EBOOK}
        />
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`${anchorId}-title`}
      className="px-4 pt-6 pb-10 md:px-8"
    >
        <div
          id={anchorId}
          ref={cardRef}
          className={`relative mx-auto w-full scroll-mt-[80px] rounded-3xl border-2 ${
            noShadow ? "shadow-none" : "shadow-[0_16px_48px_rgba(46,46,92,0.12)]"
          } ${
            hasImage
              ? "max-w-[1080px] md:flex md:items-stretch"
              : "max-w-[460px]"
          }`}
          style={{ backgroundColor: tone.softBg, borderColor: tone.border }}
        >
          {!onClose && (
          <CornerDecor
            dark={tone.accent}
            mid={midTone}
            light={tone.border}
            mirror
            className="pointer-events-none absolute -right-3 -top-3 z-10 h-14 w-14 rotate-[12deg] drop-shadow-sm md:h-16 md:w-16"
          />
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={isKorean ? "닫기" : "閉じる"}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_4px_14px_rgba(46,46,92,0.3)] transition hover:scale-105 active:scale-95"
              style={{ backgroundColor: tone.accent }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
          <CornerDecor
            dark={tone.accent}
            mid={midTone}
            light={tone.border}
            className="pointer-events-none absolute -bottom-3 -left-3 z-10 h-14 w-14 rotate-[-12deg] drop-shadow-sm md:h-16 md:w-16"
          />

          {/* 画像 (md+ の左カラムのみ)。モバイルはカードを縦に長くしないため非表示 (2026-08-17)。 */}
          {hasImage && (
            <div
              className="hidden items-center justify-center rounded-t-3xl px-6 pt-7 md:flex md:w-[40%] md:rounded-l-3xl md:rounded-tr-none md:px-6 md:py-8"
              style={{ backgroundColor: tone.panelBg }}
            >
              <SmoothImage
                src={imageSrc!}
                alt={imageAlt}
                width={640}
                height={640}
                className="h-auto w-full max-w-[280px] md:max-w-[340px]"
              />
            </div>
          )}

          <div
            className={
              hasImage
                ? "px-6 py-6 text-left md:flex-1 md:px-9 md:py-6"
                : "px-6 py-6 text-center"
            }
          >
            {/* バッジ (★ + 今すぐロックを解除) */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[14px] font-black text-[#2E2E5C] shadow-[0_2px_8px_rgba(46,46,92,0.10)]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{ color: tone.accent }}
              >
                <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
              </svg>
              {isSelfReportProduct
                ? isKorean
                  ? "학생 플랜"
                  : "学生向けプラン"
                : isKorean
                  ? "지금 잠금 해제"
                  : "今すぐロックを解除"}
            </span>

            {/* 見出し */}
            <h2
              id={`${anchorId}-title`}
              className="mt-2.5 text-[26px] font-bold leading-[1.3] text-[#2E2E5C] md:text-[34px]"
            >
              {isSelfReportProduct ? (
                <>
                  {isKorean ? "자기 진단을" : "自己診断を"}
                  <br />
                  {isKorean ? "더 깊이" : "もっと深く"}
                </>
              ) : isKorean ? (
                <>
                  당신의 이야기는
                  <br />
                  아직 끝나지 않았어요
                </>
              ) : (
                <>
                  あなたの物語は
                  <br />
                  まだ完結していません
                </>
              )}
            </h2>

            {/* 続編訴求 */}
            <p className="body-gothic mt-2 text-[13px] leading-[1.6] text-[#5A5A6E]">
              {isSelfReportProduct
                ? isKorean
                  ? "자기 진단과 친구 진단, 16페이지 이상의 전용 전자책을 1회 결제로 이용할 수 있어요."
                  : "自己診断と友達診断、16ページ以上の専用電子書籍を買い切りで利用できます。"
                : isKorean
                  ? "무료 리포트를 읽었다면 한 걸음 더 깊이 들어가 보세요. 연애·일·인간관계·친구가 보는 인상과 Alice의 운세·타로·상담까지 모두 열립니다."
                  : "無料レポートを読んだら、次はもう一歩深くへ。恋愛・仕事・人間関係・友達から見た印象まで、さらに具体的に深掘りします。"}
            </p>

            {benefitsBeforePrice ? unlockBenefitsPanel : null}

            {/* ページ末尾では解放内容の後、それ以外では従来どおり冒頭に価格を置く。 */}
            <div
              className={`${benefitsBeforePrice ? "mt-6" : "mt-3"} flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${
                hasImage ? "" : "justify-center"
              }`}
            >
              {/* 価格タグは Noto Sans JP/KR の 700 + tabular-nums (M PLUS は撤回 2026-09-04)。 */}
              {isSelfReportProduct ? (
                <span className="text-[30px] font-bold tabular-nums tracking-[-0.02em] leading-none text-[#2E2E5C] md:text-[50px]">
                  {SELF_REPORT_PRICE_COPY[locale]}
                </span>
              ) : (
                <span className="text-[30px] font-bold tabular-nums tracking-[-0.02em] leading-none text-[#2E2E5C] md:text-[50px]">
                  {price.sale}
                </span>
              )}
            </div>

            <p
              className={`body-gothic mt-2 text-[13px] leading-[1.6] text-[#5A5A6E] ${
                hasImage ? "" : "text-center"
              }`}
            >
              {isKorean
                ? "월 구독이 아닌, 1회 결제"
                : "買い切り（お支払いは1回のみ）"}
            </p>

            <div className="mt-4">
              <FullAccessCta
                ownerToken={ownerToken}
                unauthHref={isKorean ? "/ko/diagnosis" : "/diagnosis"}
                locale={locale}
                source={
                  ctaSource ??
                  (surface === "tako" ? "tako_promo_card" : undefined)
                }
                returnTo={returnTo}
                product={product}
                paywallVersion={
                  paywallVersion === THREE_COURSE_PAYWALL_VERSION
                    ? THREE_COURSE_PAYWALL_VERSION
                    : undefined
                }
                placement={paywallPlacement}
                previewMode={previewMode}
                accentColor={actionTone.accent}
                shadowColor={actionTone.shadow}
              >
                {isSelfReportProduct
                  ? isKorean
                    ? "학생 플랜으로 해제 →"
                    : SELF_REPORT_UNLOCK_LABEL
                  : isKorean
                    ? "모든 결과 잠금 해제 →"
                    : "全ての結果をアンロック →"}
              </FullAccessCta>
            </div>

            <p
              className={`body-gothic mt-2.5 text-[13px] leading-[1.6] text-[#5A5A6E] ${
                hasImage ? "text-center md:text-left" : "text-center"
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mr-1.5 inline-block align-[-2px]"
              >
                <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>
                {isKorean ? "30일 환불 보장 ·" : "30日間の返金保証・"}
              </span>
              <span>
                {isKorean
                  ? `${DIAGNOSIS_COUNT_SNAPSHOT}명 이상이 진단했어요`
                  : `${DIAGNOSIS_COUNT_SNAPSHOT}人以上のお客様から信頼されています`}
              </span>
              {courseSwitchLabel ? (
                <>
                  <span>・</span>
                  <button
                    type="button"
                    onClick={handleCourseSwitch}
                    className="inline underline decoration-current decoration-1 underline-offset-[3px] transition hover:text-[#2E2E5C] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B5BEF]"
                  >
                    {courseSwitchLabel} <span aria-hidden="true">→</span>
                  </button>
                </>
              ) : null}
            </p>

            {isKorean ? (
              <KoreanPurchaseLegalNotice
                className={`mt-2 ${hasImage ? "text-center md:text-left" : "text-center"}`}
              />
            ) : null}

            {benefitsBeforePrice ? null : unlockBenefitsPanel}
          </div>
        </div>
    </section>
  );
}
