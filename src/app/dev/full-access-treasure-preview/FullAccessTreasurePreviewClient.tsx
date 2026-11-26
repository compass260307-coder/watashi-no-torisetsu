"use client";

import { useState } from "react";
import { PaywallOverlay } from "@/components/result/PaywallModal";

const CHARACTER_SRC = "/characters/cut/jellyfish_N.webp";

// どこから宝箱を開いたか。主役のカード（いま開けようとしたもの）がこれで変わる。
const ENTRIES = [
  ["love_payoff_card", "本文の鍵: 恋愛の続き"],
  ["career_fit_card", "本文の鍵: 合う働き方"],
  ["moshimo_card", "本文の鍵: もしも"],
  ["sticky_bar", "上部バー・ページ末尾のカード"],
  ["nav_locked_hoshiyomi", "下部ナビの鍵: Alice"],
  ["nav_aisho_locked", "下部ナビの鍵: 相性"],
  ["nav_locked_tarot", "下部ナビの鍵: タロット"],
] as const;

// ローカル専用: 計測・Checkoutは実行しない（previewMode）。
export function FullAccessTreasurePreviewClient() {
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState(false);
  // 価格テスト（2026-11-22〜）のどちらの群の値札を見るか。
  const [arm, setArm] = useState<"control" | "test" | "test899">("control");
  const [entry, setEntry] = useState<string>(ENTRIES[0][0]);
  // 特典の見せ方。spill は新しい見せ方（値札のあと宝箱から7つが飛び出す）、stack は従来。
  // auto は本番と同じく owner_token から決める（このページの owner_token は "preview" で固定）。
  const [layout, setLayout] = useState<"spill" | "stack" | "auto">("spill");
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
        <h1 className="text-[22px] font-black text-[#2E2E5C]">完全版の宝箱クーポン演出</h1>
        <p className="text-[13px] text-[#66657B]">計測と決済は行いません。</p>
        <div className="flex gap-2" role="group" aria-label="値札の額">
          {([["control", "¥1,299 − ¥800 = ¥499"], ["test", "¥1,499 − ¥800 = ¥699"], ["test899", "¥1,699 − ¥800 = ¥899"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={arm === value}
              onClick={() => setArm(value)}
              className={`flex-1 rounded-full border-2 border-[#2E2E5C] px-3 py-2 text-[12px] font-black ${
                arm === value ? "bg-[#2E2E5C] text-white" : "text-[#2E2E5C]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2" role="group" aria-label="特典の見せ方">
          {([["spill", "新: 7つが飛び出す"], ["stack", "従来"], ["auto", "A/Bの割り当て"]] as const).map(([value, label]) => (
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
        <label className="block text-left text-[12px] font-black text-[#2E2E5C]">
          どこから開いたか
          <select
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-[#2E2E5C] bg-white px-3 py-2 text-[13px] font-bold text-[#2E2E5C]"
          >
            {ENTRIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
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
          ctaSource={entry}
          treasurePreviewArm={arm}
          treasurePreviewLayout={layout === "auto" ? undefined : layout}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}
