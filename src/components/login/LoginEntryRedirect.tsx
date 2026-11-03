"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginRecoveryPath, type LoginLocale, type LoginParams } from "@/lib/login-recovery";

export default function LoginEntryRedirect({ locale, destination, params }: {
  locale: LoginLocale;
  destination: string | null;
  params: LoginParams;
}) {
  const router = useRouter();
  useEffect(() => {
    const prefix = locale === "ja" ? "" : `/${locale}`;
    let target = destination;
    if (!target) {
      let token: string | null = null;
      try { token = localStorage.getItem("torisetsu_owner_token"); } catch { /* storage unavailable */ }
      target = token ? `${prefix}/me/${encodeURIComponent(token)}` : `${prefix}/diagnosis`;
    }
    router.replace(loginRecoveryPath(locale, target, params));
  }, [destination, locale, params, router]);
  return <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2E2E5C]/20 border-t-[#2E2E5C]" />
  </div>;
}
