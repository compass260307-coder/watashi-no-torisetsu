// feat/top-page: 実績バー (16Personalities 風)。ヒーロー画像の下・白背景に、
// 色つきの大きい数字 + グレーの説明を、端から端まで均等な 4 分割で表示する。
// ⚠️ 数字はすべて仮値。後で Supabase の実数に差し替える
//   (本日の診断回数 / 累計診断した人 / 友達評価人数 / 正確性の評価)。

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

export default function TopStats({ diagnosedCount }: { diagnosedCount: number }) {
  // 数字ごとに異なるアクセント色 (16P 風。felt 世界観に合わせたパステル寄り)。
  const stats = [
    { num: "3000+", label: "本日の診断回数", color: "#5B5BEF" },
    {
      num: `${(diagnosedCount / 10000).toLocaleString("ja-JP")}万+`,
      label: "診断した人",
      color: "#E86AA6",
    },
    { num: "7,200+", label: "友達のことを診断した人数", color: "#3FAE8C" },
    { num: "89%", label: "正確性の評価", color: "#E0A544" },
  ];

  return (
    <section
      className="w-full bg-white px-8 py-16 md:py-20"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* SEO/a11y: セクション見出し (視覚上は非表示、アウトライン構造のみ提供) */}
      <h2 className="sr-only">診断実績</h2>
      {/* 端から端まで均等な 4 分割 (SP は 2×2)。max-width は付けず全幅で振り分ける。 */}
      <div className="mx-auto grid max-w-[1680px] grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div
              className="font-bold"
              style={{
                color: s.color,
                fontSize: "clamp(40px, 4.2vw, 68px)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              {s.num}
            </div>
            <div className="mt-3 text-[17px] leading-snug text-[#8A8AA3]">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
