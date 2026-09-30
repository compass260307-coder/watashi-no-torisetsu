"use client";

import { useUiText } from "@/i18n/ui/use-ui-copy";

import { useUiCopy } from "@/i18n/ui/use-ui-copy";

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

import { SmoothImage } from "@/components/ui/SmoothImage";
import { useEffect, useRef, useState } from "react";
import { FullAccessCta } from "./FullAccessCta";
import { PeekButton, type UnlockPeek } from "./PaywallPeek";

import type { AppResultLocale } from "@/i18n/result";
import {
  accessPaywallVersionForLocale,
  accessProductPrice,
  SINGLE_ALL_ACCESS_PAYWALL_PRODUCT,
  THREE_COURSE_PAYWALL_VERSION,
  type AccessEntitlements,
  type AccessProduct
} from "@/lib/access-products";
import { paywallCardMode, type PaywallCardMode } from "@/lib/feature-flags";
import {
  cardColorsForGroup,
  heroColorsForGroup,
  resultActionColorsForGroup,
} from "@/lib/hero-colors";
import { DIAGNOSIS_COUNT_SNAPSHOT } from "@/lib/proof-stats";
import {
  friendReportPeekImagePath,
  selfReportPeekImagePath,
  selfReportStoryPreviewPagePath,
} from "@/lib/report-story-images";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import { requestFullAccessStatus } from "@/lib/use-course-navigation-access";
import { SelfAccessPlanCarousel } from "./SelfAccessPlanCarousel";

// 値引き表記に使うロケール別価格。実課金額はサーバ側のStripe Priceで検証する。

// 解放される項目 (見出し + マイクロコピー)。2026-07-22: 自己診断＋友達診断を
// すべて含む完全版パッケージに一本化。パッと価値が伝わる項目に集約。
// 解放項目。設置ページで並びを変える (自己診断=自分の解放が先 / 友達診断=友達の解放が先)。
type UnlockItem = { title: string; desc: string; peek?: UnlockPeek };

// 自己分析の電子書籍/PDF・自己/友達の解放の共通パーツ (ページ間で文言を揃える)。


// 完全版に含むAliceの占い機能。運命の設計図とタロットを1項目にまとめる。

// 運命タブから開いたカードでは、設計図そのものを主役にして先頭へ置く。

// 自己診断結果ページ (/me) 用。


// 日本語完全版カードの並び。設置ページに関連する項目を先頭へ置く。

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
  shadow: "#286672",
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
  locale,
}: {
  title: string;
  desc: string;
  accent: string;
  peek?: UnlockPeek;
  locale: AppResultLocale;
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
          {peek && (
            <PeekButton
              peek={peek}
              title={title}
              accent={accent}
              locale={locale}
            />
          )}
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
  locale?: AppResultLocale;
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi" | "tarot";
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
  const uiText = useUiText(locale, "result.FullAccessPromoCard");
  const uiCopy = useUiCopy(locale);
  const isKorean = locale === "ko";
  const isEnglish = locale === "en";
  const isIndonesian = locale === "id";
  const planLocale: AppResultLocale = locale;
  const [selectedStandaloneProduct, setSelectedStandaloneProduct] = useState<
    "self_report" | null
  >(() => standaloneProduct ?? null);
  const isStandaloneSelfReport = selectedStandaloneProduct === "self_report";
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
  const paywallVersion = isEnglish || isIndonesian || isKorean
    ? accessPaywallVersionForLocale(locale)
    : usesPlanCarousel || isStandaloneSelfReport || usesLegacyFullAccessCard
      ? THREE_COURSE_PAYWALL_VERSION
      : "legacy";
  const paywallPlacement = onClose ? "modal" : "inline";
  const [entitlements, setEntitlements] = useState<AccessEntitlements>({
    selfReport: false,
    full: false,
    premiumBundle: false,
  });
  const displayedEntitlements = previewMode
    ? (previewEntitlements ?? entitlements)
    : entitlements;
  // 日本版の学生向け差額販売は終了。韓国版へ日本円の差額表示を流用しない。
  const isStudentUpgrade = false;
  const upgradePrice = accessProductPrice(
    locale,
    "full_access",
    displayedEntitlements,
  );
  const { promo: copy, peeks, basePeeks } = uiCopy;
  const baseUnlocks = product === "self_report"
    ? surface === "tako" ? copy.studentTako : copy.studentSelf
    : surface === "tako" ? copy.tako : copy.self;
  const contextualUnlocks = returnTo === "hoshiyomi"
    ? promoteUnlockItem(baseUnlocks, copy.alice)
    : returnTo === "unmei"
      ? promoteUnlockItem(baseUnlocks, copy.fortune, copy.unmei)
      : baseUnlocks;
  const reportCharacterSource = reportCharacterImageSrc ?? imageSrc;
  const characterFriendCover = friendReportPeekImagePath(reportCharacterSource);
  const characterSelfCover = selfReportPeekImagePath(reportCharacterSource);
  const characterSelfStoryPage =
    selfReportStoryPreviewPagePath(reportCharacterSource);
  const ebookPeek = basePeeks.ebook;
  const friendsPeek = basePeeks.friends;
  // English previews use dedicated localized artwork. The per-character report
  // assets are Japanese PDFs, so substituting them here leaks Japanese text
  // into the English paywall modal.
  const characterEbookPeek: UnlockPeek | null =
    !isEnglish && characterSelfCover
    ? {
        ...ebookPeek,
        pages: ebookPeek.pages?.map((page, index) => {
          if (index === 0 && characterSelfStoryPage) {
            return {
              ...page,
              img: characterSelfStoryPage,
              alt: isEnglish
                ? `A story page starring ${imageAlt || "your character"}`
                : `${imageAlt || "あなた"}を主人公にした短編小説の本文`,
              width: 560,
              height: 792,
            };
          }
          if (index === 1) {
            return {
              ...page,
              img: characterSelfCover,
              alt: isEnglish
                ? `The story cover for ${imageAlt || "your character"}`
                : `${imageAlt || "あなた"}の短編ストーリー表紙`,
              width: 560,
              height: 841,
            };
          }
          return page;
        }),
      }
    : null;
  const characterFriendsPeek: UnlockPeek | null =
    !isEnglish && characterFriendCover
    ? {
        ...friendsPeek,
        pages: friendsPeek.pages?.map((page, index) =>
          index === 1
            ? {
                ...page,
                img: characterFriendCover,
                alt: isEnglish
                  ? `The friends' perspective report cover for ${imageAlt || "your character"}`
                  : `${imageAlt || "あなた"}の友達診断まとめレポート表紙`,
                width: 560,
                height: 841,
              }
            : page,
        ),
      }
    : null;
  const unlocks = contextualUnlocks.map((item) => {
    if (
      characterEbookPeek &&
      item.peek === peeks.ebook
    ) {
      return {
        ...item,
        peek: isKorean ? peeks.ebook : characterEbookPeek,
      };
    }
    if (
      characterFriendsPeek &&
      item.peek === peeks.friends
    ) {
      return {
        ...item,
        peek: isKorean ? peeks.friends : characterFriendsPeek,
      };
    }
    return item;
  });
  const price = copy.price;
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
  const cardImageSrc = isStandaloneSelfReport
    ? "/pricing/self-report-felt-transparent.png"
    : imageSrc;
  const cardImageAlt = isStandaloneSelfReport
    ? uiText("自己診断と友達診断の専用電子書籍")
    : imageAlt;
  const hasImage = !!cardImageSrc;
  // 日本版の新規販売は完全版のみ。韓国版と開発用の旧カード互換は残す。
  const courseSwitchLabel = isStandaloneSelfReport
    ? uiText("完全版はこちら")
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
          {uiText("アップグレードで手に入るもの")}
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
            locale={locale}
          />
        ))}
      </ul>
    </div>
  );

  function handleCourseSwitch() {
    setSelectedStandaloneProduct(
      isStandaloneSelfReport ? null : "self_report",
    );
  }

  useEffect(() => {
    if (!ownerToken || previewMode || !usesLegacyFullAccessCard) return;
    let cancelled = false;
    void requestFullAccessStatus(ownerToken).then((data) => {
      if (cancelled || !data) return;
      setEntitlements({
        selfReport: data.selfReport === true,
        full: data.full === true,
        premiumBundle: data.premiumBundle === true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ownerToken, previewMode, usesLegacyFullAccessCard]);

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
          locale={planLocale}
          products={
            products ?? (variant === "aisho" ? AISHO_PRODUCTS : undefined)
          }
          previewMode={previewMode}
          previewJapaneseThreeCourse={previewJapaneseThreeCourse}
          previewEntitlements={previewEntitlements}
          legacyStyle={legacyPlanStyle}
          defaultProduct={defaultProduct}
          heading={heading}
          ebookPeek={characterEbookPeek ?? ebookPeek}
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
              aria-label={uiText("閉じる")}
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
                src={cardImageSrc!}
                alt={cardImageAlt}
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
                ? uiText("学生向けプラン")
                : uiText("今すぐロックを解除")}
            </span>

            {/* 見出し */}
            <h2
              id={`${anchorId}-title`}
              className="mt-2.5 text-[26px] font-bold leading-[1.3] text-[#2E2E5C] md:text-[34px]"
            >
              {(isSelfReportProduct ? copy.studentHeading : copy.heading)[0]}
              <br />
              {(isSelfReportProduct ? copy.studentHeading : copy.heading)[1]}
            </h2>

            {/* 続編訴求 */}
            <p className="body-gothic mt-2 text-[13px] leading-[1.6] text-[#5A5A6E]">
              {isSelfReportProduct
                ? uiText("診断結果の続き・友達から見たあなた・あなただけの電子書籍まで、すべて買い切りで楽しめます。")
                : uiText("無料レポートを読んだら、次はもう一歩深くへ。恋愛・仕事・人間関係・友達から見た印象まで、さらに具体的に深掘りします。")}
            </p>

            {benefitsBeforePrice ? unlockBenefitsPanel : null}

            {/* ページ末尾では解放内容の後、それ以外では従来どおり冒頭に価格を置く。 */}
            <div
              className={`${benefitsBeforePrice ? "mt-6" : (locale === "ja" || isEnglish || isIndonesian) && !isSelfReportProduct ? "mt-5" : "mt-3"} flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${
                hasImage ? "" : "justify-center"
              }`}
            >
              {/* 価格タグは Noto Sans JP/KR の 700 + tabular-nums (M PLUS は撤回 2026-09-04)。 */}
              {isStudentUpgrade ? (
                <>
                  <span className="text-[15px] font-black text-[#2E2E5C] md:text-[17px]">
                    差額
                  </span>
                  <span className="text-[30px] font-bold tabular-nums tracking-[-0.02em] leading-none text-[#2E2E5C] md:text-[50px]">
                    ¥{upgradePrice.toLocaleString("ja-JP")}
                  </span>
                </>
              ) : isSelfReportProduct ? (
                <span className="text-[30px] font-bold tabular-nums tracking-[-0.02em] leading-none text-[#2E2E5C] md:text-[50px]">
                  {copy.selfReportPrice}
                </span>
              ) : isKorean ? (
                <div
                  className={`flex flex-col gap-2 md:flex-row md:items-baseline md:gap-2.5 ${
                    hasImage ? "items-start" : "items-center"
                  }`}
                >
                  <span className="inline-flex items-baseline gap-2.5 whitespace-nowrap">
                    <span className="sr-only">정상가</span>
                    <s className="text-[16px] font-bold text-[#A0A0B4] line-through">
                      {price.list}
                    </s>
                    <span className="text-[36px] font-black leading-none text-black">
                      <span className="sr-only">할인가</span>
                      {price.sale}
                    </span>
                  </span>
                  <span
                    className="rounded-md px-2 py-0.5 text-[12px] font-black text-white md:order-first"
                    style={{ backgroundColor: actionTone.accent }}
                  >
                    출시 기념 {price.offPercent}% 할인
                  </span>
                </div>
              ) : locale === "ja" || isEnglish || isIndonesian ? (
                <span className="text-[36px] font-black leading-none text-black">
                  <span className="sr-only">{uiText("価格")}</span>
                  {price.sale}
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
              {uiText("買い切り（お支払いは1回のみ）")}
            </p>

            <div className="mt-4">
              <FullAccessCta
                ownerToken={ownerToken}
                unauthHref={isIndonesian ? "/id/diagnosis" : isEnglish ? "/en/diagnosis" : isKorean ? "/ko/diagnosis" : "/diagnosis"}
                locale={locale}
                source={
                  isStandaloneSelfReport
                    ? "student_offer_link"
                    : ctaSource ??
                      (surface === "tako" ? "tako_promo_card" : undefined)
                }
                returnTo={returnTo}
                product={product}
                paywallVersion={
                  paywallVersion === "legacy" ? undefined : paywallVersion
                }
                placement={paywallPlacement}
                previewMode={previewMode}
                accentColor={
                  isStandaloneSelfReport
                    ? STUDENT_LITE_TONE.accent
                    : actionTone.accent
                }
                shadowColor={
                  isStandaloneSelfReport
                    ? STUDENT_LITE_TONE.shadow
                    : actionTone.shadow
                }
              >
                {isSelfReportProduct ? copy.studentCta : uiText("全ての結果をアンロック →")}
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
                {uiText("30日間の返金保証・")}
              </span>
              <span>
                {uiText("{DIAGNOSIS_COUNT_SNAPSHOT}人以上のお客様から信頼されています", { DIAGNOSIS_COUNT_SNAPSHOT })}
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

            {benefitsBeforePrice ? null : unlockBenefitsPanel}
          </div>
        </div>
    </section>
  );
}
