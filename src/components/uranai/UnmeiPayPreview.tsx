"use client";

// dev 限定プレビュー: チャット内 Embedded Checkout (UnmeiEmbeddedCheckout) を単体表示する。
// 決済フォームが実際に描画されるか / onComplete が発火するかを、セッション・DB書き込み
// なしで確認するための足場 (?preview=pay)。本番導線では使わない。

import { useState } from "react";
import UnmeiEmbeddedCheckout from "@/components/uranai/UnmeiEmbeddedCheckout";

export default function UnmeiPayPreview() {
  const [done, setDone] = useState(false);
  return (
    <main className="mx-auto max-w-[480px] px-4 py-10">
      <p className="mb-4 text-center text-sm font-bold text-[#8A8AA3]">
        [dev] Embedded Checkout 単体プレビュー
      </p>
      {done ? (
        <p className="rounded-2xl border border-[#E9E9F2] bg-white p-6 text-center font-bold text-[#2E2E5C]">
          onComplete 発火 ✓（本番はここで生成へ）
        </p>
      ) : (
        <UnmeiEmbeddedCheckout
          product="unmei"
          ownerToken={null}
          onComplete={() => setDone(true)}
        />
      )}
    </main>
  );
}
