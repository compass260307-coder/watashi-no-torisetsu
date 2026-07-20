"use client";

import Link from "next/link";
import { KO_TOP_CONTENT } from "@/i18n/ko/top";
import { trackKoTopCta } from "@/components/ko/top/KoTopAnalytics";

export default function KoTopCta() {
  return (
    <Link
      href="/ko/diagnosis"
      onClick={trackKoTopCta}
      className="sora-cta top-hero-cta block w-full rounded-full px-8 py-5 text-center font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5 sm:px-16 lg:inline-block lg:w-auto lg:min-w-[380px]"
      style={{ boxShadow: "0 8px 20px rgba(91,91,239,0.30)" }}
    >
      {KO_TOP_CONTENT.hero.cta}
    </Link>
  );
}
