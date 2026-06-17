// ④ かんたん3ステップ (新設・装飾控えめ)。本人視点は「ワタシ」表記。
const STEPS: { no: number; text: string }[] = [
  { no: 1, text: "ワタシを診断する（50問）" },
  { no: 2, text: "友達に答えてもらう" },
  { no: 3, text: "ホントのワタシが分かる" },
];

export function ThreeSteps() {
  return (
    <section className="my-12">
      <h2 className="text-center text-[#3A2D6B] font-black text-xl mb-5">
        かんたん3ステップ
      </h2>
      <div className="flex flex-col gap-3">
        {STEPS.map((s) => (
          <div
            key={s.no}
            className="flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-3"
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0094D8] text-white font-black flex items-center justify-center">
              {s.no}
            </span>
            <span className="text-[#3A2D6B] font-bold text-sm">{s.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
