import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import TopHero from "@/components/top/TopHero";
import TopStats from "@/components/top/TopStats";
import { TopViewTracker } from "@/components/top/TopAnalytics";

const DIAGNOSED_COUNT = 1_000_000;

export default function TopPage({ locale }: { locale: "ja" | "en" }) {
  return (
    <main className="flex flex-1 flex-col">
      <TopViewTracker locale={locale} />
      <TopHeader locale={locale} />
      <TopHero locale={locale} />
      <TopStats diagnosedCount={DIAGNOSED_COUNT} locale={locale} />
      <TopFooter locale={locale} />
    </main>
  );
}
