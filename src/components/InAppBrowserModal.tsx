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

export function InAppBrowserModal() {
  // SSR とハイドレーション不整合を避けるため、検出はマウント後 (クライアント) にだけ行う。
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (detectInAppBrowser(ua)) {
      setCurrentUrl(window.location.href);
      setOpen(true);
    }
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
      <div className="w-full max-w-[400px] bg-white rounded-3xl border-2 border-[#3A2D6B] shadow-2xl p-6 animate-modal-slide-up">
        <h2
          id="inapp-modal-title"
          className="text-[#3A2D6B] font-black text-lg leading-snug mb-3"
        >
          SafariやChromeでの利用を推奨しています
        </h2>
        <p className="text-[#3A2D6B]/80 text-sm leading-relaxed mb-5">
          LINEやInstagramなどのSNSアプリ内で診断すると、結果が保存されなかったり、エラーが発生する場合があります。
        </p>

        {/* リンクをコピー (sunYellow chunky ボタン) */}
        <button
          type="button"
          onClick={handleCopy}
          className="block w-full bg-[#FFE993] text-[#3A2D6B] font-black text-base px-6 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all text-center"
        >
          {copied ? "コピーしました ✓" : "リンクをコピー"}
        </button>

        {/* clipboard 不可時のフォールバック: URL を直接表示して長押しコピー */}
        {copyFailed && currentUrl && (
          <div className="mt-3 rounded-xl border-2 border-[#0094D8]/30 bg-[#E4E0F5]/40 px-3 py-2">
            <p className="text-[10px] text-[#3A2D6B]/60 font-bold mb-1">
              うまくコピーできない場合は、下のURLを長押しでコピー：
            </p>
            <p className="text-[11px] text-[#3A2D6B] font-bold break-all select-all">
              {currentUrl}
            </p>
          </div>
        )}

        {/* このまま続ける (ハードブロックしない) */}
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[#3A2D6B]/60 font-bold text-sm underline hover:text-[#FE3C72] transition-colors"
          >
            このまま続ける
          </button>
        </div>
      </div>
    </div>
  );
}
