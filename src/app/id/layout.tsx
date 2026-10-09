import { GLOBAL_SITE_NAME } from "@/lib/locale-seo";
import type { Metadata } from "next";
import { DocumentLanguage } from "@/components/DocumentLanguage";

const TITLE = `${GLOBAL_SITE_NAME} – Tes Kepribadian Big Five Gratis`;
const DESCRIPTION = "Jawab 50 pertanyaan, temukan tipe kepribadian Big Five Anda dari 32 karakter, dan pahami kekuatan serta ruang tumbuh Anda.";

export const metadata: Metadata = {
  title: { absolute: TITLE, template: `%s | ${GLOBAL_SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: GLOBAL_SITE_NAME,
  authors: [{ name: "Tim Alice Personalities" }],
  creator: "Tim Alice Personalities",
  publisher: "Tim Alice Personalities",
  keywords: ["tes kepribadian", "tes kepribadian gratis", "Big Five", "OCEAN", "32 tipe kepribadian", "Alice Test"],
  openGraph: {
    type: "website",
    locale: "id_ID",
    alternateLocale: ["ja_JP", "ko_KR", "en_US"],
    siteName: GLOBAL_SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024, alt: "Karakter kepribadian Alice Test" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
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

export default function IndonesianLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div lang="id" className="flex min-h-dvh flex-1 flex-col">
      <DocumentLanguage lang="id" />
      {children}
    </div>
  );
}
