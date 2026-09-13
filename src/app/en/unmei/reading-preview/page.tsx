import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import type { Chart } from "@/lib/unmei/chart-view";

const PREVIEW_READING = {
  locale: "en",
  hitokoto:
    "Your stars hold kindness not merely as a trait, but as the way you connect with the world.",
  sections: [
    {
      id: "haichi",
      title: "The pattern your stars have formed",
      body: "The Sun illuminates what you have learned to value as you move through life. Your personality profile and the pattern of your stars arrive by different paths, yet they point toward the same quiet strength.\n\nYou notice what other people need before they have found the words for it. That sensitivity is not fragility; it is a precise way of reading a room and understanding where warmth can change its atmosphere.",
    },
    {
      id: "kokoro",
      title: "The weather of your heart",
      body: "In relationships, you pick up on small changes in tone and emotional temperature. You often become the person who restores ease without making a show of it.\n\nRemember to offer yourself the same reassurance you give so naturally to others. Your inner world becomes clearer when rest is treated as part of your rhythm rather than a reward you must earn.",
    },
    {
      id: "chosen",
      title: "Where your next challenge leads",
      body: "Your next chapter begins less with a dramatic leap than with choosing by your own standards. The more honestly you name what feels right, the easier it becomes to distinguish devotion from obligation.\n\nSmall decisions made consistently will carry you farther than one perfect answer. Trust the direction that leaves you more present, more curious, and more fully yourself.",
    },
    {
      id: "grace",
      title: "One final message",
      body: "The stars do not describe a fate that has already been decided. They offer a map for understanding the choices that brought you here and the possibilities that are opening now.\n\nYour kindness is strongest when it includes you. Keep that truth close as you step into what comes next.",
    },
  ],
};

const PREVIEW_CHART: Chart = {
  planets: {
    sun: { sign: "Leo", degree: 15.2 },
    moon: { sign: "Pisces", degree: 3.4 },
    mercury: { sign: "Virgo", degree: 2.8 },
    venus: { sign: "Gemini", degree: 28.5 },
    mars: { sign: "Virgo", degree: 10.1 },
    jupiter: { sign: "Virgo", degree: 25.9 },
    saturn: { sign: "Cancer", degree: 18.3 },
  },
  asc: { sign: "Scorpio", degree: 12 },
  mc: { sign: "Leo", degree: 22 },
  houses_available: true,
};

export const metadata: Metadata = {
  title: { absolute: "Destiny Blueprint Preview | Alice Test" },
  robots: { index: false, follow: false },
};

export default function EnglishUnmeiReadingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="min-h-dvh bg-[#F8F8FC]">
      <EnSiteHeader />
      <UnmeiReading
        reading={PREVIEW_READING}
        chart={PREVIEW_CHART}
        essence="Companion"
        characterSlug="dolphin"
        identity={{
          typeName: "Sparkling Dolphin",
          catchphrase: "You meet people with warmth and move with them toward new horizons.",
          groupLabel: "Ocean",
          groupColor: "#8EC5E8",
        }}
        locale="en"
        trackView={false}
      />
      <EnSiteFooter />
    </div>
  );
}
