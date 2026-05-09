import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { StepCard } from "@/components/StepCard";
import { TypeCarousel } from "@/components/TypeCarousel";

const BASE_URL = "https://www.watashi-torisetsu.com";

export const metadata: Metadata = {
  alternates: { canonical: BASE_URL },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ワタシのトリセツ",
  description:
    "友達と作る、自分の取扱説明書。Big Five理論ベースの性格診断で、自分でも気づかない一面を発見できる大学生向けサービス。",
  url: BASE_URL,
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
  },
  inLanguage: "ja-JP",
  audience: {
    "@type": "Audience",
    audienceType: "大学生",
  },
};

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="flex flex-col flex-1 items-center px-5 py-12">
        {/* Hero */}
        <section className="flex flex-col items-center text-center max-w-sm w-full mt-4 mb-10 animate-fade-in-up">
          <Image
            src="/types/penguin-base.png"
            alt="ワタシのトリセツのマスコット"
            width={224}
            height={224}
            priority
            className="w-48 h-48 sm:w-56 sm:h-56 object-contain mb-1"
          />

          <h1 className="text-3xl font-extrabold leading-tight mb-2">
            ワタシのトリセツ
          </h1>

          <p className="text-base font-bold text-foreground mb-1">
            友達と作る、自分の取扱説明書
          </p>

          <p className="text-sm text-muted leading-relaxed mb-8">
            15問答えて、友達にも聞いてみる。
            <br />
            それだけで、自分の知らない自分が見えてくる。
          </p>

          <Link
            href="/diagnosis"
            className="w-full max-w-xs rounded-full bg-primary-gradient px-8 py-4 text-center text-lg font-bold text-white shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
          >
            無料で診断する（3分）
          </Link>

          <p className="text-[11px] text-muted mt-3">
            登録不要・完全無料・15問だけ
          </p>
        </section>

        {/* Types preview (carousel) */}
        <section className="w-full max-w-2xl mb-10 animate-fade-in-up stagger-2">
          <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-4 uppercase">
            8つのタイプ
          </h2>
          <TypeCarousel />
        </section>

        {/* Steps */}
        <section className="w-full max-w-4xl mb-10 animate-fade-in-up stagger-3">
          <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-5 uppercase">
            かんたん3ステップ
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <StepCard
              stepNumber={1}
              imageSrc="/mascot/step1-receive.png"
              title={
                <>
                  15問に答えて
                  <br />
                  仮トリセツが届く
                </>
              }
              subtitle="直感でOK・3分でできる"
            />
            <StepCard
              stepNumber={2}
              imageSrc="/mascot/step2-ask-friend.png"
              title="友達に診断してもらう"
              subtitle="友達は10問・2分で完了"
            />
            <StepCard
              stepNumber={3}
              imageSrc="/mascot/step3-complete.png"
              title="トリセツが完成"
              subtitle="友達3人で詳細レポート解放"
            />
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="w-full max-w-sm text-center mb-8 animate-fade-in-up stagger-4">
          <Link
            href="/diagnosis"
            className="inline-block w-full max-w-xs rounded-full bg-primary-gradient px-8 py-4 text-center text-lg font-bold text-white shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
          >
            さっそく始める
          </Link>
        </section>
      </main>

      <footer className="py-6 text-center">
        <p className="text-[10px] text-muted/60">
          ワタシのトリセツ
        </p>
      </footer>
    </div>
  );
}
