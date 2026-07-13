"use client";

// PR3: 課金案内カード (トップ以外の全ページ最下部に常設)。
// 2026-07-11: MBTI 参考でデザイン刷新 (画像 + 横並び・グループ色・折り紙装飾・値引き表記)。
//
// 目的: 旧導線は「キャリア」しか訴求できておらず「友達の個人結果も解放される」ことが
//   伝わらなかった。MBTI 式に「解放される中身を項目で見せて価値を可視化」する。
//
// 解放される項目 (見出し+説明。UNLOCKS 定数で管理)。2026-07-13 更新:
//   ダウンロードレポートは提供終了で削除。友達ひとりずつの回答 (/tako 個別) は
//   現状まだ課金ゲートなので残す (三層モデルの /tako 改修時に外す予定)。
//   - 全てのセクションを解放 (嫌われやすい性格 + 深掘りキャリア/成長)
//   - 関係別の見られ方       (友達/恋人/家族/上司)
//   - 友達ひとりずつの回答   (/tako 個別ページ・課金ゲート)
//   - シーン別の相性         (/aisho ④・課金ゲート)
//
// id="fullaccess-promo": ページ内のロック要素からの scrollToPaywall() のスクロール先
//   (着地パルスも同 id を対象にするため必ず維持)。
// CTA は既存 FullAccessCta を全幅で再利用 (未ログイン=401 はトップへ funnel)。
//
// props はすべて任意 (未指定でも従来どおり動く):
//   - imageSrc: あるとき横並び (md+) の MBTI レイアウト。無いとき中央 1 カラム。
//   - group:    カードの地色/アクセント/装飾のグループ色。未指定は unknown (ラベンダー)。

import { useEffect, useRef } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { FullAccessCta } from "./FullAccessCta";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import { track } from "@/lib/track";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

// 値引き表記に使う元値・現在価格 (77%OFF)。
const LIST_PRICE = "¥1,299";
const OFF_PERCENT = 77;

// 解放される項目 (見出し + マイクロコピー)。
const UNLOCKS: { title: string; desc: string }[] = [
  {
    title: "全てのセクションを解放",
    desc: "嫌われやすい性格から、キャリア・成長の深掘りまで──ロック中の項目が全部読める。",
  },
  {
    title: "関係別の見られ方",
    desc: "友達・恋人・家族・上司から、アナタがそれぞれどう見えているかが分かる。",
  },
  {
    title: "友達ひとりずつの回答",
    desc: "誰が・どう見てるかを名前ごとに。もらったメッセージも、自己認識とのズレも全文で。",
  },
  {
    title: "シーン別の相性",
    desc: "恋愛・友情・仕事・すれ違い、場面ごとの付き合い方まで読める。",
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
}: {
  ownerToken?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  group?: ThirtyTwoGroup;
  variant?: "self" | "aisho";
}) {
  // 色だけ variant で切替 (コピー・項目・レイアウトは全 variant 共通)。
  // aisho は相性ページ用にピンク基調、それ以外はその人のグループ色。
  const groupTone = cardColorsForGroup(group);
  const tone = variant === "aisho" ? PINK_TONE : groupTone;
  const midTone =
    variant === "aisho" ? PINK_TONE.mid : heroColorsForGroup(group).heroBg;
  const hasImage = !!imageSrc;

  // 課金ファネル計測: カードがビューポートに入ったら paywall_viewed を1回送る
  // (半分以上見えたとき)。dedup はページ単位で sessionStorage (タブ内1回)。
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const page = window.location.pathname.split("/")[1] || "top";
    const dedupKey = `torisetsu_paywall_viewed_${page}`;
    try {
      if (sessionStorage.getItem(dedupKey)) return;
    } catch {
      // sessionStorage 不可 (プライベートモード等) でも計測は試みる
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          try {
            sessionStorage.setItem(dedupKey, "1");
          } catch {
            /* noop */
          }
          track("paywall_viewed", {
            ownerToken: ownerToken ?? null,
            metadata: { page, variant },
          });
          io.disconnect();
        }
      },
      { threshold: 0.5 },
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
            今すぐロックを解除
          </span>

          {/* 見出し */}
          <h2
            id="fullaccess-promo-title"
            className="mt-2.5 text-[27px] font-black leading-[1.3] text-[#2E2E5C] md:text-[32px]"
          >
            あなたの性格タイプ
            <br />
            についてのすべてを解放
          </h2>

          {/* 続編訴求 */}
          <p className="mt-2 text-[13.5px] font-bold leading-[1.6] text-[#5A5A72]">
            あなたの詳細な性格タイプから、友達から見たアナタの印象まで、
            自分では気づけなかった魅力や本質を1つのパッケージにまとめました。
          </p>

          {/* 解放される 4 項目 */}
          <ul
            className={`mt-4 grid gap-2.5 text-left ${
              hasImage ? "" : "mx-auto max-w-[320px]"
            }`}
          >
            {UNLOCKS.map(({ title, desc }) => (
              <CheckItem key={title} title={title} desc={desc} accent={tone.accent} />
            ))}
          </ul>

          {/* 価格 (¥1,299 → ¥299 の値引き表記) */}
          <div
            className={`mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${
              hasImage ? "" : "justify-center"
            }`}
          >
            <span
              className="rounded-md px-2 py-0.5 text-[12px] font-black text-white"
              style={{ backgroundColor: tone.accent }}
            >
              {OFF_PERCENT}%OFF
            </span>
            <span className="text-[16px] font-bold text-[#A0A0B4] line-through">
              {LIST_PRICE}
            </span>
            <span
              className="text-[36px] font-black leading-none"
              style={{ color: tone.accent }}
            >
              ¥299
            </span>
          </div>

          {/* CTA (金額はカード側に出したのでボタンからは外す) */}
          <div className="mt-4">
            <FullAccessCta ownerToken={ownerToken}>
              すべてのロックを解除
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
            30日間の返金保証つき
          </p>
        </div>
      </div>
    </section>
  );
}
