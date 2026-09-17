import type { Metadata } from "next";
import { AuthErrorContent } from "@/app/auth/error/AuthErrorContent";

export const metadata: Metadata = { title: { absolute: "Kesalahan tautan masuk | Alice Test" }, robots: { index: false, follow: false } };

export default async function IndonesianAuthErrorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <AuthErrorContent reason={typeof params.reason === "string" ? params.reason : undefined} locale="id" />;
}
