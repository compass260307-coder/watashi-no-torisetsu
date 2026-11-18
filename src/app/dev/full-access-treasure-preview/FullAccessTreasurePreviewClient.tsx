"use client";

import { useState } from "react";
import { PaywallOverlay } from "@/components/result/PaywallModal";

const CHARACTER_SRC = "/characters/cut/jellyfish_N.webp";

// ローカル専用: 計測・Checkoutは実行しない（previewMode）。
export function FullAccessTreasurePreviewClient() {
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState(false);
  function openOverlay(resetCoupon: boolean) {
    if (resetCoupon) {
      try {
        window.sessionStorage.removeItem("torisetsu_full_access_coupon_received");
      } catch {
        /* noop */
      }
    }
    setRun((value) => value + 1);
    setOpen(true);
  }
  return (
    <main className="min-h-screen bg-[#F5F4FB] px-4 py-10">
      <div className="mx-auto max-w-[420px] space-y-4 text-center">
        <p className="text-[12px] font-black tracking-[0.14em] text-[#9A6A24]">LOCAL PREVIEW</p>
        <h1 className="text-[22px] font-black text-[#2E2E5C]">完全版 ¥499 の宝箱クーポン演出</h1>
        <p className="text-[13px] text-[#66657B]">計測と決済は行いません。</p>
        <button
          type="button"
          onClick={() => openOverlay(true)}
          className="w-full rounded-full bg-[#2E2E5C] px-6 py-4 text-[15px] font-black text-white"
        >
          全ての結果をアンロック（初回）
        </button>
        <button
          type="button"
          onClick={() => openOverlay(false)}
          className="w-full rounded-full border-2 border-[#2E2E5C] px-6 py-3 text-[14px] font-black text-[#2E2E5C]"
        >
          もう一度押す（受け取り済みなら値札から）
        </button>
      </div>
      {open && (
        <PaywallOverlay
          key={run}
          locale="ja"
          ownerToken="preview"
          imageSrc={CHARACTER_SRC}
          group="sea"
          returnTo="me"
          previewMode
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}
