import type { Metadata } from "next";
import { DocumentLanguage } from "@/components/DocumentLanguage";
import {
  KO_DEFAULT_DESCRIPTION,
  KO_DEFAULT_OG_IMAGE,
  KO_DEFAULT_TITLE,
  KO_SEO_KEYWORDS,
  KO_SITE_NAME,
} from "@/lib/locale-seo";

// 日本語版と同様にGoogleから直接配信し、分割フォントのVercel課金を抑える。
// 書体・ウェイトは従来どおり。接続ヒントはルートlayoutで共有する。
const KOREAN_FONTS_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap";

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
    <div
      lang="ko"
      className="flex min-h-dvh flex-1 flex-col"
      style={{
        fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
      }}
    >
      {/* Reactがheadへ移動・重複排除し、韓国語ページでのみ読み込む。 */}
      <link rel="stylesheet" href={KOREAN_FONTS_CSS_URL} precedence="default" />
      <DocumentLanguage lang="ko" />
      {children}
    </div>
  );
}
