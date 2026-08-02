import type { Metadata } from "next";
import {
  KO_DEFAULT_OG_IMAGE,
  KO_SITE_NAME,
  localizedAlternates,
} from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "친구 진단",
  description: "친구의 눈에 비친 모습을 30개 질문으로 알려 주세요.",
  alternates: localizedAlternates("ko", "/tako", "/ko/tako"),
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: KO_SITE_NAME,
    title: "친구 진단 | 나의 사용설명서",
    description: "친구의 눈에 비친 모습을 30개 질문으로 알려 주세요.",
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "친구 진단 | 나의 사용설명서",
    description: "친구의 눈에 비친 모습을 30개 질문으로 알려 주세요.",
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
};

export default function KoreanFriendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
