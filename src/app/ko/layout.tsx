import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  applicationName: "나의 사용설명서",
  authors: [{ name: "나의 사용설명서 운영팀" }],
  creator: "나의 사용설명서 운영팀",
  publisher: "나의 사용설명서 운영팀",
};

export default function KoreanLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div lang="ko" className={`${notoSansKR.className} flex min-h-dvh flex-1 flex-col`}>
      {children}
    </div>
  );
}
