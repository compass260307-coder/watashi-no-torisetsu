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

import {
  ACCENT,
  AMBER,
  BAND_CURVE,
  CARD_SHADOW,
  ChevronIcon,
  FONT_STACK,
  IconTile,
  MailIcon,
  NAVY,
  PALT,
  ReceiptArt,
  ShieldIcon,
  SUPPORT_MAILTO,
  TapIcon,
  UnlockIcon,
} from "@/components/recovery-ui";

// 見出しの上の絵: レシートを虫めがねで探している図。
function ReceiptSearchArt() {
  return (
    <ReceiptArt>
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
    </ReceiptArt>
  );
}

const STEPS: { title: string; icon: ReactNode }[] = [
  { title: "購入時のメールアドレスを入力", icon: <MailIcon /> },
  { title: "届いたメールのリンクを開く", icon: <TapIcon /> },
  { title: "購入した内容がすぐに使える", icon: <UnlockIcon /> },
];

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
