// 動的ルート /tako/[token] の即時ローディング境界。
// loading.js が無いと <Link> はこの動的ページを prefetch できず、タップ時に
// サーバー往復まで「無反応」に見える。これでタップ即スケルトン表示になる。
export default function Loading() {
  return (
    <main
      className="min-h-dvh px-4 pb-8 md:px-8"
      style={{ background: "#E4E0F5" }}
    >
      <div className="mx-auto max-w-[560px] pt-6 animate-pulse">
        <div className="h-4 w-40 rounded-full bg-[#2A3A5C]/12" />
        <div className="mt-4 h-7 w-64 rounded-full bg-[#2A3A5C]/15" />
        <div className="mt-2 h-4 w-48 rounded-full bg-[#2A3A5C]/10" />
        <div className="mx-auto mt-8 h-40 w-40 rounded-3xl bg-[#2A3A5C]/12" />
        <div className="mt-8 space-y-3">
          <div className="h-4 w-11/12 rounded-full bg-[#2A3A5C]/8" />
          <div className="h-4 w-4/5 rounded-full bg-[#2A3A5C]/8" />
          <div className="h-4 w-10/12 rounded-full bg-[#2A3A5C]/8" />
        </div>
      </div>
    </main>
  );
}
