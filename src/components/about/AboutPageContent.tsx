import Link from "next/link";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import FAQAccordion from "@/components/FAQAccordion";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { faqItems, type FaqItem } from "@/lib/faq-data";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";
const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

type AboutLocale = "ja" | "en" | "id";

type AboutCopy = {
  hero: readonly [string, string];
  heroBody: string;
  whyTitle: string;
  why: readonly string[];
  mechanismTitle: string;
  mechanismIntro: string;
  selfLabel: string;
  selfValue: string;
  friendLabel: string;
  friendValue: string;
  gapTitle: string;
  gapBody: string;
  stepsTitle: string;
  steps: readonly { num: string; title: string; body: string }[];
  scienceTitle: string;
  science: readonly string[];
  typesTitle: string;
  typesIntro: string;
  gallery: readonly { name: string; src: string }[];
  allTypes: string;
  valuesTitle: string;
  values: readonly string[];
  faqTitle: string;
  faq: readonly FaqItem[];
  operatorTitle: string;
  operatorBody: string;
  operatorName: string;
  ctaLead: string;
  cta: string;
};

const GALLERY_IMAGES = [
  "/characters/v3/penguin_N.webp",
  "/characters/v3/hawk_R.webp",
  "/characters/v3/fox_N.webp",
  "/characters/v3/bear_R.webp",
  "/characters/v3/jellyfish_N.webp",
  "/characters/v3/shark_R.webp",
  "/characters/v3/angel_N.webp",
  "/characters/v3/dragon_R.webp",
] as const;

const EN_FAQ: readonly FaqItem[] = [
  { question: "What is Alice Personalities?", answer: "Alice Personalities combines your own Big Five answers with feedback from friends so you can understand both your self-image and how other people experience you." },
  { question: "What is the Big Five personality model?", answer: "The Big Five describes personality through openness, conscientiousness, extraversion, agreeableness, and emotional sensitivity. It is also called the OCEAN model." },
  { question: "How is this different from a 16-type test?", answer: "Alice Personalities uses the research-based Big Five, describes results through 32 character types, and adds anonymous feedback from friends." },
  { question: "Can I use it for free?", answer: "The personality test and basic result are free. Optional paid features unlock the complete report and additional experiences." },
  { question: "Do I need an account?", answer: "You can take the personality test without creating an account. Email sign-in lets you restore your results and purchases on another device." },
  { question: "How long does the test take?", answer: "The 50-question personality test takes about three minutes when you answer by instinct." },
  { question: "Can other people see my result?", answer: "Your result is private unless you choose to share its private link. Friends who answer do not automatically receive access to your report." },
  { question: "How many friends should I invite?", answer: "One completed response is enough to begin comparing perspectives. More responses provide a broader picture." },
  { question: "Who is Alice Personalities for?", answer: "It is for anyone who wants clearer language for self-reflection, relationships, career conversations, or feedback from friends." },
];

const ID_FAQ: readonly FaqItem[] = [
  { question: "Apa itu Alice Test?", answer: "Alice Test menggabungkan jawaban Big Five Anda dengan penilaian teman agar Anda dapat memahami citra diri dan cara orang lain melihat Anda." },
  { question: "Apa itu model kepribadian Big Five?", answer: "Big Five menggambarkan kepribadian melalui keterbukaan, ketelitian, ekstraversi, keramahan, dan kepekaan emosional. Model ini juga disebut OCEAN." },
  { question: "Apa bedanya dengan tes 16 tipe?", answer: "Alice Test menggunakan Big Five yang berbasis riset, menampilkan 32 tipe karakter, dan menambahkan penilaian anonim dari teman." },
  { question: "Apakah bisa digunakan gratis?", answer: "Tes kepribadian dan hasil dasar tersedia gratis. Edisi lengkap dan pengalaman tambahan dapat dibuka dengan satu kali pembelian." },
  { question: "Apakah saya perlu membuat akun?", answer: "Anda dapat mengikuti tes tanpa akun. Masuk melalui email memungkinkan hasil dan pembelian dipulihkan di perangkat lain." },
  { question: "Berapa lama tesnya?", answer: "Tes berisi 50 pertanyaan dan biasanya selesai dalam sekitar tiga menit." },
  { question: "Apakah orang lain dapat melihat hasil saya?", answer: "Hasil Anda bersifat pribadi kecuali Anda membagikan tautannya. Teman yang menjawab tidak otomatis dapat melihat laporan Anda." },
  { question: "Berapa banyak teman yang perlu diundang?", answer: "Satu jawaban sudah cukup untuk mulai membandingkan sudut pandang. Semakin banyak jawaban, semakin luas gambaran yang diperoleh." },
  { question: "Untuk siapa Alice Test dibuat?", answer: "Untuk siapa saja yang ingin memahami diri, hubungan, karier, dan penilaian teman dengan bahasa yang lebih jelas." },
];

const COPY: Record<AboutLocale, AboutCopy> = {
  ja: {
    hero: ["自分のことは、", "自分が一番知らない。"],
    heroBody: "ワタシのトリセツは、自分の診断と友達からの評価をかけ合わせて作る「自分の取扱説明書」。友達が答えてくれるほど、あなたのトリセツが完成していきます。",
    whyTitle: "なぜ作ったのか",
    why: [
      "性格診断は世の中にたくさんあります。でもそのほとんどは、「自分が答えた自分」しか映しません。いくら正直に答えても、そこに映るのは自分がすでに知っているワタシだけ。",
      "一方で、「友達しか知らないワタシ」が確かに存在します。自分では気づいていない口ぐせ、頼られ方、場の空気の変え方。心理学ではこれを「盲点の窓」と呼びます。ここにこそ、自己理解のいちばん面白い部分が眠っています。",
      "だからワタシのトリセツは、自分の回答だけで完結しません。友達の回答が集まるほどトリセツが完成していく、そんな仕組みにしました。重たい自己分析ではなく、友達と笑いながら見せ合えるくらいの軽さで。",
    ],
    mechanismTitle: "仕組みはシンプル",
    mechanismIntro: "あなたの自己診断と、友達からの他己評価。ふたつを重ねると、自分では見えなかった「ギャップ」が浮かび上がります。",
    selfLabel: "自己診断", selfValue: "自分が知ってるワタシ",
    friendLabel: "他己評価", friendValue: "友達から見えているワタシ",
    gapTitle: "ギャップ = 自分の知らないワタシ",
    gapBody: "ここが、あなたのトリセツのいちばん面白いページになります。",
    stepsTitle: "使い方はかんたん",
    steps: [
      { num: "1", title: "自己診断を受ける", body: "50問・約3分。Big Five 心理学ベースの質問に答えると、32タイプから「あなた」が見つかります。" },
      { num: "2", title: "友達に友達診断を頼む", body: "招待リンクを友達に送るだけ。友達は匿名で、5分であなたの印象を答えられます。" },
      { num: "3", title: "「友達から見たワタシ」がわかる", body: "自己評価と友達からの評価のギャップがわかり、あなたのトリセツが完成していきます。" },
    ],
    scienceTitle: "科学的背景 — Big Five",
    science: [
      "診断のベースは、性格心理学でもっとも信頼されている「Big Five 理論」。開放性・誠実性・外向性・協調性・神経症傾向の5つの軸であなたを分析します。5軸の頭文字から「OCEANモデル」とも呼ばれ、OCEAN診断として世界中の研究で使われています。",
      "5軸のスコアの組み合わせから、結果は海・陸・空・未知の4グループ・32の性格タイプで表現されます。よく知られる16タイプ性格診断よりも細かい分類で、より「あなたらしさ」に近づけます。他己評価も同じ軸で答えてもらうから、自己評価とのギャップをそのまま比べられます。",
    ],
    typesTitle: "32のタイプたち",
    typesIntro: "あなたはどのタイプ? 診断結果は、個性ゆたかな32匹のキャラクターで表現されます。",
    gallery: ["なかよしペンギン", "クールタカ", "にこにこパンダ", "どっしりクマ", "きらめきイルカ", "マイペースサメ", "おもいやりエンジェル", "ゆるぎないドラゴン"].map((name, index) => ({ name, src: GALLERY_IMAGES[index] })),
    allTypes: "32の性格タイプをぜんぶ見る →",
    valuesTitle: "大切にしていること",
    values: ["友達からの他己評価は完全匿名。誰がどう答えたかは表示されません", "知らない人と繋がることはありません。診断や招待は自分が主導", "広告は配信しません", "データは自己理解の精度向上以外に使いません"],
    faqTitle: "よくある質問", faq: faqItems,
    operatorTitle: "運営について",
    operatorBody: "Big Five 心理学を土台に、「自分の知らない自分」を見つけられるサービスを目指しています。",
    operatorName: process.env.NEXT_PUBLIC_DEVELOPER_NAME ?? "ワタシのトリセツ運営",
    ctaLead: "まずは、自分の知ってるワタシから。", cta: "テストを受ける →",
  },
  en: {
    hero: ["You may know yourself,", "but you cannot see every side."],
    heroBody: "Alice Personalities combines your own answers with feedback from friends to build a personal guide to you. Each friend’s perspective brings another part of that guide into focus.",
    whyTitle: "Why we made it",
    why: [
      "There are many personality tests, but most can only reflect the version of you that answers the questions. Even completely honest answers begin with what you already know about yourself.",
      "Your friends notice another side: the habits you overlook, the way people rely on you, and how your presence changes a room. Psychology describes this as a blind spot, and it can hold some of the most useful parts of self-understanding.",
      "That is why Alice Personalities does not stop with your own answers. Your guide grows as friends respond while remaining easy to compare and discuss together.",
    ],
    mechanismTitle: "The idea is simple",
    mechanismIntro: "Place your self-assessment beside feedback from friends and the gaps reveal parts of you that are difficult to see alone.",
    selfLabel: "Self-assessment", selfValue: "The side of me I already know",
    friendLabel: "Friend feedback", friendValue: "The side of me my friends can see",
    gapTitle: "The gap = a side of me I had not seen",
    gapBody: "That becomes one of the most useful pages in your personal guide.",
    stepsTitle: "How it works",
    steps: [
      { num: "1", title: "Take your personality test", body: "Answer 50 Big Five questions in about three minutes and meet one of 32 character types." },
      { num: "2", title: "Invite friends to describe you", body: "Send a private invitation link. Friends can answer anonymously from their own point of view." },
      { num: "3", title: "See yourself from both sides", body: "Compare your self-image with your friends’ impressions as your personal guide grows." },
    ],
    scienceTitle: "The science behind it: the Big Five",
    science: [
      "The test is based on the Big Five, a widely used personality framework covering openness, conscientiousness, extraversion, agreeableness, and emotional sensitivity. The initials form the name OCEAN.",
      "Combinations across those five dimensions become 32 character types in four groups: Sea, Land, Sky, and Beyond. Friends answer along the same dimensions, so the two perspectives can be compared directly.",
    ],
    typesTitle: "Meet the 32 types",
    typesIntro: "Which one are you? Your result appears as one of 32 distinctive characters.",
    gallery: ["Friendly Penguin", "Cool Hawk", "Cheerful Panda", "Grounded Bear", "Shimmering Jellyfish", "Independent Shark", "Thoughtful Angel", "Steadfast Dragon"].map((name, index) => ({ name, src: GALLERY_IMAGES[index] })),
    allTypes: "Explore all 32 personality types →",
    valuesTitle: "What matters to us",
    values: ["Friend feedback is anonymous; individual answers are not identified", "You choose who to invite and never connect with strangers", "We do not show ads in the service", "Your data is used to provide and improve your self-reflection experience"],
    faqTitle: "Frequently asked questions", faq: EN_FAQ,
    operatorTitle: "Who operates the service",
    operatorBody: "We use Big Five psychology to help people discover parts of themselves that are difficult to see alone.",
    operatorName: "Alice Personalities Operations",
    ctaLead: "Start with the version of you that you already know.", cta: "Take the free test →",
  },
  id: {
    hero: ["Tentang diri sendiri,", "sering kali justru kita yang paling tidak tahu."],
    heroBody: "Alice Test menggabungkan tes diri dan penilaian teman untuk membuat panduan pribadi tentang diri Anda. Setiap jawaban teman membuat panduan itu semakin lengkap.",
    whyTitle: "Mengapa kami membuatnya",
    why: [
      "Ada banyak tes kepribadian, tetapi kebanyakan hanya memotret diri yang menjawab pertanyaan. Bahkan jawaban yang sangat jujur tetap berangkat dari sisi diri yang sudah Anda ketahui.",
      "Teman melihat sisi lain: kebiasaan yang tidak Anda sadari, cara orang mengandalkan Anda, dan bagaimana kehadiran Anda mengubah suasana. Dalam psikologi, sisi ini dikenal sebagai titik buta dan sering menyimpan bagian paling menarik dari pemahaman diri.",
      "Karena itu Alice Test tidak berhenti pada jawaban Anda sendiri. Panduan Anda berkembang seiring teman memberi penilaian, tetap ringan untuk dibaca dan dibicarakan bersama.",
    ],
    mechanismTitle: "Caranya sederhana",
    mechanismIntro: "Letakkan penilaian diri di samping penilaian teman. Perbedaannya akan memperlihatkan sisi yang sulit Anda lihat sendiri.",
    selfLabel: "Penilaian diri", selfValue: "Diri yang saya kenal",
    friendLabel: "Penilaian teman", friendValue: "Diri yang dilihat teman",
    gapTitle: "Perbedaan = sisi diri yang belum saya kenal",
    gapBody: "Bagian inilah yang menjadi halaman paling menarik dalam panduan pribadi Anda.",
    stepsTitle: "Cara menggunakannya",
    steps: [
      { num: "1", title: "Ikuti tes kepribadian", body: "Jawab 50 pertanyaan Big Five dalam sekitar tiga menit dan temukan karakter Anda dari 32 tipe." },
      { num: "2", title: "Minta teman menilai Anda", body: "Kirim tautan undangan pribadi. Teman dapat menjawab secara anonim dari sudut pandang mereka." },
      { num: "3", title: "Lihat diri dari dua sisi", body: "Bandingkan citra diri dengan kesan teman sambil melengkapi panduan pribadi Anda." },
    ],
    scienceTitle: "Dasar ilmiah — Big Five",
    science: [
      "Tes ini didasarkan pada Big Five, kerangka kepribadian yang luas digunakan dalam psikologi: keterbukaan, ketelitian, ekstraversi, keramahan, dan kepekaan emosional. Huruf awal kelimanya membentuk nama OCEAN.",
      "Kombinasi lima dimensi tersebut ditampilkan sebagai 32 karakter dalam empat kelompok: Laut, Darat, Langit, dan Misteri. Teman menjawab pada dimensi yang sama sehingga kedua sudut pandang dapat dibandingkan langsung.",
    ],
    typesTitle: "Kenali 32 tipe",
    typesIntro: "Tipe mana yang paling mirip dengan Anda? Hasil tes ditampilkan sebagai satu dari 32 karakter yang khas.",
    gallery: ["Penguin Ramah", "Elang Tenang", "Panda Ceria", "Beruang Teguh", "Ubur-ubur Berkilau", "Hiu Mandiri", "Malaikat Penuh Perhatian", "Naga Teguh"].map((name, index) => ({ name, src: GALLERY_IMAGES[index] })),
    allTypes: "Lihat semua 32 tipe kepribadian →",
    valuesTitle: "Hal yang penting bagi kami",
    values: ["Penilaian teman bersifat anonim; jawaban individual tidak ditampilkan", "Anda memilih sendiri siapa yang diundang dan tidak akan terhubung dengan orang asing", "Kami tidak menampilkan iklan di dalam layanan", "Data digunakan untuk menyediakan dan meningkatkan pengalaman refleksi diri Anda"],
    faqTitle: "Pertanyaan umum", faq: ID_FAQ,
    operatorTitle: "Tentang pengelola",
    operatorBody: "Kami menggunakan psikologi Big Five untuk membantu orang menemukan sisi diri yang sulit dilihat sendirian.",
    operatorName: "Tim Operasional Alice Test",
    ctaLead: "Mulai dari sisi diri yang sudah Anda kenal.", cta: "Ikuti tes gratis →",
  },
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[22px] font-bold leading-snug md:text-[26px]" style={{ color: NAVY }}>{children}</h2>;
}

export default function AboutPageContent({ locale }: { locale: AboutLocale }) {
  const copy = COPY[locale];
  const isEnglish = locale === "en";
  const prefix = locale === "ja" ? "" : `/${locale}`;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };

  return (
    <div className="flex flex-1 flex-col bg-white" style={isEnglish ? undefined : { fontFamily: FONT_STACK }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {isEnglish ? <EnSiteHeader /> : <TopHeader locale={locale} />}
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pb-20 md:px-8">
        <section className="pt-16 md:pt-24">
          <h1 className="font-bold" style={{ color: NAVY, fontSize: "clamp(32px, 5.5vw, 48px)", lineHeight: 1.45 }}>
            {copy.hero[0]}<br />{copy.hero[1]}
          </h1>
          <p className="mt-6 text-[15px] leading-[2] md:text-[16px]" style={{ color: `${NAVY}B3` }}>{copy.heroBody}</p>
        </section>

        <section className="mt-20">
          <SectionTitle>{copy.whyTitle}</SectionTitle>
          <div className="mt-5 flex flex-col gap-4 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>
            {copy.why.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>

        <section className="mt-20">
          <SectionTitle>{copy.mechanismTitle}</SectionTitle>
          <p className="mt-5 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>{copy.mechanismIntro}</p>
          <div className="mt-6 flex flex-col items-center gap-3 md:flex-row md:justify-center">
            <div className="w-full rounded-2xl border-2 p-5 text-center md:w-[240px]" style={{ borderColor: "#E3E6F5" }}>
              <p className="text-[13px] font-bold" style={{ color: `${NAVY}99` }}>{copy.selfLabel}</p>
              <p className="mt-1 text-[16px] font-bold" style={{ color: NAVY }}>{copy.selfValue}</p>
            </div>
            <span className="text-[22px] font-bold md:px-2" style={{ color: SORA }} aria-hidden>×</span>
            <div className="w-full rounded-2xl border-2 p-5 text-center md:w-[240px]" style={{ borderColor: "#E3E6F5" }}>
              <p className="text-[13px] font-bold" style={{ color: `${NAVY}99` }}>{copy.friendLabel}</p>
              <p className="mt-1 text-[16px] font-bold" style={{ color: NAVY }}>{copy.friendValue}</p>
            </div>
          </div>
          <div className="mt-3 text-center" aria-hidden><span className="text-[20px]" style={{ color: `${NAVY}66` }}>↓</span></div>
          <div className="mx-auto mt-3 w-full rounded-2xl p-5 text-center md:w-[400px]" style={{ backgroundColor: "#F4F4FE" }}>
            <p className="text-[16px] font-bold" style={{ color: SORA }}>{copy.gapTitle}</p>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: `${NAVY}B3` }}>{copy.gapBody}</p>
          </div>
        </section>

        <section className="mt-20">
          <SectionTitle>{copy.stepsTitle}</SectionTitle>
          <ol className="mt-6 flex flex-col gap-6">
            {copy.steps.map((step) => (
              <li key={step.num} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ backgroundColor: SORA }}>{step.num}</span>
                <div><h3 className="text-[16px] font-bold leading-snug" style={{ color: NAVY }}>{step.title}</h3><p className="mt-1 text-[14px] leading-[1.9]" style={{ color: `${NAVY}B3` }}>{step.body}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20">
          <SectionTitle>{copy.scienceTitle}</SectionTitle>
          <div className="mt-5 flex flex-col gap-4 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>
            {copy.science.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>

        <section className="mt-20">
          <SectionTitle>{copy.typesTitle}</SectionTitle>
          <p className="mt-5 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>{copy.typesIntro}</p>
          <div className="mt-6 grid grid-cols-4 gap-x-3 gap-y-5">
            {copy.gallery.map((character) => (
              <div key={character.src} className="text-center">
                <SmoothImage src={character.src} alt={character.name} width={120} height={120} className="mx-auto h-auto w-full max-w-[96px]" />
                <p className="mt-1.5 text-[10px] font-bold leading-tight md:text-[11px]" style={{ color: `${NAVY}B3` }}>{character.name}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center"><Link href={`${prefix}/types`} className="text-[14px] font-bold underline underline-offset-4" style={{ color: SORA }}>{copy.allTypes}</Link></div>
        </section>

        <section className="mt-20">
          <SectionTitle>{copy.valuesTitle}</SectionTitle>
          <ul className="mt-6 flex flex-col gap-3">
            {copy.values.map((text) => <li key={text} className="flex items-start gap-2.5 text-[14px] leading-[1.9]" style={{ color: `${NAVY}CC` }}><span aria-hidden className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: SORA }} /><span>{text}</span></li>)}
          </ul>
        </section>

        <section className="mt-20"><SectionTitle>{copy.faqTitle}</SectionTitle><div className="mt-6"><FAQAccordion items={copy.faq} /></div></section>

        <section className="mt-20">
          <SectionTitle>{copy.operatorTitle}</SectionTitle>
          <div className="mt-5 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}><p>{copy.operatorBody}</p><p className="mt-3 text-[12px]" style={{ color: `${NAVY}80` }}>— {copy.operatorName}</p></div>
        </section>

        <section className="mt-20 text-center">
          <p className="text-[18px] font-bold leading-snug md:text-[20px]" style={{ color: NAVY }}>{copy.ctaLead}</p>
          <Link href={`${prefix}/diagnosis`} className="sora-cta mt-6 inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5">{copy.cta}</Link>
        </section>
      </main>
      {isEnglish ? <EnSiteFooter /> : <TopFooter locale={locale} />}
    </div>
  );
}
