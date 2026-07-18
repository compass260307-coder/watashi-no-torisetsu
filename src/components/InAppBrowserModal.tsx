"use client";

// SNS アプリ内ブラウザ (WebView) 対策モーダル。
//
// 自己診断スタート画面で、LINE/Instagram/Facebook/X/TikTok のアプリ内ブラウザを検出したら
// 「Safari/Chrome での利用を推奨」モーダルを表示する。
//   - 「リンクをコピー」 = 現在の URL をクリップボードへ (Safari/Chrome に貼って開いてもらう)
//   - 「このまま続ける」 = 閉じて続行 (ハードブロックはしない)
// 通常ブラウザ (Safari/Chrome 等) では何も表示しない。

import { useEffect, useState } from "react";
import { detectInAppBrowser } from "@/lib/in-app-browser";
import type { InAppBrowserCopy } from "@/i18n/diagnosis";

const DEFAULT_COPY: InAppBrowserCopy = {
  title: "SafariやChromeでの利用を推奨しています",
  description:
    "LINEやInstagramなどのSNSアプリ内で診断すると、結果が保存されなかったり、エラーが発生する場合があります。",
  copyButton: "リンクをコピー",
  copiedButton: "コピーしました ✓",
  copyFallback: "うまくコピーできない場合は、下のURLを長押しでコピー：",
  continueButton: "このまま続ける",
};

export function InAppBrowserModal({
  copy = DEFAULT_COPY,
}: {
  copy?: InAppBrowserCopy;
} = {}) {
  // SSR とハイドレーション不整合を避けるため、検出はマウント後 (クライアント) にだけ行う。
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (!detectInAppBrowser(ua)) return;

    const timer = window.setTimeout(() => {
      setCurrentUrl(window.location.href);
      setOpen(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (!open) return null;

  const handleCopy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // アプリ内ブラウザでは clipboard API が使えないことがある。
      // フォールバックとして URL を表示し、長押しコピーしてもらう。
      setCopyFailed(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inapp-modal-title"
      className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4 py-6 animate-modal-fade-in"
    >
      <div className="w-full max-w-[400px] bg-white rounded-3xl border-2 border-[#2E2E5C] shadow-2xl p-6 animate-modal-slide-up">
        <h2
          id="inapp-modal-title"
          className="text-[#2E2E5C] font-black text-lg leading-snug mb-3"
        >
          {copy.title}
        </h2>
        <p className="text-[#2E2E5C]/80 text-sm leading-relaxed mb-5">
          {copy.description}
        </p>

        {/* リンクをコピー (sunYellow chunky ボタン) */}
        <button
          type="button"
          onClick={handleCopy}
          className="block w-full bg-[#5B5BEF] text-white font-black text-base px-6 py-4 rounded-full shadow-[0_8px_20px_rgba(91,91,239,0.30)] hover:translate-y-0.5 hover:shadow-[0_4px_12px_rgba(91,91,239,0.30)] active:translate-y-1 active:shadow-[0_0_0_#2E2E5C] transition-all text-center"
        >
          {copied ? copy.copiedButton : copy.copyButton}
        </button>

        {/* clipboard 不可時のフォールバック: URL を直接表示して長押しコピー */}
        {copyFailed && currentUrl && (
          <div className="mt-3 rounded-xl border-2 border-[#0094D8]/30 bg-[#E4E0F5]/40 px-3 py-2">
            <p className="text-[10px] text-[#2E2E5C]/60 font-bold mb-1">
              {copy.copyFallback}
            </p>
            <p className="text-[11px] text-[#2E2E5C] font-bold break-all select-all">
              {currentUrl}
            </p>
          </div>
        )}

        {/* このまま続ける (ハードブロックしない) */}
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[#2E2E5C]/60 font-bold text-sm underline hover:text-[#5B5BEF] transition-colors"
          >
            {copy.continueButton}
          </button>
        </div>
      </div>
    </div>
  );
}
