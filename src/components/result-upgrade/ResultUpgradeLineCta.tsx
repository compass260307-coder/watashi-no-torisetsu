"use client";

import { useCallback, useState } from "react";
import PaywallLineExitModal from "@/components/result/PaywallLineExitModal";

export function ResultUpgradeLineCta({ ownerToken, preview = false }: { ownerToken: string; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#06C755] px-4 py-1.5 text-center text-[12px] font-bold leading-[1.2] text-white shadow-[0_3px_0_#049B42] transition hover:bg-[#05B34C] active:translate-y-0.5 sm:min-h-11 sm:px-5 sm:text-[13px]"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 2v-6a8.5 8.5 0 1 1 18-4.5Z" /><path d="M7 10h10M7 14h6" /></svg>
      LINEでAliceと話す
    </button>
    {open && <PaywallLineExitModal ownerToken={ownerToken} onClose={close} variant="conversation" trackingSource="result_upgrade" previewMode={preview} />}
  </>;
}
