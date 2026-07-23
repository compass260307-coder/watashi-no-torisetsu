"use client";

// ジョハリの窓の「?」ヘルプ (2026-07-24 追加)。
// 窓名の隣の灰色 ? をタップ/クリックすると説明の吹き出しを表示する。
// モバイル前提なので hover ではなく click トグル + フォーカスアウトで閉じる。

import { useState } from "react";

export function JohariHelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="この窓の説明"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full bg-[#C4C7D8] text-[10px] font-black leading-none text-white transition-colors hover:bg-[#A9ADC4] md:h-5 md:w-5 md:text-[12px]"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-[210px] -translate-x-1/2 rounded-xl border border-[#E3E6F5] bg-white px-3.5 py-3 text-left text-[11px] font-bold leading-[1.7] text-[#3A3A55] shadow-[0_8px_24px_rgba(46,46,92,0.18)] md:w-[250px] md:text-[12px]"
        >
          {text}
        </span>
      )}
    </span>
  );
}
