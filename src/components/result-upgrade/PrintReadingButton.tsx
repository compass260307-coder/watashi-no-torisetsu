"use client";

export function PrintReadingButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center rounded-full bg-[#2E2E5C] px-7 py-3 text-[14px] font-black text-white shadow-[0_4px_0_#17172F] transition active:translate-y-1 active:shadow-none"
    >
      PDFとして保存・印刷
    </button>
  );
}
