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

const types = [
  { emoji: "🎪", name: "お祭りムードメーカー", color: "#FF6B6B" },
  { emoji: "🏠", name: "みんなの実家", color: "#4ECDC4" },
  { emoji: "🌪️", name: "暴走カリスマ", color: "#FFD93D" },
  { emoji: "🛡️", name: "鉄のメンタル番長", color: "#6C5CE7" },
  { emoji: "🎨", name: "繊細クリエイター", color: "#A8E6CF" },
  { emoji: "🌿", name: "癒しの守護神", color: "#88D8B0" },
  { emoji: "🔍", name: "沼ハマり探究者", color: "#DDA0DD" },
  { emoji: "🧊", name: "冷静マイペース", color: "#74B9FF" },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col flex-1 items-center px-5 py-12">
        {/* Hero */}
        <section className="flex flex-col items-center text-center max-w-sm w-full mt-4 mb-10 animate-fade-in-up">
          <div className="inline-block rounded-md bg-label-bg px-3 py-1 text-[10px] font-bold tracking-wider text-muted mb-5 border border-card-border">
            INSTRUCTION MANUAL
          </div>

          <div className="text-5xl mb-4">📋</div>

          <h1 className="text-3xl font-extrabold leading-tight mb-2">
            ワタシのトリセツ
          </h1>

          <p className="text-base font-bold text-foreground mb-1">
            友達と作る、自分の取扱説明書
          </p>

          <p className="text-sm text-muted leading-relaxed mb-8">
            自分が思う私と、友達から見える私。
            <br />
            そのギャップが、本当のあなたを見せてくれる。
          </p>

          <Link
            href="/diagnosis"
            className="w-full max-w-xs rounded-full bg-primary px-8 py-4 text-center text-lg font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover active:scale-[0.98]"
          >
            無料で診断する（3分）
          </Link>

          <p className="text-[11px] text-muted mt-3">
            登録不要・完全無料・15問だけ
          </p>
        </section>

        {/* Types preview */}
        <section className="w-full max-w-sm mb-10 animate-fade-in-up stagger-2">
          <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-4 uppercase">
            8つのタイプ
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {types.map((t) => (
              <div
                key={t.name}
                className="flex flex-col items-center gap-1 rounded-xl border border-card-border bg-card-bg p-2.5"
              >
                <span className="text-xl">{t.emoji}</span>
                <span
                  className="text-[9px] font-bold text-center leading-tight"
                  style={{ color: t.color }}
                >
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="w-full max-w-sm mb-10 animate-fade-in-up stagger-3">
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-6 uppercase">
              How it works
            </h2>

            <ol className="flex flex-col gap-5">
              {steps.map((step, i) => (
                <li key={step.number} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl shrink-0">
                    {step.icon}
                  </div>
                  <div className="pt-0.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-primary">
                        STEP {step.number}
                      </span>
                      <span className="text-sm font-bold">{step.title}</span>
                    </div>
                    <p className="text-xs text-muted">{step.description}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="absolute ml-5 mt-11 h-4 w-px bg-card-border" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="w-full max-w-sm text-center mb-8 animate-fade-in-up stagger-4">
          <Link
            href="/diagnosis"
            className="inline-block w-full max-w-xs rounded-full bg-primary px-8 py-4 text-center text-lg font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover active:scale-[0.98]"
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
