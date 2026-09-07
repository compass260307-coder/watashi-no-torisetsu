"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KoResultPageClient() {
  const router = useRouter();

  useEffect(() => {
    let ownerToken: string | null = null;
    try {
      ownerToken = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // ストレージ不可時は再診断へ戻す。
    }

    router.replace(
      ownerToken ? `/ko/me/${encodeURIComponent(ownerToken)}` : "/ko/diagnosis",
    );
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg">
      <div
        className="w-10 h-10 rounded-full border-[3px] border-[#2E2E5C]/20 border-t-[#2E2E5C] animate-spin"
        role="status"
        aria-label="결과 불러오는 중"
      />
    </div>
  );
}
