"use client";

// Phase 1.5-α Day 10: 診断結果ページの Client インタラクション
// Phase 1.5-α Day 11.4: キャラコード重複表示の解消
//   FriendGapInvite (Day 11.3) でも同じキャラコード + コピーを表示しており、
//   このコンポーネントから「キャラコード + コピー」ブロックを撤去 (Day 10 で実装)。
//   関連する codeCopied state / handleCopyCode 関数 / fullCode prop / CopyIcon SVG も削除。
//
// 親 (/me/[token]/page.tsx) は Server Component のため、
// クリップボード操作とトースト表示が必要なボタン群をここに切り出す。
//
// 含むもの (Day 11.4 後): SNS シェア 4 ボタン (X / Instagram / LINE / リンクコピー)、
// 画像保存ボタン (プレースホルダー、機能は後フェーズ)。
//
// 触らない: shareUrl の構築は親 Server Component が担当 (env 依存のため)、
// 画像保存ロジックも未実装 (html2canvas 等を将来導入)。

import { useRef, useState } from "react";
import { ShareCard } from "./ShareCard";

interface ResultActionsProps {
  typeName: string;
  shareUrl: string;
  // SNS シェア保存画像 (ShareCard) 用
  ownerName: string;
  essence: string;
  description: string;
  imageSrc: string;
  shareCode: string;
}

export function ResultActions({
  typeName,
  shareUrl,
  ownerName,
  essence,
  description,
  imageSrc,
  shareCode,
}: ResultActionsProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

  // 確定カード (ShareCard) を 1 枚の PNG として書き出してダウンロード。
  // M PLUS Rounded は document に読み込み済み (next/font)。fonts.ready 待ち + 自動埋め込み。
  const handleSaveImage = async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    setImageNotice(null);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `watashi-torisetsu-${shareCode}.png`;
      a.click();
    } catch {
      setImageNotice("画像の保存に失敗しました");
      window.setTimeout(() => setImageNotice(null), 2400);
    } finally {
      setSaving(false);
    }
  };

  const tweetText = `私のトリセツは「${typeName}」でした！`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(shareUrl)}`;
  const lineText = `${tweetText} ${shareUrl}`;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;

  return (
    <div className="flex flex-col items-center gap-6 mb-8">
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

      {/* 画像を保存 (確定カードを PNG 書き出し) */}
      <div className="relative">
        <button
          type="button"
          onClick={handleSaveImage}
          disabled={saving}
          className="bg-white text-[#3A2D6B] font-black text-sm px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_3px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all disabled:opacity-50 disabled:cursor-wait"
        >
          {saving ? "画像を作成中…" : "画像を保存"}
        </button>
        {imageNotice && (
          <span
            role="status"
            className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#3A2D6B] text-white text-xs font-bold px-3 py-1 rounded-full"
          >
            {imageNotice}
          </span>
        )}
      </div>

      {/* オフスクリーンの確定カード (PNG 書き出し元) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-99999px",
          top: 0,
          pointerEvents: "none",
        }}
      >
        <ShareCard
          ref={cardRef}
          ownerName={ownerName}
          typeName={typeName}
          essence={essence}
          description={description}
          imageSrc={imageSrc}
          shareCode={shareCode}
        />
      </div>
    </div>
  );
}

// =========================================================================
// インライン SVG アイコン (lucide-react 未導入のため、必要最小限を自前で)
// すべて currentColor 対応、サイズは className の w-* h-* で調整
// =========================================================================

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
