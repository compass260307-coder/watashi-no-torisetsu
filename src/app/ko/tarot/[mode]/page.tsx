import { isTarotTheme } from "@/components/tarot/tarot-themes";
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
  searchParams?: Promise<{ theme?: string | string[] }>;
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

export default async function KoreanTarotModePage({ params, searchParams }: PageProps) {
  const { mode } = await params;
  if (!isTarotMode(mode)) notFound();
  await requireTarotAccess("ko");

  // 日本語版と同じく、トップの3テーマ (恋愛 / 仕事 / 友人) から来た3枚引きはテーマ別に読み解く。
  const theme = (await searchParams)?.theme;
  return (
    <TarotDrawExperience
      mode={mode}
      locale="ko"
      theme={mode === "three" && isTarotTheme(theme) ? theme : undefined}
    />
  );
}
