import type { Metadata } from "next";

// 親 /zukan の layout は個人図鑑 ([ownerToken]) 向けに全体 noindex を敷いているが、
// /zukan/all は公開の全タイプ図鑑 (トップのナビ「性格タイプ」のリンク先) のため
// ここでインデックス許可 + title/description/canonical を上書きする。
// robots.txt (src/app/robots.ts) 側でも /zukan/all だけ allow 済み。
export const metadata: Metadata = {
  title: "性格タイプ図鑑",
  description:
    "ワタシのトリセツの性格タイプを一覧で紹介。Big Five理論ベースの性格診断でわかる、あなたと友達のタイプをキャラクターでチェックしよう。",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "https://www.watashi-torisetsu.com/zukan/all",
  },
};

export default function ZukanAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
