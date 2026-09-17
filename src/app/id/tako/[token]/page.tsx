import type { Metadata } from "next";
import { TakoResultPage } from "@/components/result/TakoResultPage";

export const metadata: Metadata = {
  title: "Cara teman melihatku",
  robots: { index: false, follow: false },
};

export default function IndonesianTakoResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return TakoResultPage({ params, searchParams, locale: "id" });
}
