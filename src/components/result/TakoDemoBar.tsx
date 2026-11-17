"use client";

// 友達診断の「見本」ページ (/tako/preview?...&demo=1) の下部に固定するバー。
// 招待カードの「友達から見たあなた」リンクから来た人に、これは見本であることを伝え、
// 自分の友達診断ページ (招待カード) へ戻す。下部ナビの上に重ねて表示する。

export function TakoDemoBar() {
  const goBack = () => {
    // 招待カードから来た場合は元のページへ戻る。見本URLを直接開いた場合は
    // 友達診断の入口 (/tako) へ送る。
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/tako";
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#E3E4F0] bg-white shadow-[0_-8px_24px_rgba(46,46,92,0.10)] print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-[640px] items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 text-[14px] font-black leading-[1.4] text-[#2E2E5C]">
          この結果は見本です
        </p>
        <button
          type="button"
          onClick={goBack}
          className="shrink-0 rounded-full bg-[#5B5BEF] px-5 py-3 text-[14px] font-black text-white outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/45"
        >
          友達に送る
        </button>
      </div>
    </div>
  );
}
