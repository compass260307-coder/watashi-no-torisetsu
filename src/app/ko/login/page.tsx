import type { Metadata } from "next";
import Link from "next/link";
import { LoginCard } from "@/components/LoginCard";

const NAVY = "#2E2E5C";

export const metadata: Metadata = {
  title: { absolute: "로그인 | 나의 사용설명서" },
  robots: { index: false, follow: false },
};

export default function KoreanLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-[#F1F1F7] px-5 py-14">
      <LoginCard locale="ko" />
      <Link
        href="/ko"
        className="mt-8 text-center text-[12px] underline underline-offset-2 transition-colors hover:opacity-70"
        style={{ color: `${NAVY}80` }}
      >
        홈으로 돌아가기
      </Link>
    </main>
  );
}
