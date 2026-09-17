"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IdResultRedirect() {
  const router = useRouter();

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // Lanjutkan ke tes bila penyimpanan lokal tidak tersedia.
    }
    router.replace(token ? `/id/me/${encodeURIComponent(token)}` : "/id/diagnosis");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#2E2E5C]/20 border-t-[#2E2E5C]" role="status" aria-label="Memuat hasil Anda" />
    </div>
  );
}
