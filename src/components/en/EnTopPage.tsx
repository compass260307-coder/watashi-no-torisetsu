import { TopViewTracker } from "@/components/top/TopAnalytics";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import TopHero from "@/components/top/TopHero";
import TopStats from "@/components/top/TopStats";
import EnSeoContent from "@/components/en/EnSeoContent";

const DIAGNOSED_COUNT = 1_000_000;

export default function EnTopPage() {
  return (
    <main className="flex flex-1 flex-col">
      <TopViewTracker locale="en" />
      <TopHeader locale="en" />
      <TopHero locale="en" />
      <TopStats diagnosedCount={DIAGNOSED_COUNT} locale="en" />
      <EnSeoContent />
      <TopFooter locale="en" />
    </main>
  );
}
