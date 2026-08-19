"use client";

// 本文中に置く「シェア」ピルボタン (16P のグラフ下シェアボタン参考・2026-07-28)。
// 押すと MeStickyHeader のシェアモーダルを開く (SHARE_OPEN_EVENT 経由)。
// モーダル本体・文言・計測は MeStickyHeader に集約したまま、開く場所だけ増やす。
// MeStickyHeader (shareUrl あり) が同一ページに無いと何も起きないため、
// 設置側で出し分けること (獲得ランディング等では出さない)。

// シェアモーダルを開く要求イベント。detail.source は share_clicked の
// metadata.source になる (どの設置場所から開いたかの計測)。
export const SHARE_OPEN_EVENT = "torisetsu:open-share";

export function ShareModalOpenButton({
  source = "bigfive_graph",
  label = "シェア",
  iconOnly = false,
}: {
  /** 計測用の設置場所ID (share_clicked の metadata.source)。 */
  source?: string;
  label?: string;
  /** true でラベルを出さず丸アイコンボタンにする (SP のヘッダー等・省スペース)。 */
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={iconOnly ? label : undefined}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(SHARE_OPEN_EVENT, { detail: { source } }),
        )
      }
      className={
        iconOnly
          ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3E6F5] bg-white text-[#2E2E5C] shadow-[0_1px_4px_rgba(46,46,92,0.08)] transition-colors hover:bg-[#F4F4FE]"
          : "inline-flex items-center gap-2 rounded-full border border-[#E3E6F5] bg-white px-6 py-3 text-[14px] font-black text-[#2E2E5C] shadow-[0_1px_4px_rgba(46,46,92,0.08)] transition-colors hover:bg-[#F4F4FE]"
      }
    >
      {/* iOS 風シェアグリフ (MeStickyHeader と同じ) */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 15V3" />
        <path d="m8 7 4-4 4 4" />
        <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
      </svg>
      {!iconOnly && label}
    </button>
  );
}
