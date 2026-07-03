"use client";

// ★ 末尾CTA簡素化で /evaluate/result からの参照を撤去 (シェア導線はハブ
//   /friend-evaluation = QR + 相互理解度ランキング 側に一本化)。Stripe コード等と同様、
//   後日の再利用に備えて温存している (削除しないこと)。現在どのページからも未参照。
//
// 相互理解度の詳細ページ: 旧・課金解除カードの位置に置くバイラル導線。
//
// 「もっと友達に答えてもらうと、相互理解度の精度が上がる」+ シェア / 友達評価リンクのコピー。
// トーンは /me のフローティング CTA に合わせる (sunYellow + deepPurple + chunky)。
// 友達評価リンク (= /friend/[inviteCode]) をシェアして、より多くの友達に評価してもらう導線。

import { useState } from "react";

interface PerceptionBoostCtaProps {
  /** 友達評価の招待 URL (絶対 URL, /friend/[inviteCode])。 */
  inviteUrl: string;
}

const SHARE_TEXT = "友達から見たわたしを教えて！「ワタシのトリセツ」で他己診断テストができるよ";

export function PerceptionBoostCta({ inviteUrl }: PerceptionBoostCtaProps) {
  const [copied, setCopied] = useState(false);

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    SHARE_TEXT,
  )}&url=${encodeURIComponent(inviteUrl)}`;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${SHARE_TEXT} ${inviteUrl}`,
  )}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 不可環境では何もしない (X/LINE 共有を使ってもらう)
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] p-6 mb-8 text-center">
      <p className="text-[#FE3C72] font-black text-[10px] tracking-[0.3em] mb-2">
        精度をもっと上げる
      </p>
      <h2 className="text-[#3A2D6B] font-black text-lg leading-snug mb-2">
        もっと友達に答えてもらうと、
        <br />
        他己診断テストの精度が上がる
      </h2>
      <p className="text-[#3A2D6B]/75 text-sm leading-relaxed mb-5">
        答えてくれる友達が増えるほど、&ldquo;友達から見たアナタ&rdquo;の解像度が上がります。リンクをシェアして、もっと答えてもらおう。
      </p>

      {/* リンクをコピー (sunYellow chunky = /me のフローティング CTA トーン) */}
      <button
        type="button"
        onClick={handleCopy}
        className="block w-full bg-[#FFE993] text-[#3A2D6B] font-black text-base px-6 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all text-center"
      >
        {copied ? "コピーしました ✓" : "友達評価リンクをコピー"}
      </button>

      {/* SNS シェア (X / LINE) */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X でシェア"
          className="w-11 h-11 rounded-full bg-black flex items-center justify-center hover:scale-110 transition-transform"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LINE でシェア"
          className="w-11 h-11 rounded-full bg-[#06C755] flex items-center justify-center hover:scale-110 transition-transform"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
            <path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.55 7.48 8.35 8.12.32.07.77.21.88.49.1.25.07.65.03.9l-.14.86c-.04.25-.2.99.87.54s5.77-3.4 7.87-5.82c1.45-1.59 2.14-3.2 2.14-5.09C22 5.69 17.52 2 12 2zM8.13 12.6h-2c-.29 0-.53-.24-.53-.53V8.36c0-.29.24-.53.53-.53s.53.24.53.53v3.18h1.47c.29 0 .53.24.53.53s-.24.53-.53.53zm2.07-.53c0 .29-.24.53-.53.53s-.53-.24-.53-.53V8.36c0-.29.24-.53.53-.53s.53.24.53.53v3.71zm4.34 0c0 .23-.15.43-.36.5-.06.02-.11.03-.17.03-.17 0-.33-.08-.43-.22l-1.88-2.56v2.25c0 .29-.24.53-.53.53s-.53-.24-.53-.53V8.36c0-.23.15-.43.36-.5.05-.02.11-.03.17-.03.17 0 .33.08.43.22l1.88 2.56V8.36c0-.29.24-.53.53-.53s.53.24.53.53v3.71zm3.24-2.39c.29 0 .53.24.53.53s-.24.53-.53.53h-1.47v.79h1.47c.29 0 .53.24.53.53s-.24.53-.53.53h-2c-.29 0-.53-.24-.53-.53V8.36c0-.29.24-.53.53-.53h2c.29 0 .53.24.53.53s-.24.53-.53.53h-1.47v.79z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
