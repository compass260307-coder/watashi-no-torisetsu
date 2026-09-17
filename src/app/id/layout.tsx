import type { Metadata } from "next";
import { DocumentLanguage } from "@/components/DocumentLanguage";

const TITLE = "Alice Test – Tes Kepribadian Big Five Gratis";
const DESCRIPTION = "Jawab 50 pertanyaan, temukan tipe kepribadian Big Five Anda dari 32 karakter, dan pahami kekuatan serta ruang tumbuh Anda.";

export const metadata: Metadata = {
  title: { absolute: TITLE, template: "%s | Alice Test" },
  description: DESCRIPTION,
  applicationName: "Alice Test",
  keywords: ["tes kepribadian", "tes kepribadian gratis", "Big Five", "OCEAN", "32 tipe kepribadian", "Alice Test"],
  openGraph: {
    type: "website",
    locale: "id_ID",
    alternateLocale: ["ja_JP", "ko_KR", "en_US"],
    siteName: "Alice Test",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024, alt: "Karakter kepribadian Alice Test" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
  robots: { index: true, follow: true },
};

export default function IndonesianLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div lang="id" className="flex min-h-dvh flex-1 flex-col">
      <DocumentLanguage lang="id" />
      {children}
    </div>
  );
}
