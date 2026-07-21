"use client";

// PR3: 課金案内カード (トップ以外の全ページ最下部に常設)。
// 2026-07-11: MBTI 参考でデザイン刷新 (画像 + 横並び・グループ色・折り紙装飾・値引き表記)。
//
// 目的: 旧導線は「キャリア」しか訴求できておらず「友達の個人結果も解放される」ことが
//   伝わらなかった。MBTI 式に「解放される中身を項目で見せて価値を可視化」する。
//
// 解放される項目 (見出し+説明。UNLOCKS 定数で管理)。2026-07-14 更新:
//   友達ひとりずつの回答は削除。4項目に絞る。
//   - 16ページ以上の完全版PDFレポート
//   - 恋愛とキャリアの深掘りを全解放
//   - 周りから見たアナタの印象
//   - シーン別の注意点
//
// id="fullaccess-promo": ページ内のロック要素からの scrollToPaywall() のスクロール先
//   (着地パルスも同 id を対象にするため必ず維持)。
// CTA は既存 FullAccessCta を全幅で再利用 (未ログイン=401 はトップへ funnel)。
//
// props はすべて任意 (未指定でも従来どおり動く):
//   - imageSrc: あるとき横並び (md+) の MBTI レイアウト。無いとき中央 1 カラム。
//   - group:    カードの地色/アクセント/装飾のグループ色。未指定は unknown (ラベンダー)。

import { useEffect, useRef } from "react";
import Link from "next/link";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { FullAccessCta } from "./FullAccessCta";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import { track } from "@/lib/track";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import type { ResultLocale } from "@/i18n/result";

// 値引き表記に使うロケール別価格。実課金額はサーバ側のStripe Priceで検証する。
const PRICE_COPY = {
  ja: { list: "¥1,299", sale: "¥499", offPercent: 61 },
  ko: { list: "₩12,900", sale: "₩4,900", offPercent: 62 },
} as const;

// 解放される項目 (見出し + マイクロコピー)。2026-07-22 の結果ページ改修に追随:
// 恋愛/キャリアの深掘り / 周りから見た印象 / もしもの時のアナタ (隠しシーン)。
const UNLOCKS: { title: string; desc: string }[] = [
  {
    title: "16ページ以上の完全版PDFレポート",
    desc: "長所・短所、恋愛、友人関係、キャリアまで、あなたのタイプを一冊にまとめてメールでお届け。保存・印刷でき、友達にも共有できます。",
  },
  {
    title: "恋愛傾向とキャリア傾向の深掘りを全解放",
    desc: "「あなたを好きになった人が読むトリセツ」「恋人が密かに我慢していること」から「あなたに合った働き方・避けたほうがいい職場」「職場の人間関係」まで読める。",
  },
  {
    title: "周りから見たアナタの印象",
    desc: "「嫌われやすいポイント」や「本当は分かってほしいのに伝わっていないこと」——あなたのタイプが誤解されやすいところを解析。",
  },
  {
    title: "もしもの時のアナタを全開放",
    desc: "集合写真・ヤンキー・無人島・宝くじ——鍵つきの隠しシーン全8本の、あるある反応が読める。",
  },
];

const KO_UNLOCKS: { title: string; desc: string }[] = [
  {
    title: "웹에서 보는 완전판 성격 리포트",
    desc: "장점과 단점, 연애, 친구 관계, 커리어까지 내 유형의 상세 결과를 한곳에서 확인할 수 있어요. 구매 후 언제든 다시 볼 수 있어요.",
  },
  {
    title: "연애와 커리어 심층 결과 전체 해제",
    desc: "‘나를 좋아하게 된 사람이 읽는 사용설명서’와 ‘연애가 잘 풀리지 않을 때의 패턴’부터 잘 맞는 일과 뜻밖의 재능까지 확인할 수 있어요.",
  },
  {
    title: "주변에서 보는 나의 인상",
    desc: "오해받기 쉬운 포인트와 정말 알아주었으면 하지만 잘 전해지지 않는 부분을 내 유형에 맞춰 분석해요.",
  },
  {
    title: "상황별 주의점",
    desc: "친구·연인·커리어·가족과 함께할 때 자주 막히는 포인트를 알 수 있어요.",
  },
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
        <span className="block text-[15px] font-black leading-snug text-[#2E2E5C]">
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
}: {
  ownerToken?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  group?: ThirtyTwoGroup;
  variant?: "self" | "aisho";
  locale?: ResultLocale;
}) {
  const isKorean = locale === "ko";
  const unlocks = isKorean ? KO_UNLOCKS : UNLOCKS;
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
    const dedupKey = `torisetsu_paywall_viewed_${page}`;
    try {
      if (sessionStorage.getItem(dedupKey)) return;
    } catch {
      // sessionStorage 不可 (プライベートモード等) でも計測は試みる
    }
    const fire = () => {
      // 送信を先に、dedup フラグは後 (先にフラグを立てると送信失敗時に永久欠測)
      track("paywall_viewed", {
        ownerToken: ownerToken ?? null,
        metadata: { page, variant },
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
  }, [ownerToken, variant]);

  return (
    <section
      aria-labelledby="fullaccess-promo-title"
      className="px-4 pt-6 pb-10 md:px-8"
    >
      <div
        id="fullaccess-promo"
        ref={cardRef}
        className={`relative mx-auto w-full scroll-mt-[80px] rounded-3xl border-2 shadow-[0_16px_48px_rgba(46,46,92,0.12)] ${
          hasImage
            ? "max-w-[1080px] md:flex md:items-stretch"
            : "max-w-[460px]"
        }`}
        style={{ backgroundColor: tone.softBg, borderColor: tone.border }}
      >
        {/* 右上・左下の折り紙風装飾 (カード角に半分被せて外へ) */}
        <CornerDecor
          dark={tone.accent}
          mid={midTone}
          light={tone.border}
          mirror
          className="pointer-events-none absolute -right-3 -top-3 z-10 h-14 w-14 rotate-[12deg] drop-shadow-sm md:h-16 md:w-16"
        />
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-black text-[#2E2E5C] shadow-[0_2px_8px_rgba(46,46,92,0.10)]">
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
            {isKorean ? "지금 잠금 해제" : "今すぐロックを解除"}
          </span>

          {/* 見出し */}
          <h2
            id="fullaccess-promo-title"
            className="mt-2.5 text-[27px] font-black leading-[1.3] text-[#2E2E5C] md:text-[32px]"
          >
            {isKorean ? (
              <>내 성격 유형의<br />모든 결과를 해제</>
            ) : (
              <>あなたの性格タイプ<br />についてのすべてを解放</>
            )}
          </h2>

          {/* 続編訴求 */}
          <p className="mt-2 text-[13.5px] font-bold leading-[1.6] text-[#5A5A72]">
            {isKorean
              ? "내 성격 유형의 상세한 해석부터 친구가 보는 인상까지, 스스로 몰랐던 매력과 본질을 하나의 패키지에 담았어요."
              : "あなたの詳細な性格タイプから、友達から見たアナタの印象まで、自分では気づけなかった魅力や本質を1つのパッケージにまとめました。"}
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
            <span
              className="rounded-md px-2 py-0.5 text-[12px] font-black text-white"
              style={{ backgroundColor: tone.accent }}
            >
              {isKorean
                ? `출시 기념 ${price.offPercent}% 할인`
                : `リリース記念 ${price.offPercent}%OFF`}
            </span>
            <span className="text-[16px] font-bold text-[#A0A0B4] line-through">
              {price.list}
            </span>
            <span
              className="text-[36px] font-black leading-none"
              style={{ color: tone.accent }}
            >
              {price.sale}
            </span>
          </div>

          {/* CTA (金額はカード側に出したのでボタンからは外す) */}
          <div className="mt-4">
            <FullAccessCta
              ownerToken={ownerToken}
              unauthHref={isKorean ? "/ko/diagnosis" : "/diagnosis"}
              locale={locale}
            >
              {isKorean ? "모든 잠금 해제" : "すべてのロックを解除"}
            </FullAccessCta>
          </div>

          {/* 30日間の返金保証。SP は左下の折り紙装飾と被らないよう中央寄せ、md+ は左寄せ。 */}
          <p
            className={`mt-2.5 flex items-center gap-1.5 text-[12px] font-bold text-[#7A7A92] ${
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
            {isKorean ? "30일 환불 보장" : "30日間の返金保証つき"}
          </p>

          {isKorean && (
            <p
              className={`mt-2 text-[11px] leading-[1.7] text-[#7A7A92] ${
                hasImage ? "text-center md:text-left" : "text-center"
              }`}
            >
              결제 전 {" "}
              <Link href="/ko/terms" className="underline underline-offset-2">
                이용약관
              </Link>
              , {" "}
              <Link href="/ko/privacy" className="underline underline-offset-2">
                개인정보처리방침
              </Link>
              , {" "}
              <Link
                href="/ko/legal/commerce"
                className="underline underline-offset-2"
              >
                판매 및 환불 안내
              </Link>
              를 확인해 주세요.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
