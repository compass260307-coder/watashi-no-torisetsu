import { notFound } from "next/navigation";

export default function BottomNavPaywallPreviewPage() {
  // 実データ・計測・Stripe決済を動かさず、下部ナビから実物の課金カードを確認する。
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="flex min-h-[calc(100dvh-56px)] items-center justify-center bg-[#F6F7FB] px-6 py-16 text-center">
      <section className="w-full max-w-[460px] rounded-3xl border border-[#E3E6F5] bg-white px-6 py-8 shadow-sm">
        <p className="text-[11px] font-black tracking-[0.14em] text-[#5B5BEF]">
          LOCAL PREVIEW
        </p>
        <h1 className="mt-2 text-[22px] font-black leading-snug text-[#2A3A5C]">
          下部バーの課金カード確認
        </h1>
        <p className="mt-4 text-[13px] font-bold leading-[1.8] text-[#7A8498]">
          下の「運命」のロックを押すと、
          <br />
          実際の課金カードが開きます。
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-2xl bg-[#F1F1FF] px-4 py-3">
            <p className="text-[13px] font-black text-[#45457A]">Alice</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-[#747492]">
              未課金でもタブから閲覧できます
            </p>
          </div>
          <div className="rounded-2xl bg-[#FFF6DF] px-4 py-3">
            <p className="text-[13px] font-black text-[#7A541E]">運命</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-[#8C744E]">
              運命から開く課金カード
            </p>
          </div>
        </div>
        <p className="mt-5 rounded-2xl bg-[#F7F8FC] px-4 py-3 text-[11px] font-bold leading-[1.7] text-[#7A8498]">
          プレビュー中は計測・権限確認・Stripe決済を実行しません。
        </p>
      </section>
    </main>
  );
}
