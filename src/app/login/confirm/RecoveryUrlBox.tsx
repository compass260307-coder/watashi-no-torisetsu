"use client";

// 復帰URL (現デバイスのアカウント A の /me/[owner_token]) を目立つ形で提示し、
// ワンタップでコピーできるようにする。事故防止が目的なので「保存して」を強調。

import { useState } from "react";
import type { ResultLocale } from "@/i18n/result";

export function RecoveryUrlBox({
  url,
  locale = "ja",
}: {
  url: string;
  locale?: ResultLocale;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボード不可環境では選択してコピーしてもらう
    }
  };

  return (
    <div className="rounded-2xl border-2 border-[#5B5BEF]/40 bg-[#F4F4FE] p-4">
      <code className="block break-all text-[13px] font-bold text-[#2E2E5C] leading-relaxed mb-3">
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-5 py-3 text-sm font-black text-white shadow-[0_3px_0_#3d3dc4] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] active:translate-y-1 active:shadow-none transition-all"
      >
        {copied
          ? locale === "ko" ? "복사했어요 ✓" : "コピーしました ✓"
          : locale === "ko" ? "이 주소를 복사해 저장하기" : "このURLをコピーして保存"}
      </button>
    </div>
  );
}
