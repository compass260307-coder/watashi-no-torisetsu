import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import {
  isTarotMode,
  KO_TAROT_MODES,
  TAROT_MODE_IDS,
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
    title: `${KO_TAROT_MODES[mode].title} | Alice 타로`,
    description: KO_TAROT_MODES[mode].lead,
    alternates: localizedAlternates(
      "ko",
      `/tarot/${mode}`,
      `/ko/tarot/${mode}`,
    ),
  };
}

export default async function KoreanTarotModePage({ params }: PageProps) {
  const { mode } = await params;
  if (!isTarotMode(mode)) notFound();
  await requireTarotAccess("ko");

  return <TarotDrawExperience mode={mode} locale="ko" />;
}
