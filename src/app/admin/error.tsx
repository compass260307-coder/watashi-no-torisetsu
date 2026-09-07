"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] dashboard render failed", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4 text-[#172033]">
      <div className="w-full max-w-md rounded-3xl border border-[#e1e5ed] bg-white p-8 text-center shadow-[0_24px_70px_rgba(38,49,86,0.12)]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff1ee] text-xl text-[#b42318]">
          !
        </span>
        <h1 className="mt-6 text-xl font-semibold">管理画面を表示できませんでした</h1>
        <p className="mt-3 text-sm leading-6 text-[#738096]">
          一時的な表示エラーです。再読み込みしても解決しない場合は、集計APIのレスポンスを確認してください。
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 w-full rounded-2xl bg-[#405fd4] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3452c5]"
        >
          もう一度試す
        </button>
      </div>
    </main>
  );
}
