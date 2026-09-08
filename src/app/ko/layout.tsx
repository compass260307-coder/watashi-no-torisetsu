import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { DocumentLanguage } from "@/components/DocumentLanguage";
import { KakaoSdkLoader } from "@/components/KakaoSdkLoader";
import {
  KO_DEFAULT_DESCRIPTION,
  KO_DEFAULT_OG_IMAGE,
  KO_DEFAULT_TITLE,
  KO_SEO_KEYWORDS,
  KO_SITE_NAME,
} from "@/lib/locale-seo";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: KO_DEFAULT_TITLE,
    template: "%s｜나의 사용설명서",
  },
  description: KO_DEFAULT_DESCRIPTION,
  applicationName: KO_SITE_NAME,
  keywords: KO_SEO_KEYWORDS,
  authors: [{ name: "나의 사용설명서 운영팀" }],
  creator: "나의 사용설명서 운영팀",
  publisher: "나의 사용설명서 운영팀",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    siteName: KO_SITE_NAME,
    title: KO_DEFAULT_TITLE,
    description: KO_DEFAULT_DESCRIPTION,
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: KO_DEFAULT_TITLE,
    description: KO_DEFAULT_DESCRIPTION,
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function KoreanLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div lang="ko" className={`${notoSansKR.className} flex min-h-dvh flex-1 flex-col`}>
      <DocumentLanguage lang="ko" />
      <KakaoSdkLoader />
      {children}
    </div>
  );
}
