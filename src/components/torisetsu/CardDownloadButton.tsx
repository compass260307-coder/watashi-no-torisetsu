"use client";

import { useState } from "react";

interface CardDownloadButtonProps {
  fullCode: string;
  label?: string;
  className?: string;
}

export function CardDownloadButton({
  fullCode,
  label = "カードを保存",
  className = "",
}: CardDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setErrored(false);
    try {
      const res = await fetch(`/cards/${fullCode}.jpg`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watashi-torisetsu-${fullCode}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Card download failed:", err);
      setErrored(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      aria-label={`${fullCode} のカードをダウンロード`}
      className={`rounded-full border-2 border-primary text-primary font-bold px-6 py-3 transition-all active:scale-[0.98] ${
        downloading
          ? "opacity-60 cursor-wait"
          : "hover:bg-label-bg"
      } ${className}`.trim()}
    >
      {downloading
        ? "📥 ダウンロード中..."
        : errored
          ? "❌ 失敗。もう一度"
          : `📥 ${label}`}
    </button>
  );
}
