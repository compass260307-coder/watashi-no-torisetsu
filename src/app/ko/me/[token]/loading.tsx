// 動的ルート /ko/me/[token] の即時ローディング境界 (ja 版 /me/[token]/loading.tsx と同一)。
// これが無いと <Link> はこのルートを prefetch できず (動的ページ)、タップ時に
// サーバー往復が終わるまで前の画面のまま「無反応」に見える。loading.js を置くと
// タップ即座にこのスケルトンが出て、本体は裏でストリーム描画される。
export default function Loading() {
  return (
    <main
      className="min-h-dvh flex flex-col items-center pt-16 px-6"
      style={{ background: "#FFFDF4" }}
    >
      <div className="w-full max-w-[480px] flex flex-col items-center animate-pulse">
        <div className="h-40 w-40 rounded-3xl bg-[#2A3A5C]/10" />
        <div className="mt-5 h-5 w-40 rounded-full bg-[#2A3A5C]/12" />
        <div className="mt-3 h-4 w-56 rounded-full bg-[#2A3A5C]/10" />
        <div className="mt-10 w-full space-y-3">
          <div className="h-4 w-11/12 rounded-full bg-[#2A3A5C]/8" />
          <div className="h-4 w-4/5 rounded-full bg-[#2A3A5C]/8" />
          <div className="h-4 w-10/12 rounded-full bg-[#2A3A5C]/8" />
        </div>
      </div>
    </main>
  );
}
