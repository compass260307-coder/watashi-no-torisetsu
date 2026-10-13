"use client";

import { useEffect, useState } from "react";
import { RESULT_UPGRADE_COPY, type ResultUpgradeLocale } from "@/i18n/result-upgrade";

export function ResultUpgradeSpendPause({
  locale,
  retryAt,
  canRetry,
  onResume,
}: {
  locale: ResultUpgradeLocale;
  retryAt?: string | null;
  canRetry?: boolean;
  onResume: () => void;
}) {
  const copy = RESULT_UPGRADE_COPY[locale];
  const [eligibleAt, setEligibleAt] = useState<string | null>(null);
  const eligible = Boolean(canRetry || (retryAt && eligibleAt === retryAt));
  useEffect(() => {
    if (canRetry) return;
    const remaining = retryAt ? Date.parse(retryAt) - Date.now() : NaN;
    if (!retryAt || !Number.isFinite(remaining)) return;
    const timer = setTimeout(() => setEligibleAt(retryAt), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [canRetry, retryAt]);
  return (
    <div role="status">
      <p>{copy.blocked}</p>
      <button
        type="button"
        disabled={!eligible}
        onClick={onResume}
        className="mt-3 rounded-full bg-[#5B5BEF] px-5 py-2.5 text-[13px] font-black text-white disabled:cursor-wait disabled:opacity-50"
      >
        {copy.resume}
      </button>
    </div>
  );
}
