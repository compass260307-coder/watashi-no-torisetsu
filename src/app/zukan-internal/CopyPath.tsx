"use client";

// 図鑑カードの画像パスをワンクリックでコピーする小コンポーネント。
// 親 (zukan-internal/page.tsx) はサーバーコンポーネントのままにしたいので、
// クリップボード操作が要るこの部分だけを client 境界として切り出す。

import { useState } from "react";

export function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // クリップボード不可環境では何もしない (テキスト選択でコピー可能)。
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="画像パスをコピー"
      className="group/copy flex w-full items-center gap-1 text-left font-mono text-[10px] text-[#3A2D6B]/55 hover:text-[#3A2D6B] break-all"
    >
      <span className="break-all">{path}</span>
      <span className="ml-auto flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-sans font-bold text-[#0094D8] opacity-0 group-hover/copy:opacity-100 transition-opacity">
        {copied ? "コピー済" : "コピー"}
      </span>
    </button>
  );
}
