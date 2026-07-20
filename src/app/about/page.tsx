import type { Metadata } from "next";
import { SmoothImage } from "@/components/ui/SmoothImage";
import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";
import { faqItems } from "@/lib/faq-data";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";

// /about: サービスについて。読み物ストーリー型 (16personalities の記事ページ風)。
//   白基調ミニマル・左寄せ章立てで「なぜ作ったか → 仕組み → 科学的背景 → タイプ紹介」と読ませる。
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
    title: "友達に友達診断を頼む",
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

// タイプギャラリー (32タイプから各グループ2体ずつ抜粋)
const GALLERY = [
  { name: "なかよしペンギン", src: "/characters/v3/penguin_N.webp" },
  { name: "クールタカ", src: "/characters/v3/hawk_R.webp" },
  { name: "にこにこパンダ", src: "/characters/v3/fox_N.webp" },
  { name: "どっしりクマ", src: "/characters/v3/bear_R.webp" },
  { name: "きらめきイルカ", src: "/characters/v3/jellyfish_N.webp" },
  { name: "マイペースサメ", src: "/characters/v3/shark_R.webp" },
  { name: "おもいやりエンジェル", src: "/characters/v3/angel_N.webp" },
  { name: "ゆるぎないドラゴン", src: "/characters/v3/dragon_R.webp" },
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[22px] font-bold leading-snug md:text-[26px]"
      style={{ color: NAVY }}
    >
      {children}
    </h2>
  );
}

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

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pb-20 md:px-8">
        {/* Hero: 大きなコピーだけ */}
        <section className="pt-16 md:pt-24">
          <h1
            className="font-bold"
            style={{
              color: NAVY,
              fontSize: "clamp(32px, 5.5vw, 48px)",
              lineHeight: 1.45,
            }}
          >
            自分のことは、
            <br />
            自分が一番知らない。
          </h1>
          <p
            className="mt-6 text-[15px] leading-[2] md:text-[16px]"
            style={{ color: `${NAVY}B3` }}
          >
            ワタシのトリセツは、自分の診断と友達からの評価をかけ合わせて作る「自分の取扱説明書」。
            友達が答えてくれるほど、あなたのトリセツが完成していきます。
          </p>
        </section>

        {/* なぜ作ったのか */}
        <section className="mt-20">
          <SectionTitle>なぜ作ったのか</SectionTitle>
          <div
            className="mt-5 flex flex-col gap-4 text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            <p>
              性格診断は世の中にたくさんあります。でもそのほとんどは、「自分が答えた自分」しか映しません。
              いくら正直に答えても、そこに映るのは自分がすでに知っているワタシだけ。
            </p>
            <p>
              一方で、「友達しか知らないワタシ」が確かに存在します。
              自分では気づいていない口ぐせ、頼られ方、場の空気の変え方。
              心理学ではこれを「盲点の窓」と呼びます。ここにこそ、自己理解のいちばん面白い部分が眠っています。
            </p>
            <p>
              だからワタシのトリセツは、自分の回答だけで完結しません。
              友達の回答が集まるほどトリセツが完成していく、そんな仕組みにしました。
              重たい自己分析ではなく、友達と笑いながら見せ合えるくらいの軽さで。
            </p>
          </div>
        </section>

        {/* 仕組み: 自己評価 × 他己評価 */}
        <section className="mt-20">
          <SectionTitle>仕組みはシンプル</SectionTitle>
          <p
            className="mt-5 text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            あなたの自己診断と、友達からの他己評価。ふたつを重ねると、自分では見えなかった「ギャップ」が浮かび上がります。
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 md:flex-row md:justify-center">
            <div
              className="w-full rounded-2xl border-2 p-5 text-center md:w-[240px]"
              style={{ borderColor: "#E3E6F5" }}
            >
              <p className="text-[13px] font-bold" style={{ color: `${NAVY}99` }}>
                自己診断
              </p>
              <p className="mt-1 text-[16px] font-bold" style={{ color: NAVY }}>
                自分が知ってるワタシ
              </p>
            </div>
            <span
              className="text-[22px] font-bold md:px-2"
              style={{ color: SORA }}
              aria-hidden
            >
              ×
            </span>
            <div
              className="w-full rounded-2xl border-2 p-5 text-center md:w-[240px]"
              style={{ borderColor: "#E3E6F5" }}
            >
              <p className="text-[13px] font-bold" style={{ color: `${NAVY}99` }}>
                他己評価
              </p>
              <p className="mt-1 text-[16px] font-bold" style={{ color: NAVY }}>
                友達から見えているワタシ
              </p>
            </div>
          </div>
          <div className="mt-3 text-center" aria-hidden>
            <span className="text-[20px]" style={{ color: `${NAVY}66` }}>
              ↓
            </span>
          </div>
          <div
            className="mx-auto mt-3 w-full rounded-2xl p-5 text-center md:w-[400px]"
            style={{ backgroundColor: "#F4F4FE" }}
          >
            <p className="text-[16px] font-bold" style={{ color: SORA }}>
              ギャップ = 自分の知らないワタシ
            </p>
            <p
              className="mt-1 text-[13px] leading-relaxed"
              style={{ color: `${NAVY}B3` }}
            >
              ここが、あなたのトリセツのいちばん面白いページになります。
            </p>
          </div>
        </section>

        {/* 使い方 */}
        <section className="mt-20">
          <SectionTitle>使い方はかんたん</SectionTitle>
          <ol className="mt-6 flex flex-col gap-6">
            {STEPS.map((s) => (
              <li key={s.num} className="flex items-start gap-4">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
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
                    className="mt-1 text-[14px] leading-[1.9]"
                    style={{ color: `${NAVY}B3` }}
                  >
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 科学的背景 */}
        <section className="mt-20">
          <SectionTitle>科学的背景 — Big Five</SectionTitle>
          <div
            className="mt-5 flex flex-col gap-4 text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            <p>
              診断のベースは、性格心理学でもっとも信頼されている「Big Five
              理論」。開放性・誠実性・外向性・協調性・神経症傾向の5つの軸であなたを分析します。
              5軸の頭文字から「OCEANモデル」とも呼ばれ、OCEAN診断として世界中の研究で使われています。
            </p>
            <p>
              5軸のスコアの組み合わせから、結果は海・陸・空・未知の4グループ・32の性格タイプで表現されます。
              よく知られる16タイプ性格診断よりも細かい分類で、より「あなたらしさ」に近づけます。
              他己評価も同じ軸で答えてもらうから、自己評価とのギャップをそのまま比べられます。
            </p>
          </div>
        </section>

        {/* 32のタイプたち */}
        <section className="mt-20">
          <SectionTitle>32のタイプたち</SectionTitle>
          <p
            className="mt-5 text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            あなたはどのタイプ?
            診断結果は、個性ゆたかな32匹のキャラクターで表現されます。
          </p>
          <div className="mt-6 grid grid-cols-4 gap-x-3 gap-y-5">
            {GALLERY.map((c) => (
              <div key={c.src} className="text-center">
                <SmoothImage
                  src={c.src}
                  alt={c.name}
                  width={120}
                  height={120}
                  className="mx-auto h-auto w-full max-w-[96px]"
                />
                <p
                  className="mt-1.5 text-[10px] font-bold leading-tight md:text-[11px]"
                  style={{ color: `${NAVY}B3` }}
                >
                  {c.name}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/types"
              className="text-[14px] font-bold underline underline-offset-4"
              style={{ color: SORA }}
            >
              32の性格タイプをぜんぶ見る →
            </Link>
          </div>
        </section>

        {/* プライバシー */}
        <section className="mt-20">
          <SectionTitle>大切にしていること</SectionTitle>
          <ul className="mt-6 flex flex-col gap-3">
            {privacyItems.map((text) => (
              <li
                key={text}
                className="flex items-start gap-2.5 text-[14px] leading-[1.9]"
                style={{ color: `${NAVY}CC` }}
              >
                <span
                  aria-hidden
                  className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SORA }}
                />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-20">
          <SectionTitle>よくある質問</SectionTitle>
          <div className="mt-6">
            <FAQAccordion />
          </div>
        </section>

        {/* 運営 */}
        <section className="mt-20">
          <SectionTitle>運営について</SectionTitle>
          <div
            className="mt-5 text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            <p>
              Big Five 心理学を土台に、
              「自分の知らない自分」を見つけられるサービスを目指しています。
            </p>
            <p className="mt-3 text-[12px]" style={{ color: `${NAVY}80` }}>
              — {DEVELOPER_NAME}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-20 text-center">
          <p
            className="text-[18px] font-bold leading-snug md:text-[20px]"
            style={{ color: NAVY }}
          >
            まずは、自分の知ってるワタシから。
          </p>
          <Link
            href="/diagnosis"
            className="sora-cta mt-6 inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
          >
            テストを受ける →
          </Link>
        </section>
      </main>

      <TopFooter />
    </div>
  );
}
