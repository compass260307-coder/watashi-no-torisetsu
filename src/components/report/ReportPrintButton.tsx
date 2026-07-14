"use client";

// 詳細レポートの「PDFとして保存」ボタン。
// ブラウザの印刷ダイアログを開くだけ (iOS Safari / Chrome とも PDF 保存が選べる)。
export function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-[#2A2520] px-6 py-2.5 text-sm font-semibold text-[#2A2520]"
    >
      PDFとして保存する
    </button>
  );
}
