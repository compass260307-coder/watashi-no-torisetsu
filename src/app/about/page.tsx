import type { Metadata } from "next";
import Image from "next/image";

const DEVELOPER_NAME =
  process.env.NEXT_PUBLIC_DEVELOPER_NAME ?? "ワタシのトリセツ運営";

export const metadata: Metadata = {
  title: "このBotについて",
  description:
    "ワタシのトリセツの公式 LINE アカウントについて。あなたの自己診断と、友達からの他己評価を集める「ホーム」です。",
  openGraph: {
    title: "このBotについて｜ワタシのトリセツ",
    description:
      "ワタシのトリセツの公式 LINE アカウントについて。診断のホーム、プライバシー、これから来る機能。",
    images: [{ url: "/ogp-v3.png", width: 1200, height: 630 }],
  },
};

const lineFeatures = [
  { icon: "🐧", text: "自分のトリセツをいつでも見返せる" },
  { icon: "✉️", text: "他己評価を新しい友達に依頼できる" },
  { icon: "🔔", text: "完成や進捗の通知が届く" },
  {
    icon: "📖",
    text: "（準備中）シーン別の解釈、タイプ図鑑、足跡記録",
  },
];

const privacyItems = [
  {
    bold: "完全匿名",
    rest: "。誰がどう答えたかは表示されません",
    prefix: "友達からの他己評価は",
  },
  {
    bold: null,
    rest: "知らない人と繋がることはありません。診断や招待は自分が主導",
    prefix: "",
  },
  {
    bold: "広告は配信しません",
    rest: "",
    prefix: "",
  },
  {
    bold: null,
    rest: "データは自己理解の精度向上以外に使いません",
    prefix: "",
  },
];

const upcomingFeatures = [
  {
    title: "シーン別ページ",
    description: "面接 / グループワーク / 初対面など、状況別の「あなた」",
  },
  {
    title: "私の足跡",
    description: "これまで他己評価してくれた友達の記録",
  },
  {
    title: "タイプ図鑑",
    description: "8タイプの解説 + あなたの周りの分布",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col flex-1 items-center px-5 py-10 max-w-xl mx-auto w-full">
        {/* 1. Hero */}
        <section className="flex flex-col items-center text-center w-full mb-12 animate-fade-in-up">
          <Image
            src="/mascot/step3-complete.png"
            alt="ワタシのトリセツのマスコット"
            width={224}
            height={224}
            priority
            className="w-48 h-48 sm:w-56 sm:h-56 object-contain mb-2"
          />
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
            ワタシのトリセツへようこそ🐧
          </h1>
          <p className="text-sm sm:text-base font-bold text-foreground">
            友達と作る、自分の取扱説明書
          </p>
        </section>

        {/* 2. このアカウントについて */}
        <section className="w-full mb-10 animate-fade-in-up stagger-2">
          <h2 className="text-base font-bold mb-3">このアカウントについて</h2>
          <div className="rounded-2xl bg-label-bg p-5 text-sm leading-relaxed space-y-3">
            <p>ワタシのトリセツの公式 LINE です。</p>
            <p>
              あなたの自己診断の結果と、
              <br />
              友達からの他己評価を集める「ホーム」になります。
            </p>
            <p>何度でも戻ってきて、自分のトリセツを開いてください。</p>
          </div>
        </section>

        {/* 3. LINE でできること */}
        <section className="w-full mb-10 animate-fade-in-up stagger-2">
          <h2 className="text-base font-bold mb-3">LINE でできること</h2>
          <ul className="flex flex-col gap-2.5">
            {lineFeatures.map((item) => (
              <li
                key={item.text}
                className="flex items-start gap-3 rounded-xl bg-card-bg border border-card-border px-4 py-3"
              >
                <span className="text-lg leading-snug shrink-0">
                  {item.icon}
                </span>
                <span className="text-sm leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 4. プライバシーについて */}
        <section className="w-full mb-10 animate-fade-in-up stagger-3">
          <h2 className="text-base font-bold mb-3">プライバシーについて</h2>
          <ul className="rounded-2xl border-2 border-pink-200 bg-pink-50/40 p-5 flex flex-col gap-3">
            {privacyItems.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm leading-relaxed"
              >
                <span
                  aria-hidden
                  className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0"
                />
                <span>
                  {item.prefix}
                  {item.bold && (
                    <span className="font-bold text-pink-700">
                      {item.bold}
                    </span>
                  )}
                  {item.rest}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. 開発しているのは */}
        <section className="w-full mb-10 animate-fade-in-up stagger-3">
          <h2 className="text-base font-bold mb-3">開発しているのは</h2>
          <div className="rounded-2xl bg-label-bg p-5 text-sm leading-relaxed space-y-3">
            <p>
              九州の大学生に向けて作っています。Big Five 心理学を土台に、
              「自分の知らない自分」を見つけられるサービスを目指してます。
            </p>
            <p className="text-xs text-muted">— {DEVELOPER_NAME}</p>
          </div>
        </section>

        {/* 6. これから来る機能 */}
        <section className="w-full mb-10 animate-fade-in-up stagger-4">
          <h2 className="text-base font-bold mb-3">これから来る機能</h2>
          <div className="flex flex-col gap-3">
            {upcomingFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-card-bg border border-card-border p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="text-sm font-bold leading-snug">
                    {feature.title}
                  </h3>
                  <span className="shrink-0 inline-block rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-[11px] font-bold px-3 py-1">
                    準備中
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 7. 困った時は */}
        <section className="w-full mb-8 animate-fade-in-up stagger-4">
          <h2 className="text-base font-bold mb-3">困った時は</h2>
          <div className="rounded-2xl bg-label-bg p-5 text-sm leading-relaxed space-y-2">
            <p>このアカウントにメッセージを送ってください。</p>
            <p>開発チームが確認します🐧</p>
          </div>
        </section>
      </main>

      <footer className="py-6 text-center">
        <p className="text-[10px] text-muted/60">ワタシのトリセツ</p>
      </footer>
    </div>
  );
}
