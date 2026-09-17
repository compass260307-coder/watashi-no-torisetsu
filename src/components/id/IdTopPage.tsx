import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import TopHero from "@/components/top/TopHero";
import TopStats from "@/components/top/TopStats";
import { TopViewTracker } from "@/components/top/TopAnalytics";

export default function IdTopPage() {
  return (
    <main className="flex flex-1 flex-col">
      <TopViewTracker locale="id" />
      <TopHeader locale="id" />
      <TopHero locale="id" />
      <TopStats diagnosedCount={1_000_000} locale="id" />
      <TopFooter locale="id" />
    </main>
  );
}
