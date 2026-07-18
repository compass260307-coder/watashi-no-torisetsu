"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DIAGNOSIS_LOCALES } from "@/i18n/diagnosis";
import { classifyThirtyTwoType } from "@/lib/thirty-two-types";
import { isPreviewMode } from "@/lib/track";
import type { BigFiveDimension } from "@/lib/types";

const DIMENSIONS: readonly BigFiveDimension[] = ["O", "C", "E", "A", "N"];

function readStoredScores(): Record<BigFiveDimension, number> | null {
  try {
    const raw = localStorage.getItem(DIAGNOSIS_LOCALES.ko.resultStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { scores?: unknown };
    if (!parsed.scores || typeof parsed.scores !== "object") return null;
    const source = parsed.scores as Record<string, unknown>;
    const scores = {} as Record<BigFiveDimension, number>;
    for (const dimension of DIMENSIONS) {
      const value = source[dimension];
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      scores[dimension] = value;
    }
    return scores;
  } catch {
    return null;
  }
}

export default function KoResultPageClient() {
  const router = useRouter();

  useEffect(() => {
    const scores = readStoredScores();
    let ownerToken: string | null = null;
    try {
      ownerToken = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // ストレージ不可時は再診断へ戻す。
    }

    if (ownerToken && !isPreviewMode()) {
      router.replace(`/ko/me/${encodeURIComponent(ownerToken)}`);
      return;
    }

    if (scores) {
      const typeId = classifyThirtyTwoType(scores);
      router.replace(
        `/ko/me/preview?previewType=${encodeURIComponent(typeId)}&fromPreview=1`,
      );
      return;
    }

    router.replace("/ko/diagnosis");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#2E2E5C]/20 border-t-[#2E2E5C]"
        role="status"
        aria-label="결과 불러오는 중"
      />
    </main>
  );
}
