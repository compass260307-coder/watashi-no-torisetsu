import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "친구 진단",
  description: "친구의 눈에 비친 모습을 30개 질문으로 알려 주세요.",
  alternates: localizedAlternates("ko", "/tako", "/ko/tako"),
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "나의 사용설명서",
    title: "친구 진단 | 나의 사용설명서",
    description: "친구의 눈에 비친 모습을 30개 질문으로 알려 주세요.",
    images: [
      {
        url: "/ogp-v4.png",
        width: 1200,
        height: 630,
        alt: "나의 사용설명서 친구 진단",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "친구 진단 | 나의 사용설명서",
    description: "친구의 눈에 비친 모습을 30개 질문으로 알려 주세요.",
    images: ["/ogp-v4.png"],
  },
};

export default function KoreanFriendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
