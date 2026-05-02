import Link from "next/link";

const types = [
  { emoji: "🎪", name: "お祭りムードメーカー", color: "#FF4081" },
  { emoji: "🏠", name: "みんなの実家", color: "#2EC4B6" },
  { emoji: "🌪️", name: "暴走カリスマ", color: "#FFB800" },
  { emoji: "🛡️", name: "鉄のメンタル番長", color: "#6C5CE7" },
  { emoji: "🎨", name: "繊細クリエイター", color: "#00D4AA" },
  { emoji: "🌿", name: "癒しの守護神", color: "#00B894" },
  { emoji: "🔍", name: "沼ハマり探究者", color: "#C44569" },
  { emoji: "🧊", name: "冷静マイペース", color: "#1E90FF" },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col flex-1 items-center px-5 py-12">
        {/* Hero */}
        <section className="flex flex-col items-center text-center max-w-sm w-full mt-4 mb-10 animate-fade-in-up">
          <div className="text-5xl mb-4">📋</div>

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
          <div className="rounded-2xl border border-card-border bg-card-bg p-6">
            <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-5 uppercase">
              かんたん3ステップ
            </h2>

            <ol className="flex flex-col gap-4">
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl shrink-0">
                  📝
                </div>
                <div>
                  <span className="text-sm font-bold">15問に答える</span>
                  <span className="text-xs text-muted ml-2">直感でOK・3分</span>
                </div>
              </li>
              <li className="flex items-center gap-4 pl-5">
                <div className="w-px h-4 bg-card-border shrink-0" />
              </li>
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl shrink-0">
                  📋
                </div>
                <div>
                  <span className="text-sm font-bold">仮トリセツが届く</span>
                  <span className="text-xs text-muted ml-2">自分だけの取説</span>
                </div>
              </li>
              <li className="flex items-center gap-4 pl-5">
                <div className="w-px h-4 bg-card-border shrink-0" />
              </li>
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl shrink-0">
                  💬
                </div>
                <div>
                  <span className="text-sm font-bold">友達に聞いてみる</span>
                  <span className="text-xs text-muted ml-2">3人で完成</span>
                </div>
              </li>
            </ol>
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
