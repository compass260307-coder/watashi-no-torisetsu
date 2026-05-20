"use client";

// Phase 3-β リリース 3 C-4: 統合トリセツのシェアボタン (Client Component)
//
// LIFF 内なら liff.shareTargetPicker、それ以外なら URL クリップボードコピーで
// 共有可能。Server Component から切り出して dynamic import を使うため別ファイル化。

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

    // 1. LIFF 内なら shareTargetPicker
    try {
      const liff = (await import("@line/liff")).default;
      // LIFF init は呼び出し側で済んでない可能性 → 明示的に init を試みる
      // (失敗なら下の fallback に流れる)
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
      if (liffId) {
        try {
          await liff.init({ liffId });
        } catch {
          // already initialized 等
        }
      }
      if (liff.isInClient && liff.isInClient()) {
        await liff.shareTargetPicker([
          { type: "text", text: buildShareText() },
        ]);
        setSharing(false);
        return;
      }
    } catch {
      // LIFF 不可 → クリップボード fallback
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
