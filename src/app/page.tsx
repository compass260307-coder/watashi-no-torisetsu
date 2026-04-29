import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "15問に答える",
    description: "直感でサクサク、たった3分",
    icon: "📝",
  },
  {
    number: "02",
    title: "仮トリセツが届く",
    description: "自分だけの取扱説明書が完成",
    icon: "📋",
  },
  {
    number: "03",
    title: "友達に聞いてみる",
    description: "3人の回答で、本当のトリセツに",
    icon: "💬",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col flex-1 items-center px-5 py-12">
        {/* Hero */}
        <section className="flex flex-col items-center text-center max-w-sm w-full mt-8 mb-12">
          <div className="inline-block rounded-md bg-label-bg px-3 py-1 text-xs font-bold tracking-wider text-muted mb-6 border border-card-border">
            INSTRUCTION MANUAL
          </div>

          <h1 className="text-3xl font-extrabold leading-tight mb-3">
            ワタシのトリセツ
          </h1>

          <p className="text-base text-muted leading-relaxed mb-2">
            友達と作る、ワタシのトリセツ
          </p>

          <p className="text-sm text-muted leading-relaxed mb-10">
            自分が思う私と、友達から見える私。
            <br />
            そのギャップが、本当のあなたを見せてくれる。
          </p>

          <Link
            href="/diagnosis"
            className="w-full max-w-xs rounded-full bg-primary px-8 py-4 text-center text-lg font-bold text-white shadow-md transition-colors hover:bg-primary-hover active:scale-[0.98]"
          >
            無料で診断する（3分）
          </Link>
        </section>

        {/* Steps */}
        <section className="w-full max-w-sm mb-12">
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-6 uppercase">
              How it works
            </h2>

            <ol className="flex flex-col gap-6">
              {steps.map((step) => (
                <li key={step.number} className="flex items-start gap-4">
                  <span className="text-2xl mt-0.5">{step.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary">
                        STEP {step.number}
                      </span>
                      <span className="text-sm font-bold">{step.title}</span>
                    </div>
                    <p className="text-xs text-muted">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="w-full max-w-sm text-center mb-8">
          <p className="text-xs text-muted mb-4">
            登録不要・完全無料・3分で完了
          </p>
          <Link
            href="/diagnosis"
            className="inline-block w-full max-w-xs rounded-full bg-primary px-8 py-4 text-center text-lg font-bold text-white shadow-md transition-colors hover:bg-primary-hover active:scale-[0.98]"
          >
            さっそく始める
          </Link>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-muted">
        ワタシのトリセツ
      </footer>
    </div>
  );
}
