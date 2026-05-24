// プレミアム化 v3 Day 9: 旧 /zukan/[ownerToken] → /me/[ownerToken] 恒久 redirect
// (詳細は src/app/result/[ownerToken]/page.tsx の冒頭コメント参照)

import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ ownerToken: string }>;
}

export default async function ZukanOwnerTokenPage({ params }: PageProps) {
  const { ownerToken } = await params;
  permanentRedirect(`/me/${ownerToken}`);
}
