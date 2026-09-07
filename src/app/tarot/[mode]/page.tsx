import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import {
  isTarotMode,
  TAROT_MODE_IDS,
  TAROT_MODES,
} from "@/components/tarot/tarot-data";
import { requireTarotAccess } from "@/lib/tarot/access";
import { localizedAlternates } from "@/lib/locale-seo";

type PageProps = {
  params: Promise<{ mode: string }>;
};

export function generateStaticParams() {
  return TAROT_MODE_IDS.map((mode) => ({ mode }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mode } = await params;
  if (!isTarotMode(mode)) return {};
  return {
    title: `${TAROT_MODES[mode].title}｜Aliceのタロット占い`,
    description: TAROT_MODES[mode].lead,
    alternates: localizedAlternates(
      "ja",
      `/tarot/${mode}`,
      `/ko/tarot/${mode}`,
    ),
  };
}

export default async function TarotModePage({ params }: PageProps) {
  const { mode } = await params;
  if (!isTarotMode(mode)) notFound();
  await requireTarotAccess("ja");

  return <TarotDrawExperience mode={mode} />;
}
