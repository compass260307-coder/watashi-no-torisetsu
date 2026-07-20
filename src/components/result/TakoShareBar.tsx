"use client";

// /tako の常時表示バー (シェア3ボタン + 解除CTA)。
// /me の MeStickyHeader のバー部分と同じ見た目・挙動だが、/tako では
// 友達アバタータブの「下」に置く (2026-07-20 指示で順番をタブ→バーに変更)。
// バー自体が sticky top-0 なので、スクロールしてタブが流れた後も画面上部に残る。

import { useState, type ReactNode } from "react";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";

function CircleIconButton({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls =
    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#5B5BEF]/35 bg-white text-[#5B5BEF] transition-colors hover:bg-[#F4F4FE]";
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        onClick={onClick}
        className={cls}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function TakoShareBar({
  shareUrl,
  essence,
  showUnlockCta,
}: {
  /** キャラクター共有 URL (/share/[inviteCode])。 */
  shareUrl?: string;
  /** シェア文言用の称号 (essence)。 */
  essence?: string;
  /** 「すべての結果のロックを解除」CTA を出すか (tako_unlock 未購入時のみ true)。 */
  showUnlockCta: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const shareText = `ワタシのトリセツは「${essence ?? ""}」でした！\n私のキャラクターを見てみて👇`;
  const xUrl = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(withRef(shareUrl, "x"))}`
    : undefined;
  const lineUrl = shareUrl
    ? `https://line.me/R/msg/text/?${encodeURIComponent(`${shareText}\n${withRef(shareUrl, "line")}`)}`
    : undefined;

  const fireShare = (channel: "copy" | "x" | "line") =>
    track("share_clicked", {
      metadata: { channel, kind: "character", source: "sticky_bar" },
    });

  const handleCopy = async () => {
    if (!shareUrl) return;
    const value = `${shareText}\n${withRef(shareUrl, "copy")}`;
    let succeeded = false;
    try {
      await navigator.clipboard.writeText(value);
      succeeded = true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      try {
        textarea.select();
        succeeded = document.execCommand("copy");
      } finally {
        textarea.remove();
      }
    }
    if (!succeeded) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    fireShare("copy");
  };

  if (!shareUrl && !showUnlockCta) return null;

  return (
    <div className="sticky top-0 z-40 -mx-4 flex items-center justify-end gap-2 border-b border-[#E9E9F2] bg-white px-4 py-2 md:mx-0 md:px-4">
      {shareUrl && (
        <>
          <CircleIconButton
            label={
              copied ? "コピーしました" : "キャラクターの共有文とリンクをコピー"
            }
            onClick={handleCopy}
          >
            {copied ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12l4 4L19 6" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </CircleIconButton>
          <span className="sr-only" role="status" aria-live="polite">
            {copied ? "キャラクターの共有文とリンクをコピーしました" : ""}
          </span>
          <CircleIconButton
            label="Xでシェア"
            href={xUrl}
            onClick={() => fireShare("x")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
            </svg>
          </CircleIconButton>
          <CircleIconButton
            label="LINEでシェア"
            href={lineUrl}
            onClick={() => fireShare("line")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
            </svg>
          </CircleIconButton>
        </>
      )}

      {showUnlockCta && (
        <button
          type="button"
          onClick={() => scrollToPaywall("sticky_bar", "tako-promo")}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#5B5BEF] px-4 py-2 text-[12px] font-black text-white shadow-[0_3px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] md:text-[13px]"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          すべての結果のロックを解除
        </button>
      )}
    </div>
  );
}
