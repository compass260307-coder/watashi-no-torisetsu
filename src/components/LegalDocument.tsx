import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export default function LegalDocument({ title, lastUpdated, children }: Props) {
  return (
    <main className="min-h-screen bg-white">
      <div className="border-b border-pink-100 bg-gradient-to-b from-pink-50 to-white">
        <div className="max-w-3xl mx-auto px-5 py-10">
          <h1 className="text-3xl font-extrabold text-foreground mb-2">
            {title}
          </h1>
          <p className="text-sm text-muted">最終更新日: {lastUpdated}</p>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-5 py-10">
        <div className="prose-legal text-foreground">{children}</div>
      </article>

      <div className="max-w-3xl mx-auto px-5 pb-10 border-t border-pink-100 pt-6 mt-6">
        <div className="flex gap-6 text-sm">
          <Link href="/" className="text-pink-500 hover:underline">
            トップに戻る
          </Link>
          <Link href="/about" className="text-muted hover:underline">
            サービスについて
          </Link>
        </div>
      </div>
    </main>
  );
}
