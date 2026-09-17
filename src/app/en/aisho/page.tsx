import type { Metadata } from "next";
import AishoPage from "@/components/aisho/AishoPage";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Compatibility",
  description: "Choose two of the 32 personality types and explore how their relationship works.",
  alternates: localizedAlternates("en", "/aisho", "/ko/aisho", "/en/aisho"),
};

export default function EnglishCompatibilityPage() {
  return <AishoPage locale="en" />;
}
