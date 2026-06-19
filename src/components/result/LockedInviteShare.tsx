"use client";

// ロック中の「友達に評価してもらう」招待導線 (QR + LINE + インスタ=コピー)。
// OthersPerceptionSection のロック表示内に埋め込む。課金導線は一切含めない。
//
// - QR: 友達評価への招待URL (inviteCode 付き) を対面スキャン用に表示。
// - LINE: line.me 共有リンクで招待URL + 一言。
// - インスタ: URL直接共有が弱いため「リンクをコピー」にフォールバック (DM/ストーリーに貼る前提)。

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface LockedInviteShareProps {
  /** 友達評価の招待 URL (絶対 URL, /friend/[inviteCode])。 */
  inviteUrl: string;
}

const SHARE_TEXT =
  "友達から見たわたしを教えて！「ワタシのトリセツ」で相互理解度がわかるよ";

export function LockedInviteShare({ inviteUrl }: LockedInviteShareProps) {
  const [copied, setCopied] = useState(false);

  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${SHARE_TEXT} ${inviteUrl}`,
  )}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボード不可環境では何もしない (QR / LINE を使ってもらう)
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 text-center">
      <p className="text-[#FE3C72] font-black text-[10px] tracking-[0.3em] mb-2">
        友達に評価してもらう
      </p>
      <h3 className="text-[#3A2D6B] font-black text-lg leading-snug mb-4">
        友達に評価してもらって
        <br />
        ロックを解除しよう
      </h3>

      {/* QR (対面スキャン用)。装飾SVGを role="img" でラベル付け */}
      <div className="flex justify-center mb-3">
        <div
          className="bg-white rounded-2xl p-4 shadow-md border-2 border-[#3A2D6B]/20"
          role="img"
          aria-label="友達評価ページへの招待QRコード"
        >
          <QRCodeSVG
            value={inviteUrl}
            size={180}
            bgColor="#FFFFFF"
            fgColor="#3A2D6B"
            level="H"
            marginSize={0}
          />
        </div>
      </div>
      <p className="text-[#3A2D6B]/75 font-bold text-xs leading-relaxed mb-5">
        カメラで読み取って、その場で評価してもらおう
      </p>

      {/* LINE / インスタ(=コピー) で送る */}
      <div className="flex flex-col gap-3">
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#06C755] text-white font-black text-base px-6 py-3.5 rounded-full shadow-[0_4px_0_#04a648] hover:translate-y-0.5 hover:shadow-[0_2px_0_#04a648] active:translate-y-1 active:shadow-[0_0_0_#04a648] transition-all"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 fill-white"
            aria-hidden="true"
          >
            <path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.55 7.48 8.35 8.12.32.07.77.21.88.49.1.25.07.65.03.9l-.14.86c-.04.25-.2.99.87.54s5.77-3.4 7.87-5.82c1.45-1.59 2.14-3.2 2.14-5.09C22 5.69 17.52 2 12 2zM8.13 12.6h-2c-.29 0-.53-.24-.53-.53V8.36c0-.29.24-.53.53-.53s.53.24.53.53v3.18h1.47c.29 0 .53.24.53.53s-.24.53-.53.53zm2.07-.53c0 .29-.24.53-.53.53s-.53-.24-.53-.53V8.36c0-.29.24-.53.53-.53s.53.24.53.53v3.71zm4.34 0c0 .23-.15.43-.36.5-.06.02-.11.03-.17.03-.17 0-.33-.08-.43-.22l-1.88-2.56v2.25c0 .29-.24.53-.53.53s-.53-.24-.53-.53V8.36c0-.23.15-.43.36-.5.05-.02.11-.03.17-.03.17 0 .33.08.43.22l1.88 2.56V8.36c0-.29.24-.53.53-.53s.53.24.53.53v3.71zm3.24-2.39c.29 0 .53.24.53.53s-.24.53-.53.53h-1.47v.79h1.47c.29 0 .53.24.53.53s-.24.53-.53.53h-2c-.29 0-.53-.24-.53-.53V8.36c0-.29.24-.53.53-.53h2c.29 0 .53.24.53.53s-.24.53-.53.53h-1.47v.79z" />
          </svg>
          LINEで送る
        </a>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 w-full bg-white text-[#3A2D6B] font-black text-base px-6 py-3.5 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
        >
          {copied
            ? "コピーしました ✓"
            : "インスタ用にリンクをコピー"}
        </button>
        <p className="text-[#3A2D6B]/55 font-bold text-[11px]">
          コピーしたリンクを、インスタの DM やストーリーに貼って送ってね
        </p>
      </div>
    </div>
  );
}
