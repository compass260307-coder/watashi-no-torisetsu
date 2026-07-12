import Link from "next/link";
import type { ReactNode } from "react";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";

type Props = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

// 法務ページ (利用規約 / プライバシー / 特商法) 共通レイアウト。
// ヘッダー・フッターはサイト共通の TopHeader / TopFooter に統一する。
export default function LegalDocument({ title, lastUpdated, children }: Props) {
  return (
    <>
    <TopHeader />
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 pt-14 pb-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight">
          {title}
        </h1>
        <p className="text-sm text-gray-500 mt-4">最終更新日: {lastUpdated}</p>
      </div>

      <article className="max-w-3xl mx-auto px-5 py-8">
        <div className="prose-legal text-foreground">{children}</div>
      </article>

      <div className="max-w-3xl mx-auto px-5 pb-12 border-t border-gray-200 pt-6 mt-4">
        <div className="flex gap-6 text-sm">
          <Link href="/" className="text-[#4298B4] hover:underline">
            トップに戻る
          </Link>
          <Link href="/about" className="text-gray-500 hover:underline">
            サービスについて
          </Link>
        </div>
      </div>
    </main>
    <TopFooter />
    </>
  );
}
