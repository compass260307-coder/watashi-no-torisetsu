// プレミアム化 v3 Day 6: マジックリンク検証エラーページ (簡易版、Day 9 で本格 UI)
//
// /auth/error?reason=invalid_or_expired
//   - invalid_or_expired: リンク期限切れ or 使用済
//   - missing_token: token クエリ不在
//   - server_error: DB / session 発行エラー

import Link from "next/link";

type SearchParams = Promise<{ reason?: string }>;

const REASON_MESSAGES: Record<string, string> = {
  invalid_or_expired:
    "ログインリンクが無効、または既に使用されています。期限は 1 時間です。",
  missing_token: "リンクが正しくありません。メールから開き直してください。",
  server_error: "サーバーで問題が発生しました。少し時間をおいて再度お試しください。",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { reason } = await searchParams;
  const message =
    (reason && REASON_MESSAGES[reason]) ??
    "リンクの確認に失敗しました。";

  return (
    <main className="flex flex-col flex-1 items-center justify-center px-5 py-10 max-w-lg mx-auto w-full">
      <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
        AUTH ERROR
      </p>
      <h1 className="text-xl font-extrabold text-center mb-4">
        ログインできませんでした
      </h1>
      <p className="text-sm text-muted text-center leading-relaxed mb-8 max-w-sm">
        {message}
      </p>
      <Link
        href="/"
        className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white shadow-md"
      >
        トップへ戻る
      </Link>
    </main>
  );
}
