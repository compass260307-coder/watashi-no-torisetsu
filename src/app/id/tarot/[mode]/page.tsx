import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import {
  ID_TAROT_MODES,
  isTarotMode,
  TAROT_MODE_IDS,
} from "@/components/tarot/tarot-data";
import { requireTarotAccess } from "@/lib/tarot/access";
import { localizedAlternates } from "@/lib/locale-seo";

type PageProps = { params: Promise<{ mode: string }> };

export function generateStaticParams() {
  return TAROT_MODE_IDS.map((mode) => ({ mode }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mode } = await params;
  if (!isTarotMode(mode)) return {};
  return {
    title: `${ID_TAROT_MODES[mode].title} | Tarot bersama Alice`,
    description: ID_TAROT_MODES[mode].lead,
    alternates: localizedAlternates(
      "id",
      `/tarot/${mode}`,
      `/ko/tarot/${mode}`,
      `/en/tarot/${mode}`,
      `/id/tarot/${mode}`,
    ),
  };
}

export default async function IndonesianTarotModePage({ params }: PageProps) {
  const { mode } = await params;
  if (!isTarotMode(mode)) notFound();
  await requireTarotAccess("id");
  return <TarotDrawExperience mode={mode} locale="id" />;
}
