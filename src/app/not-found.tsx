import { SmoothImage } from "@/components/ui/SmoothImage";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 bg-gradient-to-b from-pink-50 to-white">
      <div className="text-center max-w-md">
        <SmoothImage
          src="/types/penguin-base.png"
          alt=""
          width={144}
          height={144}
          priority
          className="mx-auto mb-6 w-32 h-32 object-contain"
        />
        <p className="text-5xl font-extrabold text-pink-500 mb-2">404</p>
        <h1 className="text-xl font-bold text-foreground mb-2">
          ページが見つかりませんでした
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-8">
          URL が間違っているか、
          <br />
          ページが移動された可能性があります。
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          トップに戻る
        </Link>
      </div>
    </main>
  );
}
