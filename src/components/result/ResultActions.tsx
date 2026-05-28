"use client";

// Phase 1.5-α Day 10: 診断結果ページの Client インタラクション
//
// 親 (/me/[token]/page.tsx) は Server Component のため、
// クリップボード操作とトースト表示が必要なボタン群をここに切り出す。
//
// 含むもの: キャラコード + コピー、SNS シェア 4 ボタン (X / Instagram / LINE / リンクコピー)、
// 画像保存ボタン (プレースホルダー、機能は後フェーズ)。
//
// 触らない: shareUrl の構築は親 Server Component が担当 (env 依存のため)、
// 画像保存ロジックも未実装 (html2canvas 等を将来導入)。

import { useState } from "react";

interface ResultActionsProps {
  fullCode: string;
  typeName: string;
  shareUrl: string;
}

export function ResultActions({
  fullCode,
  typeName,
  shareUrl,
}: ResultActionsProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [imageNotice, setImageNotice] = useState(false);

  const handleCopyCode = async () => {
    if (!fullCode) return;
    try {
      await navigator.clipboard.writeText(fullCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1800);
    } catch {
      // クリップボード API が無い環境 (古いブラウザ等) — 無視
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      // 無視
    }
  };

  const handleSaveImage = () => {
    setImageNotice(true);
    window.setTimeout(() => setImageNotice(false), 2400);
  };

  const tweetText = `私のトリセツは「${typeName}」でした！`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(shareUrl)}`;
  const lineText = `${tweetText} ${shareUrl}`;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;

  return (
    <div className="flex flex-col items-center gap-6 mb-8">
      {/* キャラコード + コピー */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-[#3A2D6B]/70 text-sm font-bold">
          キャラコード:
        </span>
        <span className="text-[#3A2D6B] font-mono font-bold text-sm tracking-wider">
          {fullCode || "------"}
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          aria-label="キャラコードをコピー"
          className="text-[#3A2D6B]/60 hover:text-[#FE3C72] transition-colors p-1"
        >
          <CopyIcon className="w-4 h-4" />
        </button>
        {codeCopied && (
          <span
            role="status"
            className="text-[#FE3C72] text-xs font-bold"
          >
            コピーしました
          </span>
        )}
      </div>

      {/* SNS シェアボタン 4 つ */}
      <div className="flex justify-center gap-3">
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full bg-black flex items-center justify-center hover:scale-110 transition-transform"
          aria-label="X でシェア"
        >
          <XIcon className="w-5 h-5 text-white" />
        </a>
        <button
          type="button"
          onClick={handleSaveImage}
          className="w-12 h-12 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
          style={{
            background:
              "linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)",
          }}
          aria-label="Instagram でシェア (画像を保存してストーリーへ)"
        >
          <InstagramIcon className="w-5 h-5 text-white" />
        </button>
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full bg-[#06C755] flex items-center justify-center hover:scale-110 transition-transform"
          aria-label="LINE でシェア"
        >
          <LineIcon className="w-5 h-5 text-white" />
        </a>
        <button
          type="button"
          onClick={handleCopyLink}
          aria-label="リンクをコピー"
          className="w-12 h-12 rounded-full bg-[#FFE993] border-2 border-[#3A2D6B] flex items-center justify-center hover:scale-110 transition-transform relative"
        >
          <LinkIcon className="w-5 h-5 text-[#3A2D6B]" />
          {linkCopied && (
            <span
              role="status"
              className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#3A2D6B] text-white text-[10px] font-bold px-2 py-1 rounded-full"
            >
              コピーしました
            </span>
          )}
        </button>
      </div>

      {/* 画像を保存 (プレースホルダー、機能は後フェーズ) */}
      <div className="relative">
        <button
          type="button"
          onClick={handleSaveImage}
          className="bg-white text-[#3A2D6B] font-black text-sm px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_3px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
        >
          画像を保存
        </button>
        {imageNotice && (
          <span
            role="status"
            className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#3A2D6B] text-white text-xs font-bold px-3 py-1 rounded-full"
          >
            画像保存は準備中です
          </span>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// インライン SVG アイコン (lucide-react 未導入のため、必要最小限を自前で)
// すべて currentColor 対応、サイズは className の w-* h-* で調整
// =========================================================================

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  // X (旧 Twitter) ロゴ。シンプルな X 字
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2H21.5l-7.5 8.59L23 22h-6.844l-5.357-7.012L4.66 22H1.4l8.04-9.196L1 2h6.998l4.84 6.4Zm-1.2 18h1.846L7.04 4H5.09l11.954 16Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  );
}

function LineIcon({ className }: { className?: string }) {
  // LINE 風: 角丸吹き出し + LINE 文字
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3C6.477 3 2 6.69 2 11.246c0 4.082 3.547 7.503 8.34 8.146.325.07.767.215.879.494.1.252.066.647.032.901l-.142.852c-.043.252-.2.985.864.537 1.064-.448 5.735-3.376 7.823-5.78C20.98 14.94 22 13.21 22 11.246 22 6.69 17.523 3 12 3Z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
