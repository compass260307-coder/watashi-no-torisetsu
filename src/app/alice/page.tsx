import type { Metadata } from "next";
import Link from "next/link";

import { AliceTransferCodeClient } from "./AliceTransferCodeClient";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Aliceへ診断結果を引き継ぐ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AliceTransferPage() {
  const session = await getSession();

  return (
    <>
      <TopHeader />
      <main className="min-h-[70vh] bg-[#F7F8FC] px-5 py-12">
        <div className="mx-auto max-w-xl">
          <p className="text-center text-sm font-black tracking-[0.18em] text-[#3568F4]">ALICE APP</p>
          <h1 className="mt-3 text-center text-3xl font-black leading-tight text-[#172A63] sm:text-4xl">
            Web診断をAliceへ引き継ぐ
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-center text-sm leading-7 text-[#5B6683]">
            診断結果そのものはコードに含まれません。短時間だけ有効なコードを使い、Aliceアプリのアカウントへ安全に複製します。
          </p>

          {session ? (
            <AliceTransferCodeClient />
          ) : (
            <section className="mt-8 rounded-3xl border border-[#DDE5FF] bg-white p-8 text-center shadow-[0_18px_50px_rgba(23,42,99,0.10)]">
              <h2 className="text-xl font-black text-[#172A63]">Webでのログインが必要です</h2>
              <p className="mt-3 text-sm leading-7 text-[#5B6683]">
                診断時に使用したメールアドレスでログインしたあと、このページへ戻ってください。
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#3568F4] px-8 text-base font-bold text-white shadow-[0_4px_0_#2455D9]"
              >
                ログインする
              </Link>
            </section>
          )}
        </div>
      </main>
      <TopFooter />
    </>
  );
}
