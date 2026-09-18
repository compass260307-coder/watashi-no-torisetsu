import type { Metadata } from "next";
import ReportPage from "@/app/report/[token]/print/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Laporan Lengkap | Panduan Kepribadian Saya",
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IndonesianReportPrintPage({
  params,
  searchParams,
}: Props) {
  const query = await searchParams;
  return ReportPage({
    params,
    searchParams: Promise.resolve({ ...query, locale: "id" }),
  });
}
