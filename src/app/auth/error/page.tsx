import { redirect } from "next/navigation";
import type { LoginParams } from "@/lib/login-recovery";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<LoginParams> }) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : "failed";
  const locale = params.locale;
  const prefix = locale === "en" || locale === "ko" || locale === "id" ? `/${locale}` : "";
  redirect(`${prefix}/login?login_error=` + encodeURIComponent(reason));
}
