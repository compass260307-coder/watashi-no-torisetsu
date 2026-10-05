"use client";

import { useEffect } from "react";
import recoveryImage from "../../public/types/penguin-recovery.webp";
import { isChunkLoadError } from "@/lib/chunk-load-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 bg-gradient-to-b from-pink-50 to-white">
      <div className="text-center max-w-md">
        {/* Native fallback avoids downloading the router/image widgets for recovery. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={recoveryImage.src}
          alt=""
          width={144}
          height={144}
          className="mx-auto mb-6 w-32 h-32 object-contain"
        />
        <h1 className="text-2xl font-extrabold text-foreground mb-3">
          ごめんなさい、エラーが発生しました🐧
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-8">
          {chunkError
            ? "ページの読み込みに失敗しました。更新すると、入力中の内容が失われる場合があります。"
            : "一時的な問題かもしれません。もう一度お試しください。"}
        </p>
        <div className="flex flex-col gap-3 items-center">
          <button
            type="button"
            onClick={() => chunkError ? window.location.reload() : reset()}
            className="rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            {chunkError ? "ページを更新" : "もう一度試す"}
          </button>
          {/* Hard navigation also works if the application router failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="text-sm text-pink-500 hover:underline mt-2"
          >
            トップに戻る
          </a>
        </div>
      </div>
    </main>
  );
}
