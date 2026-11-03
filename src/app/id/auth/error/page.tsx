import { redirect } from "next/navigation";
import type { LoginParams } from "@/lib/login-recovery";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<LoginParams> }) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : "failed";
  redirect("/id/login?login_error=" + encodeURIComponent(reason));
}
