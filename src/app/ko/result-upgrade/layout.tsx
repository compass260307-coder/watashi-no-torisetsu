import type { Metadata } from "next";
export const metadata: Metadata = { title: "결과 업그레이드", robots: { index: false, follow: false } };
export default function PrivateUpgradeLayout({ children }: { children: React.ReactNode }) { return children; }
