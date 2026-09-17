import type { Metadata } from "next";
import AboutPageContent from "@/components/about/AboutPageContent";
import { localizedAlternates } from "@/lib/locale-seo";

const DESCRIPTION = "Learn how Alice Test combines a Big Five personality test with friend perspectives to help you see yourself more clearly.";

export const metadata: Metadata = {
  title: "About",
  description: DESCRIPTION,
  alternates: localizedAlternates("en", "/about", "/ko/about", "/en/about"),
  robots: { index: true, follow: true },
};

export default function EnglishAboutPage() {
  return <AboutPageContent locale="en" />;
}
