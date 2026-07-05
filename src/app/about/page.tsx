import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";
import { faqItems } from "@/lib/faq-data";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";

// /about: サービスについて (トップページ / /types と同じ Sora トーンで統一)。
//   旧「このBotについて」(LINE Bot 中心の説明) から、サービス全体の紹介ページに刷新。
//   FAQ は lib/faq-data.ts が単一情報源 (UI と FAQPage JSON-LD の両方がここから派生)。

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

const DEVELOPER_NAME =
  process.env.NEXT_PUBLIC_DEVELOPER_NAME ?? "ワタシのトリセツ運営";

export const metadata: Metadata = {
  title: "サービスについて",
  description:
    "ワタシのトリセツは、自分の診断と友達からの他己評価をかけ合わせて作る自己理解サービス。Big Five 心理学をベースに、「友達から見えているワタシ」がわかります。",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "サービスについて｜ワタシのトリセツ",
    description:
      "自分の診断と友達からの他己評価をかけ合わせて作る、自分の取扱説明書。",
    images: [{ url: "/ogp-v4.png", width: 1200, height: 630 }],
  },
};

// 使い方 3 ステップ
const STEPS = [
  {
    num: "1",
    title: "自己診断を受ける",
    body: "50問・約3分。Big Five 心理学ベースの質問に答えると、32タイプから「あなた」が見つかります。",
  },
  {
    num: "2",
    title: "友達に他己診断を頼む",
    body: "招待リンクを友達に送るだけ。友達は匿名で、5分であなたの印象を答えられます。",
  },
  {
    num: "3",
    title: "「友達から見たワタシ」がわかる",
    body: "自己評価と友達からの評価のギャップがわかり、あなたのトリセツが完成していきます。",
  },
];

const privacyItems = [
  "友達からの他己評価は完全匿名。誰がどう答えたかは表示されません",
  "知らない人と繋がることはありません。診断や招待は自分が主導",
  "広告は配信しません",
  "データは自己理解の精度向上以外に使いません",
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function AboutPage() {
  return (
    <div
      className="flex flex-1 flex-col bg-white"
      style={{ fontFamily: FONT_STACK }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <TopHeader />

      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-20">
        {/* Hero */}
        <section className="pt-12 text-center md:pt-16">
          <h1
            className="font-bold"
            style={{
              color: NAVY,
              fontSize: "clamp(30px, 4vw, 44px)",
              lineHeight: 1.4,
            }}
          >
            サービスについて
          </h1>
          <p
            className="mx-auto mt-4 max-w-[560px] text-[15px] leading-[1.9] md:text-[16px]"
            style={{ color: `${NAVY}B3` }}
          >
            ワタシのトリセツは、自分の診断と友達からの評価をかけ合わせて作る、
            「自分の取扱説明書」です。
          </p>
          <Image
            src="/characters/cut/penguin_N.png"
            alt=""
            width={280}
            height={280}
            priority
            className="mx-auto mt-6 h-auto w-[220px] md:w-[260px]"
          />
        </section>

        {/* 使い方 3 ステップ */}
        <section className="mt-14">
          <h2
            className="text-center text-[22px] font-bold md:text-[26px]"
            style={{ color: NAVY }}
          >
            使い方はかんたん
          </h2>
          <div className="mt-6 flex flex-col gap-4">
            {STEPS.map((s) => (
              <div
                key={s.num}
                className="flex items-start gap-4 rounded-2xl border border-[#E3E6F5] bg-white p-5"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white"
                  style={{ backgroundColor: SORA }}
                >
                  {s.num}
                </span>
                <div>
                  <h3
                    className="text-[16px] font-bold leading-snug"
                    style={{ color: NAVY }}
                  >
                    {s.title}
                  </h3>
                  <p
                    className="mt-1 text-[14px] leading-relaxed"
                    style={{ color: `${NAVY}B3` }}
                  >
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 診断のベース */}
        <section className="mt-14">
          <h2
            className="text-center text-[22px] font-bold md:text-[26px]"
            style={{ color: NAVY }}
          >
            診断のベースは Big Five
          </h2>
          <p
            className="mx-auto mt-4 max-w-[560px] text-[14px] leading-[1.9]"
            style={{ color: `${NAVY}B3` }}
          >
            性格心理学でもっとも信頼されている「Big Five
            理論」をベースに、開放性・誠実性・外向性・協調性・神経症傾向の5軸であなたを分析。
            結果は、海・陸・空・未知の4グループ・32の性格タイプで表現されます。
          </p>
          <div className="mt-5 text-center">
            <Link
              href="/types"
              className="text-[14px] font-bold underline underline-offset-4"
              style={{ color: SORA }}
            >
              32の性格タイプを見る →
            </Link>
          </div>
        </section>

        {/* プライバシー */}
        <section className="mt-14">
          <h2
            className="text-center text-[22px] font-bold md:text-[26px]"
            style={{ color: NAVY }}
          >
            プライバシーについて
          </h2>
          <ul className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#D9DCF5] bg-[#F4F4FE] p-6">
            {privacyItems.map((text) => (
              <li
                key={text}
                className="flex items-start gap-2.5 text-[14px] leading-relaxed"
                style={{ color: NAVY }}
              >
                <span
                  aria-hidden
                  className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SORA }}
                />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2
            className="text-center text-[22px] font-bold md:text-[26px]"
            style={{ color: NAVY }}
          >
            よくある質問
          </h2>
          <div className="mt-6">
            <FAQAccordion />
          </div>
        </section>

        {/* 運営 */}
        <section className="mt-14">
          <h2
            className="text-center text-[22px] font-bold md:text-[26px]"
            style={{ color: NAVY }}
          >
            運営について
          </h2>
          <div className="mt-6 rounded-2xl border border-[#E3E6F5] bg-white p-6 text-[14px] leading-[1.9]">
            <p style={{ color: `${NAVY}CC` }}>
              九州の大学生に向けて作っています。Big Five 心理学を土台に、
              「自分の知らない自分」を見つけられるサービスを目指しています。
            </p>
            <p className="mt-3 text-[12px]" style={{ color: `${NAVY}80` }}>
              — {DEVELOPER_NAME}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <Link
            href="/diagnosis"
            className="sora-cta inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
          >
            テストを受ける →
          </Link>
        </section>
      </main>

      <TopFooter />
    </div>
  );
}
