import type { Metadata } from "next";
import { AuthErrorContent } from "@/app/auth/error/AuthErrorContent";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "로그인 링크 오류 | 나의 사용설명서",
};

export default async function KoreanAuthErrorPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  return <AuthErrorContent reason={reason} locale="ko" />;
}
