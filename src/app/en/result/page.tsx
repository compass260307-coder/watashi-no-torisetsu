import type { Metadata } from "next";
import ResultRedirect from "@/components/result/ResultRedirect";

export const metadata: Metadata = { title: "Loading your result", robots: { index: false, follow: false } };

export default function EnglishResultPage() {
  return <ResultRedirect locale="en" />;
}
