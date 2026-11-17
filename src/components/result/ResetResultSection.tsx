"use client";

import { resetLocalData } from "@/lib/reset-data";

const COPY = {
  ja: {
    lead: "診断をやり直しますか？",
    confirm:
      "このブラウザーから結果へのアクセス情報を削除して、トップページに戻りますか？ 診断結果・友達の回答・購入情報はサーバーに残ります。",
    button: "このブラウザーから結果を削除",
    homePath: "/",
  },
  ko: {
    lead: "진단을 다시 할까요?",
    confirm:
      "이 브라우저에서 결과에 접근하는 정보를 삭제하고 첫 화면으로 돌아갈까요? 진단 결과·친구의 답변·구매 정보는 서버에 남아 있어요.",
    button: "이 브라우저에서 결과 삭제",
    homePath: "/ko",
  },
} as const;

export default function ResetResultSection({
  locale = "ja",
}: {
  locale?: "ja" | "ko";
}) {
  const copy = COPY[locale];
  return (
    <section id="reset-result" className="mx-auto w-[calc(100%-2rem)] max-w-5xl scroll-mt-28 border-y border-slate-200 px-4 py-8 text-center md:py-10">
      <p className="text-sm text-slate-600">
        {copy.lead}
      </p>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(copy.confirm)) {
            resetLocalData(copy.homePath);
          }
        }}
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-600"
      >
        <span aria-hidden="true" className="text-lg leading-none">↻</span>
        {copy.button}
      </button>
    </section>
  );
}
