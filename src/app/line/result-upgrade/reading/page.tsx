import ResultUpgradeReadingPageContent from "@/components/result-upgrade/ResultUpgradeReadingPageContent";
export const dynamic = "force-dynamic";
export const metadata = { title: "専用鑑定書 | Alice", robots: { index: false, follow: false } };
export default function Page() { return <ResultUpgradeReadingPageContent locale="ja" salesChannel="line" />; }
