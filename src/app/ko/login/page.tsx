import type { Metadata } from "next";
import { LoginCard } from "@/components/LoginCard";
import { SmoothImage } from "@/components/ui/SmoothImage";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import { localizedAlternates } from "@/lib/locale-seo";

const NAVY = "#2E2E5C";

export const metadata: Metadata = {
  title: { absolute: "로그인 | 나의 사용설명서" },
  alternates: localizedAlternates("ko", "/login", "/ko/login"),
};

// 日本語 /login と同じデザイン (2026-07-30 改良): サイト共通chrome +
// おかえり感のキャラ挿絵 + ポップな見出し。カード本体は共有 LoginCard。
export default function KoreanLoginPage() {
  return (
    <>
      <KoTopHeader />
      <main className="flex flex-1 flex-col items-center bg-[#F1F1F7] px-5 pb-16 pt-8 md:pt-12">
        <SmoothImage
          src="/characters/cut/dog_R.webp"
          alt=""
          width={480}
          height={480}
          priority
          className="h-auto w-[190px] md:w-[230px]"
        />
        <h1
          className="mt-1 break-keep text-center text-[26px] font-black leading-snug md:text-[30px]"
          style={{ color: NAVY }}
        >
          어서 오세요!
        </h1>
        <p
          className="mt-2 mb-6 break-keep text-center text-[13px] font-bold leading-[1.9]"
          style={{ color: `${NAVY}99` }}
        >
          이메일로 받은 링크를 누르기만 하면 돼요.
          <br />
          비밀번호는 필요 없어요.
        </p>
        <LoginCard locale="ko" />
      </main>
      <KoTopFooter />
    </>
  );
}
