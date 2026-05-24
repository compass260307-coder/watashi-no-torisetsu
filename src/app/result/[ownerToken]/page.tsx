// プレミアム化 v3 Day 9: 旧 /result/[ownerToken] → /me/[ownerToken] 恒久 redirect
//
// Day 9 で /me/[token] に永続アクセス点を統合。本ファイルは互換性のための
// 308 redirect (permanentRedirect、検索エンジンには HTTP 301 と同等に解釈される)。
//
// 過去発行された URL (完成通知メール、SNS シェア、口コミ等) を壊さないため、
// page.tsx を残し redirect だけ行う。完全削除は将来別タスクで判断。

import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ ownerToken: string }>;
}

export default async function ResultOwnerTokenPage({ params }: PageProps) {
  const { ownerToken } = await params;
  permanentRedirect(`/me/${ownerToken}`);
}
