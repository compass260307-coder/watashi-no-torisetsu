"use client";

import { useState } from "react";
import { FullAccessChestCard } from "@/components/result/FullAccessChestCard";
import { PaywallOverlay } from "@/components/result/PaywallModal";

const CHARACTER_SRC = "/characters/cut/jellyfish_N.webp";

// ローカル専用: 自己診断結果ページの末尾に置く宝箱と、押したあとの演出のつながりを見る。
// 計測・Checkoutは実行しない（previewMode）。
export function PromoChestPreviewClient() {
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<"spill" | "stack">("spill");
  function reset() {
    try {
      window.sessionStorage.removeItem("torisetsu_full_access_coupon_received");
    } catch {
      /* noop */
    }
    window.location.reload();
  }
  return (
    <main className="min-h-screen bg-[#F5F4FB]">
      <div className="mx-auto max-w-[460px] space-y-3 px-4 py-8 text-center">
        <p className="text-[12px] font-black tracking-[0.14em] text-[#9A6A24]">LOCAL PREVIEW</p>
        <h1 className="text-[20px] font-black text-[#2E2E5C]">ページ末尾の宝箱</h1>
        <p className="text-[13px] text-[#66657B]">計測と決済は行いません。</p>
        <div className="flex gap-2" role="group" aria-label="特典の見せ方">
          {([["spill", "新: 7つが飛び出す"], ["stack", "従来"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={layout === value}
              onClick={() => setLayout(value)}
              className={`flex-1 rounded-full border-2 border-[#9A6A24] px-3 py-2 text-[12px] font-black ${
                layout === value ? "bg-[#9A6A24] text-white" : "text-[#9A6A24]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-full border-2 border-[#2E2E5C] px-6 py-3 text-[14px] font-black text-[#2E2E5C]"
        >
          受け取り前に戻す
        </button>
      </div>
      {/* 本番と同じく、白い帯の中に置く。 */}
      <div className="bg-white px-4 pb-10 pt-6">
        <div className="mx-auto w-full max-w-[460px]">
          <FullAccessChestCard
            onOpen={() => {
              setRun((value) => value + 1);
              setOpen(true);
            }}
          />
        </div>
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
          ctaSource="promo_chest"
          treasurePreviewLayout={layout}
          treasureStartOpening
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}
