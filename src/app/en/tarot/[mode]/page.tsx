import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import { EN_TAROT_MODES, isTarotMode, TAROT_MODE_IDS } from "@/components/tarot/tarot-data";
import { hasTarotAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ mode: string }> };

export function generateStaticParams() {
  return TAROT_MODE_IDS.map((mode) => ({ mode }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mode } = await params;
  if (!isTarotMode(mode)) return {};
  return { title: `${EN_TAROT_MODES[mode].title} | Alice Tarot`, description: EN_TAROT_MODES[mode].lead };
}

export default async function EnglishTarotModePage({ params }: Props) {
  const { mode } = await params;
  if (!isTarotMode(mode)) notFound();
  const session = await getSession();
  const purchased = session?.id ? await hasTarotAccess(session.id) : false;
  if (!purchased) redirect("/en/tarot");
  return <><EnSiteHeader /><TarotDrawExperience mode={mode} locale="en" /><EnSiteFooter /></>;
}
