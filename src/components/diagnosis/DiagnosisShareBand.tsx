"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";

// 診断ページ下部 (フッター直上) のシェアバンド。16P のシェア帯
// (ギザギザ縁のグレー帯 + 実績数 + SNS 丸ボタン) を参考に、サイトの
// デザイン言語で実装する。
//   - 数字は TopStats と同じ累計診断数の仮値 (app/page.tsx の DIAGNOSED_COUNT と同値)。
//   - ボタンは LINE / X / Facebook / リンクコピー + その他 (Web Share 対応端末のみ)。
//     アイコン・共有 URL 形式・ref 付与は MeStickyHeader のシェアモーダルと同じ。
//   - 計測は share_clicked (kind: diagnosis / source: diagnosis_share_band)。
//   - 共有 URL は診断ページ自体 (/diagnosis, ko は /ko/diagnosis)。

const DEFAULT_DIAGNOSED_COUNT = 50000;

// ギザギザ縁 (16P の帯の上下端)。clip-path で数 px の折れを作る。
const JAGGED_CLIP =
  "polygon(0 10px, 9% 3px, 22% 9px, 35% 2px, 48% 8px, 61% 3px, 74% 9px, 87% 2px, 100% 8px, 100% calc(100% - 9px), 90% calc(100% - 2px), 77% calc(100% - 8px), 64% calc(100% - 3px), 51% calc(100% - 9px), 38% calc(100% - 2px), 25% calc(100% - 8px), 12% calc(100% - 3px), 0 calc(100% - 9px))";

export function DiagnosisShareBand({
  locale,
  diagnosedCount = DEFAULT_DIAGNOSED_COUNT,
}: {
  locale: "ja" | "ko";
  diagnosedCount?: number;
}) {
  const isKo = locale === "ko";

  // navigator / location は SSR に無いためマウント後に確定させる。
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setShareUrl(
      `${window.location.origin}${isKo ? "/ko/diagnosis" : "/diagnosis"}`,
    );
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, [isKo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const countText = isKo
    ? `${(diagnosedCount / 10000).toLocaleString("ko-KR")}만+`
    : `${(diagnosedCount / 10000).toLocaleString("ja-JP")}万+`;

  const fireShare = (
    channel: "line" | "x" | "facebook" | "copy" | "native",
  ) =>
    track("share_clicked", {
      metadata: { channel, kind: "diagnosis", source: "diagnosis_share_band" },
    });

  // 共有内容は診断ページの URL だけ (宣伝文は付けない。2026-08-01 指示)。
  const lineUrl = shareUrl
    ? `https://line.me/R/msg/text/?${encodeURIComponent(withRef(shareUrl, "line"))}`
    : undefined;
  const xUrl = shareUrl
    ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(withRef(shareUrl, "x"))}`
    : undefined;
  // Facebook は sharer.php (テキストは付与不可・URL のみ)。
  const fbUrl = shareUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withRef(shareUrl, "facebook"))}`
    : undefined;

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.share({ url: withRef(shareUrl, "native") });
      // 共有先を選んで完了した時のみ計測 (キャンセルは reject され catch へ)。
      fireShare("native");
    } catch {
      // キャンセル/非対応は無視
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    const value = withRef(shareUrl, "copy");
    let succeeded = false;
    try {
      await navigator.clipboard.writeText(value);
      succeeded = true;
    } catch {
      // アプリ内ブラウザなど Clipboard API が使えない環境向けのフォールバック。
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

  // 文字色は含めない (白アイコン組と Sora ブルー組で異なる。Tailwind の競合クラスは
  // HTML 上の並び順でなくスタイルシート順で解決されるため、共通側に置くと事故る)。
  const circle =
    "flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105";

  return (
    <section
      aria-label={isKo ? "진단 테스트 공유" : "診断テストをシェア"}
      className="w-full bg-[#F5F6FA] px-4 pb-10 pt-12"
      style={{ clipPath: JAGGED_CLIP }}
    >
      <div className="relative mx-auto flex max-w-[1080px] flex-col items-center gap-1.5">
        <p className="text-[32px] font-black leading-tight text-[#2E2E5C]">
          {countText}
        </p>

        <div className="mt-4 flex items-center gap-4">
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isKo ? "LINE으로 공유" : "LINEでシェア"}
            onClick={() => fireShare("line")}
            className={`${circle} bg-[#06C755] text-white`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
            </svg>
          </a>
          <a
            href={xUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isKo ? "X로 공유" : "Xでシェア"}
            onClick={() => fireShare("x")}
            className={`${circle} bg-black text-white`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
            </svg>
          </a>
          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isKo ? "Facebook으로 공유" : "Facebookでシェア"}
            onClick={() => fireShare("facebook")}
            className={`${circle} bg-[#1877F2] text-white`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13.5 21v-7h2.4l.45-3H13.5V9.1c0-.87.28-1.6 1.66-1.6h1.34V4.85c-.3-.04-1.3-.13-2.44-.13-2.4 0-4.06 1.47-4.06 4.17V11H7.6v3h2.4v7h3.5z" />
            </svg>
          </a>
          {/* リンクコピー (コピー後はチェックに切替)。グレー帯の上でも沈まないよう
              白地 + 枠線 + 影で立たせる (薄ラベンダーは帯に溶けて見えにくかった)。 */}
          <button
            type="button"
            aria-label={isKo ? "링크 복사" : "リンクをコピー"}
            onClick={handleCopy}
            className={`${circle} border border-[#2E2E5C]/15 bg-white text-[#5B5BEF] shadow-[0_2px_6px_rgba(46,46,92,0.12)]`}
          >
            {copied ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>
          {/* その他 = OS のシェアシート (対応端末のみ。Instagram 等はこちらから) */}
          {canNativeShare && (
            <button
              type="button"
              aria-label={isKo ? "기타 방법으로 공유" : "その他の方法でシェア"}
              onClick={handleNativeShare}
              className={`${circle} border border-[#2E2E5C]/15 bg-white text-[#5B5BEF] shadow-[0_2px_6px_rgba(46,46,92,0.12)]`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          )}
        </div>
        {/* コピー完了の控えめなフィードバック (absolute で高さを取らない =
            非表示時に帯の下余白が膨らまないようにする) */}
        <p
          role="status"
          className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-bold text-[#5B5BEF] transition-opacity ${
            copied ? "opacity-100" : "opacity-0"
          }`}
        >
          {isKo ? "링크를 복사했어요 ✓" : "リンクをコピーしました ✓"}
        </p>
      </div>
    </section>
  );
}
