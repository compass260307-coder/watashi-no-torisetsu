import ResultUpgradePageContent from "@/components/result-upgrade/ResultUpgradePageContent";
export const dynamic = "force-dynamic";
export const metadata = { title: "結果アップグレード | Alice", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const params = await searchParams;
  return <ResultUpgradePageContent locale="ja" salesChannel="line" paymentReturned={params.paid === "1"} />;
}
