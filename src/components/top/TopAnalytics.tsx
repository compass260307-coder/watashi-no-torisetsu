"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { SmoothImage } from "@/components/ui/SmoothImage";
import type { ResultLocale } from "@/i18n/result";
import { track } from "@/lib/track";

type TopLocale = ResultLocale | "en" | "id";

export function TopViewTracker({ locale }: { locale: TopLocale }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("top_viewed", { metadata: { locale, page: "top" } });
  }, [locale]);

  return null;
}

export function trackTopCta(locale: TopLocale) {
  track("top_cta_clicked", {
    metadata: { locale, page: "top", destination: "diagnosis" },
  });
}

// Shares the existing TOP tracking entry, so the CTA adds no standalone chunk.
export function TopDiagnosisCta({ locale, children }: { locale: "ja" | "en" | "id"; children: ReactNode }) {
  return <Link
    href={locale === "en" ? "/en/diagnosis" : locale === "id" ? "/id/diagnosis" : "/diagnosis"}
    prefetch={false}
    onClick={() => trackTopCta(locale)}
    className="sora-cta top-hero-cta block w-full rounded-full px-16 py-5 text-center font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5 lg:inline-block lg:w-auto lg:min-w-[380px]"
    style={{ boxShadow: "0 8px 20px rgba(91,91,239,0.30)" }}
  >{children}</Link>;
}

// Reuse the diagnosis image runtime without a fade or unconditional mobile hint.
export function TopHeroImage({ mobile, desktop }: { mobile: string; desktop: string }) {
  return <picture>
    <source media="(min-width: 640px)" srcSet={desktop} />
    <SmoothImage src={mobile} alt="" fill unoptimized fadeIn={false}
      loading="eager" fetchPriority="high"
      style={{ objectFit: "cover", objectPosition: "center bottom" }} />
  </picture>;
}
