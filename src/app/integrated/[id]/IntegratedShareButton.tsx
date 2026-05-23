"use client";

// プレミアム化 v3 Day 3: 統合トリセツのシェアボタン (Web ファースト版)
//
// Web Share API (navigator.share) を最優先、未対応ブラウザはクリップボードコピー。
// LIFF shareTargetPicker は撤去 (Phase 2 で復活想定)。

import { useState } from "react";

interface Props {
  shareUrl: string;
  title: string;
}

export function IntegratedShareButton({ shareUrl, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const buildShareText = () => {
    return [
      title,
      "",
      "ワタシのトリセツ — 複数の眼で生成した「真のトリセツ」",
      "",
      shareUrl,
    ].join("\n");
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    setCopied(false);

    // 1. Web Share API (iOS/Android 標準、ほぼ全モバイルブラウザ対応)
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          title,
          text: buildShareText(),
          url: shareUrl,
        });
        setSharing(false);
        return;
      }
    } catch {
      // ユーザーキャンセル or 共有失敗 → クリップボード fallback
    }

    // 2. クリップボード fallback
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("シェア URL: " + shareUrl);
    } finally {
      setSharing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing}
      className="w-full rounded-full bg-primary-gradient text-white text-center px-6 py-4 text-base font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-70"
    >
      {sharing
        ? "シェア中..."
        : copied
          ? "URL をコピーしました"
          : "シェアする"}
    </button>
  );
}
