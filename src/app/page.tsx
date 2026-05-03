import Link from "next/link";
import Image from "next/image";

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
        <section className="w-full max-w-4xl mb-10 animate-fade-in-up stagger-3">
          <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-5 uppercase">
            かんたん3ステップ
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="flex flex-col items-center rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm">
              <span className="inline-block rounded-full bg-primary-gradient px-3 py-1 text-[11px] font-bold text-white tracking-wider mb-4">
                STEP 1
              </span>
              <div className="w-48 h-48 mb-4">
                <Image
                  src="/mascot/step1-receive.png"
                  alt=""
                  width={192}
                  height={192}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-base font-bold text-center leading-snug mb-2">
                15問に答えて
                <br />
                仮トリセツが届く
              </h3>
              <p className="text-xs text-muted text-center">
                直感でOK・3分でできる
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm">
              <span className="inline-block rounded-full bg-primary-gradient px-3 py-1 text-[11px] font-bold text-white tracking-wider mb-4">
                STEP 2
              </span>
              <div className="w-48 h-48 mb-4">
                <Image
                  src="/mascot/step2-ask-friend.png"
                  alt=""
                  width={192}
                  height={192}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-base font-bold text-center leading-snug mb-2">
                友達に診断してもらう
              </h3>
              <p className="text-xs text-muted text-center">
                友達は10問・2分で完了
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm">
              <span className="inline-block rounded-full bg-primary-gradient px-3 py-1 text-[11px] font-bold text-white tracking-wider mb-4">
                STEP 3
              </span>
              <div className="w-48 h-48 mb-4">
                <Image
                  src="/mascot/step3-complete.png"
                  alt=""
                  width={192}
                  height={192}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-base font-bold text-center leading-snug mb-2">
                トリセツが完成
              </h3>
              <p className="text-xs text-muted text-center">
                友達3人で深掘りレポート解放
              </p>
            </div>
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
