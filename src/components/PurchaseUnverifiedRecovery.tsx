// /purchase-complete で購入を確認できなかったときの画面 (日本語)。
//
// 伝える順: 何が起きたか → 買ったものは無事か → 元に戻す3つの手順 → その場でログイン → だめなら問い合わせ先。
// 完全版は購入時のメールアドレスにひも付くので、ログインが一番確かな出口。
//
// 見た目は診断ページ冒頭 (DiagnosisHero) の型にそろえる: 淡い帯 + 帯と白地にまたがる番号つきの手順の表。
// 絵は使わず、線の絵 (SVG) だけで組む (困った場面に合う今のキャラクターの絵が無いため)。

import Link from "next/link";
import type { ReactNode } from "react";
import { LoginCard } from "@/components/LoginCard";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";
const NAVY = "#2E2E5C";
const ACCENT = "#5B5BEF";
const AMBER = "#E0A544";
const PALT = '"palt"';
const BAND_CURVE = "50% 28px";
const CARD_SHADOW =
  "shadow-[0_1px_1px_rgba(46,46,92,0.03),0_6px_14px_-6px_rgba(46,46,92,0.1),0_22px_40px_-22px_rgba(46,46,92,0.22)]";
const SUPPORT_MAILTO =
  "mailto:support@watashi-torisetsu.com?subject=%E8%B3%BC%E5%85%A5%E3%81%97%E3%81%9F%E5%86%85%E5%AE%B9%E3%81%8C%E4%BD%BF%E3%81%88%E3%81%BE%E3%81%9B%E3%82%93";

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function MailIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 8 8 5.5L20 8" />
    </svg>
  );
}

function TapIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M9.5 13.5 7.8 12a1.6 1.6 0 0 0-2.3 2.2l3.7 4.6A4 4 0 0 0 12.3 20H15a4 4 0 0 0 4-4v-3.2a1.5 1.5 0 0 0-3 0" />
      <path d="M16 12.6v-1a1.5 1.5 0 0 0-3 0" />
      <path d="M13 11.8V6a1.75 1.75 0 0 0-3.5 0v7.5" />
      <path d="M6 5.2 5 4.2M13.6 3.4l.6-1.2M9.3 3 9 1.7" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.6" />
      <path d="M8 10.5V7.4a4 4 0 0 1 7.6-1.7" />
      <path d="M12 14.6v2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 3.2 5 5.8v5.4c0 4.3 2.9 7.6 7 9.6 4.1-2 7-5.3 7-9.6V5.8z" />
      <path d="m9.2 12 2 2 3.7-4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// 見出しの上の絵: レシートを虫めがねで探している図。黄色は「確認が必要」の印だけに使う。
function ReceiptSearchArt() {
  return (
    <svg
      width="132"
      height="112"
      viewBox="0 0 132 112"
      fill="none"
      aria-hidden="true"
      className="mx-auto"
    >
      <ellipse cx="66" cy="102" rx="44" ry="6" fill="#DAD5F2" />
      {/* 奥のカード */}
      <rect
        x="50"
        y="14"
        width="58"
        height="74"
        rx="10"
        transform="rotate(8 79 51)"
        fill="#E3DFF8"
      />
      {/* レシート */}
      <path
        d="M30 16a9 9 0 0 1 9-9h42a9 9 0 0 1 9 9v72.5l-7.5-4.6-7.5 4.6-7.5-4.6-7.5 4.6-7.5-4.6-7.5 4.6-7.5-4.6-7.5 4.6z"
        fill="#FFFFFF"
        stroke="#D5D0EE"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="27" r="7" fill="#EEEDFC" />
      <path
        d="m43 27 2.2 2.2 4-4.4"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="58" y="22" width="22" height="4" rx="2" fill="#C9C5E0" />
      <rect x="58" y="29" width="14" height="4" rx="2" fill="#E3E0F2" />
      <path d="M38 44h44" stroke="#E3E0F2" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" />
      <rect x="38" y="53" width="30" height="4" rx="2" fill="#E3E0F2" />
      <rect x="38" y="62" width="22" height="4" rx="2" fill="#E3E0F2" />
      <rect x="70" y="62" width="12" height="4" rx="2" fill="#C9C5E0" />
      {/* 虫めがね */}
      <path d="m100 82 13 13" stroke={NAVY} strokeWidth="7" strokeLinecap="round" />
      <circle cx="86" cy="68" r="20" fill="#FFF7E3" stroke={AMBER} strokeWidth="5" />
      <path
        d="M80.5 62.5a6 6 0 1 1 8.3 6.1c-1.7.8-2.8 1.8-2.8 3.6"
        stroke={NAVY}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="86" cy="78.5" r="2.1" fill={NAVY} />
      {/* きらめき */}
      <path d="M17 40v8M13 44h8" stroke="#C9C5E0" strokeWidth="2" strokeLinecap="round" />
      <path d="M116 22v6M113 25h6" stroke={AMBER} strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="70" r="2.5" fill="#DAD5F2" />
    </svg>
  );
}

const STEPS: { title: string; icon: ReactNode }[] = [
  { title: "購入時のメールアドレスを入力", icon: <MailIcon /> },
  { title: "届いたメールのリンクを開く", icon: <TapIcon /> },
  { title: "購入した内容がすぐに使える", icon: <UnlockIcon /> },
];

function IconTile({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "amber" }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)]"
      style={{
        background:
          tone === "amber"
            ? "linear-gradient(160deg,#FFF8E6 0%,#FBECC6 100%)"
            : "linear-gradient(160deg,#F7F5FE 0%,#E9E6F9 100%)",
        color: tone === "amber" ? "#A8741A" : ACCENT,
      }}
    >
      {children}
    </span>
  );
}

export function PurchaseUnverifiedRecovery() {
  return (
    <main
      className="flex flex-1 flex-col bg-white"
      style={{ fontFamily: FONT_STACK, color: NAVY }}
    >
      <section className="relative w-full px-4 pt-7 md:px-8 md:pt-12">
        {/* 淡い帯。手順の表の途中で終わり、表が帯と白地にまたがる。 */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 bottom-[84px]"
          style={{
            background:
              "radial-gradient(90% 70% at 50% 0%, #FDFCFF 0%, rgba(253,252,255,0) 70%), linear-gradient(180deg, #F6F4FD 0%, #EBE8F8 100%)",
            borderBottomLeftRadius: BAND_CURVE,
            borderBottomRightRadius: BAND_CURVE,
          }}
        />
        <div className="relative mx-auto max-w-[540px]">
          <ReceiptSearchArt />
          <p className="mt-3 flex justify-center">
            <span
              className="rounded-full bg-white px-3 py-[5px] text-[11px] font-bold leading-none tracking-[0.06em] shadow-[0_1px_2px_rgba(46,46,92,0.08)]"
              style={{ color: "#A8741A" }}
            >
              お支払いの確認
            </span>
          </p>
          <h1
            className="mt-3.5 text-center text-[clamp(22px,6.6vw,28px)] font-black leading-[1.35] tracking-[0.02em]"
            style={{ fontFeatureSettings: PALT }}
          >
            購入を確認できませんでした
          </h1>
          {/* 見出しの下は2段だけ: 安心の一文 (濃い色・太字) と、やることの一文 (淡い色)。
              行の長さがそろうよう、どちらも1行に収める。 */}
          <p
            className="mt-3 text-center text-[clamp(14.5px,4.2vw,16px)] font-bold leading-[1.5] tracking-[0.01em]"
            style={{ fontFeatureSettings: PALT }}
          >
            購入した内容は、なくなっていません
          </p>
          <p className="mt-1.5 text-center text-[clamp(12px,3.4vw,13.5px)] leading-[1.7] text-[#5C5C7A]">
            お支払いが済んでいれば、次の3つの手順で使えます
          </p>

          <ol
            className={`mt-5 rounded-[20px] border border-[#E6E4F1] bg-white ${CARD_SHADOW}`}
          >
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="relative flex items-center gap-3 px-3.5 py-2.5"
              >
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[70px] right-0 top-0 h-px bg-[#EDECF5]"
                  />
                )}
                <IconTile>{step.icon}</IconTile>
                <p className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#EEEDFC] text-[11px] font-bold leading-none"
                    style={{ color: ACCENT }}
                  >
                    {index + 1}
                  </span>
                  <span
                    className="text-[clamp(13px,4vw,15.5px)] font-bold leading-[1.4] tracking-[0.01em]"
                    style={{ fontFeatureSettings: PALT }}
                  >
                    {step.title}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="flex flex-col items-center px-4 pb-14 pt-6 md:px-8">
        <LoginCard
          locale="ja"
          heading="購入時のメールでログイン"
          description="購入に使ったメールアドレスに、ログイン用のリンクをお送りします。"
        />

        <div className="mt-9 w-full max-w-[540px]">
          <h2 className="flex items-center justify-center gap-3 text-[13px] font-bold tracking-[0.06em] text-[#4A4A68]">
            <span aria-hidden="true" className="h-px w-5 bg-[#C9C5E0]" />
            うまくいかないとき
            <span aria-hidden="true" className="h-px w-5 bg-[#C9C5E0]" />
          </h2>
          <ul className="mt-3 rounded-[20px] border border-[#E6E4F1] bg-white">
            <li>
              <a
                href={SUPPORT_MAILTO}
                className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[#FAFAFE]"
              >
                <IconTile>
                  <MailIcon />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold leading-[1.4]">
                    ログインしても使えない
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-[1.6] text-[#4F4F6E]">
                    購入時のメールアドレスを添えて、サポートへ
                  </span>
                </span>
                <span className="shrink-0 text-[#B9B6D3]">
                  <ChevronIcon />
                </span>
              </a>
            </li>
            <li className="relative flex items-center gap-3 px-3.5 py-3">
              <span
                aria-hidden="true"
                className="absolute left-[70px] right-0 top-0 h-px bg-[#EDECF5]"
              />
              <IconTile tone="amber">
                <ShieldIcon />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-[1.4]">
                  お支払いの途中でやめた
                </span>
                <span className="mt-0.5 block text-[12px] leading-[1.6] text-[#4F4F6E]">
                  料金は発生していません
                </span>
              </span>
            </li>
          </ul>
        </div>

        <Link
          href="/"
          className="mt-7 text-[12px] underline underline-offset-2"
          style={{ color: `${NAVY}80` }}
        >
          トップに戻る
        </Link>
      </section>
    </main>
  );
}
