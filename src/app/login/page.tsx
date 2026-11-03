import type { Metadata } from "next";
import LoginEntry from "@/components/login/LoginEntry";
import type { LoginParams } from "@/lib/login-recovery";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<LoginParams> }) {
  return <LoginEntry locale="ja" params={await searchParams} />;
}
