"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SmoothImage } from "@/components/ui/SmoothImage";

const COPY = {
  ja: {
    title: "ページが見つかりませんでした",
    description: "URL が間違っているか、ページが移動された可能性があります。",
    cta: "トップに戻る",
    homeHref: "/",
  },
  ko: {
    title: "페이지를 찾을 수 없습니다",
    description: "URL이 잘못되었거나 페이지가 이동되었을 수 있습니다.",
    cta: "홈으로 돌아가기",
    homeHref: "/ko",
  },
} as const;

export function LocalizedNotFound() {
  const pathname = usePathname();
  const locale = pathname === "/ko" || pathname.startsWith("/ko/") ? "ko" : "ja";
  const copy = COPY[locale];

  return (
    <main
      lang={locale}
      className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-white px-5 py-10"
    >
      <div className="max-w-md text-center">
        <SmoothImage
          src="/types/penguin-base.png"
          alt=""
          width={144}
          height={144}
          priority
          className="mx-auto mb-6 h-32 w-32 object-contain"
        />
        <p className="mb-2 text-5xl font-extrabold text-pink-500">404</p>
        <h1 className="mb-2 text-xl font-bold text-foreground">{copy.title}</h1>
        <p className="mb-8 text-sm leading-relaxed text-muted">{copy.description}</p>
        <Link
          href={copy.homeHref}
          className="inline-block rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {copy.cta}
        </Link>
      </div>
    </main>
  );
}
