// プレミアム化 v3 Day 8: マジックリンク検証エラーページ。
//
// /auth/error?reason=missing_token|invalid_or_expired|server_error

import { AuthErrorContent } from "./AuthErrorContent";

type SearchParams = Promise<{ reason?: string; locale?: string }>;

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { reason, locale } = await searchParams;
  return (
    <AuthErrorContent
      reason={reason}
      locale={locale === "ko" ? "ko" : "ja"}
    />
  );
}
