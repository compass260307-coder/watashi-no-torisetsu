"use client";

import { resetLocalData } from "@/lib/reset-data";

export default function ResetResultSection() {
  return (
    <section id="reset-result" className="mx-auto w-[calc(100%-2rem)] max-w-5xl scroll-mt-28 border-y border-slate-200 px-4 py-8 text-center md:py-10">
      <p className="text-sm text-slate-600">
        診断をやり直しますか？
      </p>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("このブラウザーから結果へのアクセス情報を削除して、トップページに戻りますか？ 診断結果・友達の回答・購入情報はサーバーに残ります。")) {
            resetLocalData();
          }
        }}
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-600"
      >
        <span aria-hidden="true" className="text-lg leading-none">↻</span>
        このブラウザーから結果を削除
      </button>
    </section>
  );
}
