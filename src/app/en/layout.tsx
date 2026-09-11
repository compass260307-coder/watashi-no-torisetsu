import type { Metadata } from "next";
import { DocumentLanguage } from "@/components/DocumentLanguage";

export const metadata: Metadata = {
  title: { default: "Alice Diagnosis", template: "%s | Alice Diagnosis" },
  description: "A free Big Five personality test that matches you with one of 32 character types.",
  applicationName: "Alice Diagnosis",
  keywords: [
    "Alice Diagnosis",
    "free personality test",
    "Big Five personality test",
    "OCEAN personality test",
    "32 personality types",
    "friend personality test",
    "self discovery",
  ],
  authors: [{ name: "Alice Diagnosis" }],
  creator: "Alice Diagnosis",
  publisher: "Alice Diagnosis",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ja_JP", "ko_KR"],
    siteName: "Alice Diagnosis",
    title: "Alice Diagnosis | Free Big Five Personality Test",
    description: "A free Big Five personality test that matches you with one of 32 character types.",
    images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024, alt: "Alice Diagnosis personality test characters" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alice Diagnosis | Free Big Five Personality Test",
    description: "A free Big Five personality test that matches you with one of 32 character types.",
    images: ["/characters/keyvisual.webp"],
  },
  robots: { index: true, follow: true },
};

export default function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div lang="en" className="flex min-h-dvh flex-1 flex-col">
      <DocumentLanguage lang="en" />
      {children}
    </div>
  );
}
