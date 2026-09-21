import type { Metadata } from "next";
import LoginPageContent from "@/components/login/LoginPageContent";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: { absolute: "Sign in | Alice Personalities" },
  alternates: localizedAlternates("en", "/login", "/ko/login", "/en/login", "/id/login"),
  robots: { index: false, follow: false },
};

export default function EnglishLoginPage() {
  return <LoginPageContent locale="en" />;
}
