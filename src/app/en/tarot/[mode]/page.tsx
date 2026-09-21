import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import { EN_TAROT_MODES, isTarotMode, TAROT_MODE_IDS } from "@/components/tarot/tarot-data";
import { requireTarotAccess } from "@/lib/tarot/access";
import { localizedAlternates } from "@/lib/locale-seo";

type Props = { params: Promise<{ mode: string }> };

export function generateStaticParams() {
  return TAROT_MODE_IDS.map((mode) => ({ mode }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mode } = await params;
  if (!isTarotMode(mode)) return {};
  return {
    title: `${EN_TAROT_MODES[mode].title} | Alice Tarot`,
    description: EN_TAROT_MODES[mode].lead,
    alternates: localizedAlternates(
      "en",
      `/tarot/${mode}`,
      `/ko/tarot/${mode}`,
      `/en/tarot/${mode}`,
      `/id/tarot/${mode}`,
    ),
  };
}

export default async function EnglishTarotModePage({ params }: Props) {
  const { mode } = await params;
  if (!isTarotMode(mode)) notFound();
  await requireTarotAccess("en");
  return <TarotDrawExperience mode={mode} locale="en" />;
}
