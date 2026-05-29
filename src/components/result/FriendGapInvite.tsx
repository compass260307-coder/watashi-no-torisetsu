"use client";

// Phase 1.5-α Day 11.2: 友達評価依頼を QR コード + キャラコード中心に再構成
//
// Day 11 までは「友達に評価を頼む →」CTA ボタンの 1 アクション設計だったが、
// 対面 (QR スキャン) と離れた相手 (キャラコード / URL コピー) の両用途を
// カバーするため、QR メイン + キャラコード/URL コピーをサブの構成に変更。
//
// 親 (/me/[token]/page.tsx) は Server Component のため、
// QR 描画とクリップボード操作を伴うこのブロックを Client に切り出す。
//
// 触らない:
// - 招待 URL のロジック (親 Server 側で ${SITE_URL}/friend/${inviteCode} を構築、props で受領)
// - キャラコード (= fullCode、Day 10 / Day 11 のロジック維持、props で受領)
// - hasIntegrated 判定 (Day 11 維持、マイ図鑑リンクの出し分け)

import { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

interface FriendGapInviteProps {
  inviteUrl: string;
  fullCode: string;
  hasIntegrated: boolean;
}

export function FriendGapInvite({
  inviteUrl,
  fullCode,
  hasIntegrated,
}: FriendGapInviteProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!fullCode) return;
    try {
      await navigator.clipboard.writeText(fullCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1800);
    } catch {
      // クリップボード API が無い環境 — 無視
    }
  };

  const handleCopyUrl = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 1800);
    } catch {
      // 無視
    }
  };

  return (
    <section className="text-center py-6 mb-8">
      {/* 大見出し (deepPurple + sunYellow drop-shadow で立体感) */}
      <h2 className="text-[#3A2D6B] font-black text-2xl mb-3 leading-tight drop-shadow-[0_2px_0_rgba(255,233,147,0.8)]">
        ともだちに
        <br />
        評価してもらおう！
      </h2>

      {/* サブ文 (ギャップ訴求、Day 11 から継承) */}
      <p className="text-[#3A2D6B]/75 text-sm mb-6 leading-relaxed">
        「自分が思う自分」と「友達が見る自分」の
        <br />
        <span className="font-bold text-[#FE3C72]">ギャップ</span>
        が見えてきます
      </p>

      {/* QR コード (白カードで囲む、deepPurple 描画、エラー訂正 H で
          将来キャラアイコン中央挿入の余地を確保) */}
      <div className="flex justify-center mb-5">
        <div className="bg-white rounded-2xl p-4 shadow-md border-2 border-[#3A2D6B]/20">
          <QRCodeSVG
            value={inviteUrl}
            size={220}
            bgColor="#FFFFFF"
            fgColor="#3A2D6B"
            level="H"
            marginSize={0}
          />
        </div>
      </div>

      {/* QR の使い方説明 */}
      <p className="text-[#3A2D6B] font-bold text-sm mb-6 leading-relaxed">
        カメラで読み取ってもらって
        <br />
        友達にアナタを評価してもらおう
      </p>

      {/* キャラコード + コピー (LINE 等で送る用、QR の代替手段) */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-[#3A2D6B]/70 text-sm font-bold">
          キャラコード:
        </span>
        <span className="text-[#3A2D6B] font-mono font-bold text-base tracking-wider">
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
          <span role="status" className="text-[#FE3C72] text-xs font-bold">
            コピーしました
          </span>
        )}
      </div>

      {/* URL コピー (補助、小さく) */}
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleCopyUrl}
          className="text-[#3A2D6B]/60 underline text-xs font-bold hover:text-[#FE3C72] transition-colors"
        >
          or 招待 URL をコピー (LINE などで送る)
        </button>
        {urlCopied && (
          <span
            role="status"
            className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#3A2D6B] text-white text-[10px] font-bold px-2 py-1 rounded-full"
          >
            コピーしました
          </span>
        )}
      </div>

      {/* 補足 (Day 11 から継承) */}
      <p className="text-[#3A2D6B]/60 text-xs font-bold mt-4">
        友達 3 人以上の評価で、ギャップが見えるようになります
      </p>

      {/* マイ図鑑リンク (Day 11 から継承、履歴あり時のみ) */}
      {hasIntegrated && (
        <p className="mt-2">
          <Link
            href="/zukan-mine"
            className="text-[#3A2D6B]/60 text-xs font-bold underline hover:text-[#FE3C72] transition-colors"
          >
            マイ図鑑で履歴を見る
          </Link>
        </p>
      )}
    </section>
  );
}

// =========================================================================
// インライン SVG アイコン (lucide-react 未導入、Day 10 ResultActions と同じパターン)
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
