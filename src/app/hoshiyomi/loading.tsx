// /hoshiyomi はログイン状態ごとにサーバーで残り回数や会話履歴を読むため、
// 表示までに時間がかかる。loading.js が無いと、タップしてからサーバーの応答が
// 返るまで元の画面のまま「無反応」に見えるので、タップ直後に骨組みを出す。
export default function Loading() {
  return (
    <main className="min-h-dvh bg-gradient-to-br from-[#F3F0FF] via-white to-[#FFF8E8] px-5 pb-8 pt-8 md:px-8 md:pt-12">
      <div
        className="mx-auto max-w-[1040px] animate-pulse md:grid md:grid-cols-2 md:items-start md:gap-x-10 lg:gap-x-14"
        role="status"
        aria-label="読み込み中"
      >
        <div className="md:col-start-1 md:row-start-1">
          <div className="h-9 w-56 rounded-full bg-[#2E2E5C]/15 md:h-12 md:w-80" />
        </div>
        <div className="mt-6 aspect-[1638/960] w-full rounded-3xl bg-[#2E2E5C]/8 md:col-start-2 md:row-span-3 md:row-start-1 md:mt-0 md:self-center" />
        <div className="mt-6 space-y-3 md:col-start-1 md:row-start-2">
          <div className="h-4 w-11/12 rounded-full bg-[#2E2E5C]/10" />
          <div className="h-4 w-4/5 rounded-full bg-[#2E2E5C]/10" />
        </div>
        <div className="mt-6 h-28 w-full rounded-3xl bg-[#2E2E5C]/8 md:col-start-1 md:row-start-3" />
      </div>
    </main>
  );
}
