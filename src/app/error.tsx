"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 bg-gradient-to-b from-pink-50 to-white">
      <div className="text-center max-w-md">
        <Image
          src="/mascot/analyzing-penguin.png"
          alt=""
          width={144}
          height={144}
          priority
          className="mx-auto mb-6 w-32 h-32 object-contain"
        />
        <h1 className="text-2xl font-extrabold text-foreground mb-3">
          ごめんなさい、エラーが発生しました🐧
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-8">
          一時的な問題かもしれません。
          <br />
          もう一度お試しください。
        </p>
        <div className="flex flex-col gap-3 items-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            もう一度試す
          </button>
          <Link
            href="/"
            className="text-sm text-pink-500 hover:underline mt-2"
          >
            トップに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
