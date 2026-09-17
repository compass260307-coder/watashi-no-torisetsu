import type { Metadata } from "next";
import TakoReportPrintPage from "@/app/tako-report/[token]/print/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "PDF Analisis Teman | Alice Personalities",
  robots: { index: false, follow: false },
};

export default function IndonesianFriendReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return TakoReportPrintPage({
    params,
    searchParams: searchParams.then((values) => ({ ...values, locale: "id" })),
  });
}
