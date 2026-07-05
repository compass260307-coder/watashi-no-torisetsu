"use client";

// キャラシェア（拡散＝自分の称号キャラを見せて新規診断を呼ぶ）。/me 結果ページ右上に横並び配置。
//   - 共有先: /share/{invite_code}（per-owner キャラOGが出る獲得ランディング）。
//   - KPI: タップで share_clicked { channel, kind:"character", source:"result" }。
//   - 評価依頼(/friend)・拡散トップ(brag)とは別 kind で測り分け。

import { useState } from "react";
import { track } from "@/lib/track";

const NAVY = "#2A3A5C";

interface CharacterShareButtonProps {
  /** 共有先 = 絶対URL /share/{invite_code} */
  shareUrl: string;
  /** 称号 (シェア文言に使用) */
  essence: string;
}

export function CharacterShareButton({
  shareUrl,
  essence,
}: CharacterShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const text = `私は「${essence}」でした🐧\nあなたは何タイプ？30秒で診断できるよ👇`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text,
  )}&url=${encodeURIComponent(shareUrl)}`;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${text}\n${shareUrl}`,
  )}`;

  const fire = (channel: "x" | "line" | "copy") =>
    track("share_clicked", {
      metadata: { channel, kind: "character", source: "result" },
    });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      fire("copy");
    } catch {
      // 無視
    }
  };

  // アイコンは縮まない (shrink-0)。行全体は親幅を超えない (max-w-full)。
  const btn =
    "w-8 h-8 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform";

  return (
    <div className="flex items-center gap-1.5 max-w-full rounded-full bg-white/85 backdrop-blur px-2.5 py-1.5 shadow-sm">
      <span className="text-[10px] font-black leading-none shrink" style={{ color: NAVY }}>
        キャラを
        <br />
        シェア
      </span>
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => fire("x")}
        aria-label="X でシェア"
        className={`${btn} bg-black`}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white" aria-hidden="true">
          <path d="M18.244 2H21.5l-7.5 8.59L23 22h-6.844l-5.357-7.012L4.66 22H1.4l8.04-9.196L1 2h6.998l4.84 6.4Zm-1.2 18h1.846L7.04 4H5.09l11.954 16Z" />
        </svg>
      </a>
      <a
        href={lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => fire("line")}
        aria-label="LINE でシェア"
        className={`${btn} bg-[#06C755]`}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
          <path d="M12 3C6.477 3 2 6.69 2 11.246c0 4.082 3.547 7.503 8.34 8.146.325.07.767.215.879.494.1.252.066.647.032.901l-.142.852c-.043.252-.2.985.864.537 1.064-.448 5.735-3.376 7.823-5.78C20.98 14.94 22 13.21 22 11.246 22 6.69 17.523 3 12 3Z" />
        </svg>
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="リンクをコピー"
        className={`${btn} border-2`}
        style={{ borderColor: NAVY, color: NAVY }}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5L20 6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </button>
    </div>
  );
}
