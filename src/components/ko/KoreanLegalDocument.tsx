import Link from "next/link";
import type { ReactNode } from "react";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";

type Props = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export default function KoreanLegalDocument({
  title,
  lastUpdated,
  children,
}: Props) {
  return (
    <>
      <KoTopHeader />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-5 pt-14 pb-4">
          <h1 className="text-3xl leading-tight font-extrabold text-[#2E2E5C] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-gray-500">
            최종 업데이트: {lastUpdated}
          </p>
        </div>

        <article className="mx-auto max-w-3xl px-5 py-8">
          <div className="prose-legal text-[#2E2E5C]">{children}</div>
        </article>

        <div className="mx-auto mt-4 max-w-3xl border-t border-gray-200 px-5 pt-6 pb-12">
          <div className="flex flex-wrap gap-6 text-sm">
            <Link href="/ko" className="text-[#5B5BEF] hover:underline">
              홈으로 돌아가기
            </Link>
            <Link
              href="/ko/diagnosis"
              className="text-gray-500 hover:underline"
            >
              성격 진단 시작하기
            </Link>
          </div>
        </div>
      </main>
      <KoTopFooter />
    </>
  );
}
