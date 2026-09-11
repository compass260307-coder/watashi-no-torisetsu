"use client";

import Link from "next/link";
import { trackTopCta } from "@/components/top/TopAnalytics";

export default function EnTopCta() {
  return (
    <Link
      href="/en/diagnosis"
      prefetch={false}
      onClick={() => trackTopCta("en")}
      className="sora-cta top-hero-cta block w-full rounded-full px-12 py-5 text-center font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5 sm:inline-block sm:w-auto sm:min-w-[360px]"
      style={{ boxShadow: "0 8px 20px rgba(91,91,239,0.30)" }}
    >
      Take the free test →
    </Link>
  );
}
