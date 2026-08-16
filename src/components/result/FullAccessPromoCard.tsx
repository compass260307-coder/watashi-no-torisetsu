"use client";

// PR3: 課金案内カード (トップ以外の全ページ最下部に常設)。
// 2026-07-11: MBTI 参考でデザイン刷新 (画像 + 横並び・グループ色・折り紙装飾・値引き表記)。
//
// 目的: 旧導線は「キャリア」しか訴求できておらず「友達の個人結果も解放される」ことが
//   伝わらなかった。MBTI 式に「解放される中身を項目で見せて価値を可視化」する。
//
// 解放される項目 (見出し+説明。UNLOCKS 定数で管理)。2026-07-22 更新 (¥499 完全版一本化):
//   - 自己診断結果の完全解放
//   - 16ページ以上の自己分析完全版PDFレポート
//   - 友達診断結果の完全解放
//   - 何度もダウンロードできる友達分析完全版PDFレポート
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
import { SelfAccessPlanCarousel } from "./SelfAccessPlanCarousel";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import {
  paywallCardMode,
  type PaywallCardMode,
} from "@/lib/feature-flags";
import { track } from "@/lib/track";
import { DIAGNOSIS_COUNT_SNAPSHOT } from "@/lib/proof-stats";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import type { ResultLocale } from "@/i18n/result";
import {
  FULL_ACCESS_PRICE_JPY,
  MULTI_COURSE_PAYWALL_PRODUCT,
  SELF_REPORT_DISCOUNT_PERCENT,
  SELF_REPORT_LIST_PRICE_JPY,
  SELF_REPORT_PRICE_JPY,
  SELF_REPORT_UNLOCK_LABEL,
  THREE_COURSE_PAYWALL_VERSION,
  type AccessProduct,
} from "@/lib/access-products";

const LEGACY_FULL_ACCESS_LIST_PRICE_JPY = 1_290;
const LEGACY_FULL_ACCESS_DISCOUNT_PERCENT = Math.round(
  (1 - FULL_ACCESS_PRICE_JPY / LEGACY_FULL_ACCESS_LIST_PRICE_JPY) * 100,
);

// 値引き表記に使うロケール別価格。実課金額はサーバ側のStripe Priceで検証する。
const PRICE_COPY = {
  ja: {
    list: `¥${LEGACY_FULL_ACCESS_LIST_PRICE_JPY.toLocaleString("ja-JP")}`,
    sale: `¥${FULL_ACCESS_PRICE_JPY.toLocaleString("ja-JP")}`,
    offPercent: LEGACY_FULL_ACCESS_DISCOUNT_PERCENT,
  },
  ko: { list: "₩12,900", sale: "₩4,900", offPercent: 62 },
} as const;

const SELF_REPORT_PRICE_COPY = `¥${SELF_REPORT_PRICE_JPY}`;
const SELF_REPORT_LIST_PRICE_COPY = `¥${SELF_REPORT_LIST_PRICE_JPY}`;

// 解放される項目 (見出し + マイクロコピー)。2026-07-22: 自己診断＋友達診断を
// すべて含む ¥499 完全版パッケージに一本化。パッと価値が伝わる項目に集約。
// 解放項目。設置ページで並びを変える (自己診断=自分の解放が先 / 友達診断=友達の解放が先)。
// 相性(/aisho)は 2026-08-16 に無料開放したため、課金カードの解放項目には載せない。
type UnlockItem = { title: string; desc: string };

// 自己分析の電子書籍/PDF・自己/友達の解放の共通パーツ (ページ間で文言を揃える)。
const U_SELF_UNLOCK: UnlockItem = {
  title: "自己診断結果の完全解放",
  desc: "恋愛・キャリアの深掘りから、周りから見た印象、もしもの時のあなたまで、鍵つきの続きがぜんぶ読める。",
};
const U_FRIEND_PDF: UnlockItem = {
  title: "何度でも作り直せる友達診断レポート",
  desc: "友達が増えるたびに更新できる、友達視点のレポートPDF。何度でもダウンロードOK。",
};
// 友達診断をまとめて訴求する統合コピー。自己診断カードでは2つの友達項目を1つに集約する。
const U_FRIEND_SUMMARY: UnlockItem = {
  title: "友達の回答を集めて「他人から見たあなた」を完全解析",
  desc: "一人ひとりの診断結果＋みんなの回答を集約した総合レポートを全解放。回答が増えるたびに何度でも更新できます。",
};
// AI占い師 (¥499 完全版に含む)。呼称は Alice。カードの目玉として訴求を強める。
const U_HOSHIYOMI: UnlockItem = {
  title: "あなた専属のAI占い師「Alice」",
  desc: "あなたの診断結果をぜんぶ知っているAliceだから、話が早い。恋も友達も、深夜のモヤモヤも、いつでも相談できる。",
};

// 自己診断結果ページ (/me) 用。
const SELF_UNLOCKS: UnlockItem[] = [
  {
    title: "あなたの結果のロックされた8つのセクションすべて",
    desc: "恋愛・キャリアの深掘りから、周りから見た印象、もしもの時のあなたまで、鍵つきの続きがぜんぶ読める。",
  },
  {
    title: "ダウンロード可能な16ページ以上のあなたの電子書籍",
    desc: "あなたのタイプを一冊にまとめてメールでお届け。保存・印刷でき、いつでも見返せます。",
  },
];

// 友達診断ページ (/tako) 用。友達の解放を先頭に。
const TAKO_UNLOCKS: UnlockItem[] = [
  {
    // 1人目は無料で読めるため「2人目から」を明示 (2026-07-28 モデル変更)。
    title: "2人目からの友達の結果シートを全解放",
    desc: "友達から見たキャラ・性格のギャップ・恋愛傾向・相性まで、友達ごとの結果シートがぜんぶ読める。",
  },
  U_FRIEND_PDF,
  U_SELF_UNLOCK,
  {
    title: "ダウンロード可能な自己分析完全版PDFレポート",
    desc: "あなたのタイプを一冊にまとめてメールでお届け。保存・印刷でき、いつでも見返せます。",
  },
  U_HOSHIYOMI,
];

// 自己診断カードの並び (2026-08-16): 自己診断2項目 → AI占い師 → 友達診断(まとめ)。
// 相性(/aisho)は無料化したため課金カードの解放項目からは外す。
const FULL_ACCESS_SELF_UNLOCKS: UnlockItem[] = [
  ...SELF_UNLOCKS,
  U_HOSHIYOMI,
  U_FRIEND_SUMMARY,
];

const KO_SELF_UNLOCKS: UnlockItem[] = [
  {
    title: "내 결과의 잠긴 8개 섹션 전체 해제",
    desc: "연애와 커리어 심층 분석부터 주변에서 보는 인상, 만약의 순간에 드러나는 모습까지 잠긴 내용을 모두 읽을 수 있어요.",
  },
  {
    title: "다운로드 가능한 16페이지 이상의 자기 분석 PDF",
    desc: "내 유형을 한 권에 정리한 완전판 리포트예요. 저장하거나 인쇄하고 언제든 다시 확인할 수 있어요.",
  },
  {
    title: "두 번째 친구부터의 친구 진단 결과 전체 해제",
    desc: "친구가 보는 캐릭터, 성격 차이, 연애 성향과 궁합까지 친구별 결과 시트를 모두 읽을 수 있어요.",
  },
  {
    title: "여러 번 다시 만들 수 있는 친구 진단 PDF",
    desc: "친구가 늘 때마다 내용이 업데이트되는 친구 시선 리포트예요. 횟수 제한 없이 다시 다운로드할 수 있어요.",
  },
  {
    title: "AI 점성술사 채팅 상담 5회",
    desc: "내 진단 결과를 알고 있는 AI 점성술사에게 연애나 친구 고민을 언제든 상담할 수 있어요.",
  },
];

// 相性(궁합)は無料開放したため解放項目から除外。インデックスは KO_SELF_UNLOCKS の
// 現在の並び (0:8섹션 / 1:16PDF / 2:친구첫 / 3:친구PDF / 4:AI점성술사) に対応。
const KO_TAKO_UNLOCKS: UnlockItem[] = [
  KO_SELF_UNLOCKS[2],
  KO_SELF_UNLOCKS[3],
  KO_SELF_UNLOCKS[0],
  KO_SELF_UNLOCKS[1],
  KO_SELF_UNLOCKS[4],
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

function CheckItem({ title, desc, accent }: { title: string; desc: string; accent: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: accent }}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
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
        <span className="block text-[16px] font-black leading-snug text-[#2E2E5C]">
          {title}
        </span>
        <span className="body-gothic block text-[13px] leading-[1.6] text-[#5A5A6E]">
          {desc}
        </span>
      </span>
    </li>
  );
}

export function FullAccessPromoCard({
  ownerToken,
  imageSrc,
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
  legacyPlanStyle = false,
  cardMode,
}: {
  ownerToken?: string;
  imageSrc?: string | null;
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
  /** 3コース化以前のコンパクトな単一課金カード表示。 */
  legacyPlanStyle?: boolean;
  /** 開発プレビュー用。未指定時は共通の課金カード設定を使う。 */
  cardMode?: PaywallCardMode;
}) {
  const isKorean = locale === "ko";
  // 通常カードは feature flag 1か所で旧単一カードと松竹梅を切り替える。
  // legacyPlanStyle はプレミアム専用の旧カードを表示する個別導線なので優先する。
  const resolvedCardMode = cardMode ?? paywallCardMode();
  const usesLegacyFullAccessCard =
    !legacyPlanStyle && resolvedCardMode === "legacy";
  const isSelfReportProduct =
    !usesLegacyFullAccessCard &&
    !isKorean &&
    surface === "self" &&
    variant === "self";
  const usesPlanCarousel =
    legacyPlanStyle ||
    (resolvedCardMode === "three-course" &&
      (variant === "self" || variant === "aisho"));
  const product = isSelfReportProduct ? "self_report" : "full_access";
  const paywallProduct = usesPlanCarousel
    ? MULTI_COURSE_PAYWALL_PRODUCT
    : product;
  const paywallVersion = usesPlanCarousel
    ? THREE_COURSE_PAYWALL_VERSION
    : "legacy";
  const paywallPlacement = onClose ? "modal" : "inline";
  const unlocks = isKorean
    ? surface === "tako"
      ? KO_TAKO_UNLOCKS
      : KO_SELF_UNLOCKS
    : surface === "tako"
      ? TAKO_UNLOCKS
      : product === "full_access"
        ? FULL_ACCESS_SELF_UNLOCKS
        : SELF_UNLOCKS;
  const price = PRICE_COPY[locale];
  // 色だけ variant で切替 (コピー・項目・レイアウトは全 variant 共通)。
  // aisho は相性ページ用にピンク基調、それ以外はその人のグループ色。
  const groupTone = cardColorsForGroup(group);
  const tone = variant === "aisho" ? PINK_TONE : groupTone;
  const midTone =
    variant === "aisho" ? PINK_TONE.mid : heroColorsForGroup(group).heroBg;
  const hasImage = !!imageSrc;

  // 課金ファネル計測: カードがビューポートに入ったら paywall_viewed を1回送る。
  // dedup はページ単位で sessionStorage (タブ内1回)。
  // threshold は 0.2: カードは縦長 (画像つきで1000px級) で、背の低い端末では
  // 50% が同時に画面へ入らず「見たのに未計測」になるため低めにする (2026-07-13)。
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const page = window.location.pathname.split("/")[1] || "top";
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
    surface,
    variant,
  ]);

  // 自己診断・友達診断は、日韓それぞれの3コースを横スワイプで比較する。
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
          products={products}
          previewMode={previewMode}
          legacyStyle={legacyPlanStyle}
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
        className={`relative mx-auto w-full scroll-mt-[80px] rounded-3xl border-2 shadow-[0_16px_48px_rgba(46,46,92,0.12)] ${
          hasImage
            ? "max-w-[1080px] md:flex md:items-stretch"
            : "max-w-[460px]"
        }`}
        style={{ backgroundColor: tone.softBg, borderColor: tone.border }}
      >
        {/* 右上・左下の折り紙風装飾 (カード角に半分被せて外へ)。
            モーダル時 (onClose あり) は右上の装飾を出さず、×だけを角に乗せる。 */}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
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

        {/* 画像 (md+: 左カラム / モバイル: 上)。imageSrc があるときだけ。 */}
        {hasImage && (
          <div
            className="flex items-center justify-center rounded-t-3xl px-6 pt-7 md:w-[40%] md:rounded-l-3xl md:rounded-tr-none md:px-6 md:py-8"
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
            {isKorean
              ? "지금 잠금 해제"
              : isSelfReportProduct
                ? SELF_REPORT_UNLOCK_LABEL
                : "今すぐロックを解除"}
          </span>

          {/* 見出し */}
          <h2
            id={`${anchorId}-title`}
            className="mt-2.5 text-[29px] font-black leading-[1.3] text-[#2E2E5C] md:text-[34px]"
          >
            {isKorean ? (
              <>내 성격 유형의<br />모든 결과를 해제</>
            ) : isSelfReportProduct ? (
              <>自己診断結果を<br />すべて解放</>
            ) : (
              <>あなたの物語は<br />まだ完結していません</>
            )}
          </h2>

          {/* 続編訴求 */}
          <p className="body-gothic mt-2 text-[13px] leading-[1.6] text-[#5A5A6E]">
            {isKorean
              ? "내 성격 유형의 상세한 해석부터 친구가 보는 인상까지, 스스로 몰랐던 매력과 본질을 하나의 패키지에 담았어요."
              : isSelfReportProduct
                ? "ロックされた自己診断結果と、あなたのタイプを一冊にまとめた自己分析PDFを買い切りで利用できます。"
              : "無料レポートを読んだら、次はもう一歩深くへ。恋愛・仕事・人間関係・友達から見た印象まで、さらに具体的に深掘りします。"}
          </p>

          {/* 解放される 4 項目 */}
          <ul
            className={`mt-4 grid gap-2.5 text-left ${
              hasImage ? "" : "mx-auto max-w-[320px]"
            }`}
          >
            {unlocks.map(({ title, desc }) => (
              <CheckItem key={title} title={title} desc={desc} accent={tone.accent} />
            ))}
          </ul>

          {/* ロケール別価格の値引き表記。
              値引き理由を「リリース記念」として明示 (安すぎ感の解消 / 2026-07-14 指示)。 */}
          <div
            className={`mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${
              hasImage ? "" : "justify-center"
            }`}
          >
            {isSelfReportProduct ? (
              <>
                <span
                  className="rounded-md px-2 py-0.5 text-[13px] font-black text-white"
                  style={{ backgroundColor: tone.accent }}
                >
                  リリース記念 {SELF_REPORT_DISCOUNT_PERCENT}%OFF
                </span>
                <span className="text-[17px] font-bold text-[#A0A0B4] line-through">
                  {SELF_REPORT_LIST_PRICE_COPY}
                </span>
                <span
                  className="text-[38px] font-black leading-none"
                  style={{ color: tone.accent }}
                >
                  {SELF_REPORT_PRICE_COPY}
                </span>
              </>
            ) : (
              <>
                {/* ja はリリース記念・割引表記を廃止し価格のみ (2026-08-17)。
                    KO は現状維持 (バッジ + 打消し価格を残す)。 */}
                {isKorean ? (
                  <>
                    <span
                      className="rounded-md px-2 py-0.5 text-[13px] font-black text-white"
                      style={{ backgroundColor: tone.accent }}
                    >
                      {`출시 기념 ${price.offPercent}% 할인`}
                    </span>
                    <span className="text-[17px] font-bold text-[#A0A0B4] line-through">
                      {price.list}
                    </span>
                  </>
                ) : null}
                <span
                  className="text-[38px] font-black leading-none"
                  style={{ color: tone.accent }}
                >
                  {price.sale}
                </span>
              </>
            )}
          </div>

          {/* サブスク警戒の解消: 月額でないことを価格の直近で言う。
              デザインは解放項目の説明文 (CheckItem の desc) と同じトーンに揃える。 */}
          <p
            className={`body-gothic mt-0.5 text-[13px] leading-[1.6] text-[#5A5A6E] ${
              hasImage ? "" : "text-center"
            }`}
          >
            {isKorean ? "월 구독이 아닌, 1회 결제" : "買い切り（お支払いは1回のみ）"}
          </p>

          {/* CTA (金額はカード側に出したのでボタンからは外す) */}
          <div className="mt-4">
            <FullAccessCta
              ownerToken={ownerToken}
              unauthHref={isKorean ? "/ko/diagnosis" : "/diagnosis"}
              locale={locale}
              source={ctaSource ?? (surface === "tako" ? "tako_promo_card" : undefined)}
              returnTo={returnTo}
              product={product}
            >
              {isKorean
                ? "모든 잠금 해제"
                : isSelfReportProduct
                  ? SELF_REPORT_UNLOCK_LABEL
                  : "すべてのロックを解除"}
            </FullAccessCta>
          </div>

          {/* 30日間の返金保証。SP は左下の折り紙装飾と被らないよう中央寄せ、md+ は左寄せ。 */}
          <p
            className={`body-gothic mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-[1.6] text-[#5A5A6E] ${
              hasImage ? "justify-center md:justify-start" : "justify-center"
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
            >
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            {/* 買い切りは価格直下 (③) へ移したので、ここは保証 + 実数の信頼行にする。
                人数は /unmei 実績バンドと同じ実数スナップショット (lib/proof-stats、診断完了者数)。
                韓国語版は現状維持でよい (2026-08-17 オーナー指示: KO は今後追従修正しない)。
                保証と人数を nowrap セグメントに分け、狭幅では語の途中でなく区切りで折り返す。 */}
            <span className="whitespace-nowrap">
              {isKorean ? "30일 환불 보장 ·" : "30日間の返金保証・"}
            </span>
            <span className="whitespace-nowrap">
              {isKorean
                ? `${DIAGNOSIS_COUNT_SNAPSHOT}명 이상이 진단했어요`
                : `${DIAGNOSIS_COUNT_SNAPSHOT}人以上が信頼しています`}
            </span>
          </p>

          {isKorean ? (
            <KoreanPurchaseLegalNotice
              className={`mt-2 ${hasImage ? "text-center md:text-left" : "text-center"}`}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
