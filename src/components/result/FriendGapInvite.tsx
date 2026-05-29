"use client";

// Phase 1.5-α Day 11.2: 友達評価依頼を QR コード + キャラコード中心に再構成
// Phase 1.5-α Day 11.3: 4 要素にシンプル化 (見出し画像 / QR / 説明 / キャラコード)
//                       Koi キャラ参考と同じ密度感に。
//
// 削除した要素 (Day 11.3):
// - サブ文 (「自分が思う自分」と「友達が見る自分」のギャップ訴求)
//   → 「ギャップ」訴求は 7 章レポートの読後感に任せる、ここはアクションに集中
// - URL コピーリンク (or 招待 URL をコピー)
//   → QR + キャラコードの 2 系統で十分、3 つ目はノイズ
// - 補足 (友達 3 人以上の評価で…)
//   → 友達評価ページ側で表示するか、軸2 (Day 12) で扱う
// - マイ図鑑リンク (hasIntegrated 時)
//   → 履歴へのナビは page.tsx 側の integrated 履歴セクションから辿れるため重複削除
//
// 残った要素 (Day 11.3 最終形、4 つだけ):
// 1. 大見出し画像 /heading-friend-invite.png (ChatGPT 生成、Koi 風バブル文字)
// 2. QR コード (qrcode.react、size=220、deepPurple 描画、白カードで囲む)
// 3. 説明文「カメラで読み取ってもらって 友達にアナタを評価してもらおう」
// 4. キャラコード + コピーアイコン (LINE 等代替手段)
//
// 触らない:
// - QR コードの value (招待 URL) / size / color / level の設定 (Day 11.2 維持)
// - 招待 URL の生成ロジック (親 Server 側で構築、props で受領)
// - キャラコード (= fullCode、Day 10 / Day 11 のロジック維持、props で受領)

import { useState } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";

interface FriendGapInviteProps {
  inviteUrl: string;
  fullCode: string;
}

export function FriendGapInvite({
  inviteUrl,
  fullCode,
}: FriendGapInviteProps) {
  const [codeCopied, setCodeCopied] = useState(false);

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

  return (
    <section className="text-center py-8 mb-8">
      {/* 1. 大見出し画像 (ChatGPT 生成、heading-section2.png と同テイスト)
            画像ファイルは /public/heading-friend-invite.png にユーザーが配置 */}
      <div className="flex justify-center mb-6">
        <Image
          src="/heading-friend-invite.png"
          alt="友達に診断してもらおう！"
          width={800}
          height={500}
          className="w-full max-w-[340px] h-auto"
        />
      </div>

      {/* 2. QR コード (Day 11.2 から設定維持、白カードで囲む) */}
      <div className="flex justify-center mb-6">
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

      {/* 3. 説明文 (Day 11.2 から維持) */}
      <p className="text-[#3A2D6B] font-bold text-sm leading-relaxed mb-5">
        カメラで読み取ってもらって
        <br />
        友達にアナタを評価してもらおう
      </p>

      {/* 4. キャラコード + コピー (LINE 等代替手段、Day 11.2 から維持) */}
      <div className="flex items-center justify-center gap-2">
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
