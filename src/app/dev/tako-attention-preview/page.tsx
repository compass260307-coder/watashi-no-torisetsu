import { notFound } from "next/navigation";

export default function TakoAttentionPreviewPage() {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="flex min-h-[calc(100dvh-56px)] items-center justify-center bg-[#F6F7FB] px-6 py-16 text-center">
      <div className="w-full max-w-[420px] rounded-3xl border border-[#E3E6F5] bg-white px-6 py-8 shadow-sm">
        <p className="text-[11px] font-black tracking-[0.14em] text-[#5B5BEF]">
          LOCAL PREVIEW
        </p>
        <h1 className="mt-2 text-[22px] font-black text-[#2A3A5C]">
          友達診断のお知らせ表示
        </h1>
        <p className="mt-4 text-[13px] font-bold leading-[1.8] text-[#7A8498]">
          下の「友達診断」アイコン右上にある
          <br />
          赤色の「！」を確認してください。
        </p>
        <p className="mt-5 rounded-2xl bg-[#F1F1FF] px-4 py-3 text-[12px] font-bold leading-[1.7] text-[#45457A]">
          「友達診断」を押すとローカルのプレビューへ進み、
          <br />
          次の画面では「！」が消えます。
        </p>
      </div>
    </main>
  );
}
