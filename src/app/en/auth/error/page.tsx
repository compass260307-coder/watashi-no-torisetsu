import type { Metadata } from "next";
import { AuthErrorContent } from "@/app/auth/error/AuthErrorContent";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: { absolute: "Sign-in link error | Alice Test" },
  robots: { index: false, follow: false },
};

export default async function EnglishAuthErrorPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  return <AuthErrorContent reason={reason} locale="en" />;
}
