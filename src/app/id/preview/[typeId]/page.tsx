import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MeResultPage from "@/components/result/MeResultPage";
import { ID_RESULT_TYPES } from "@/i18n/id/result";
import { SITE_URL } from "@/lib/locale-seo";
import { allThirtyTwoTypeIds, type ThirtyTwoTypeId } from "@/lib/thirty-two-types";

type Props = { params: Promise<{ typeId: string }> };
const TYPE_IDS = allThirtyTwoTypeIds();
const TYPE_ID_SET = new Set<string>(TYPE_IDS);

export const dynamicParams = false;
export function generateStaticParams() { return TYPE_IDS.map((typeId) => ({ typeId })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { typeId } = await params;
  if (!TYPE_ID_SET.has(typeId)) return {};
  const type = ID_RESULT_TYPES[typeId as ThirtyTwoTypeId];
  const idPath = `/id/preview/${typeId}`;
  return {
    title: `${type.name} — ${type.essence}`,
    description: type.oneLiner,
    alternates: { canonical: idPath, languages: { "ja-JP": `/preview/${typeId}`, "ko-KR": `/ko/preview/${typeId}`, "en-US": `/en/preview/${typeId}`, "id-ID": idPath, "x-default": `/preview/${typeId}` } },
    openGraph: { locale: "id_ID", alternateLocale: ["ja_JP", "ko_KR", "en_US"], url: `${SITE_URL}${idPath}`, title: `${type.name} | Alice Test`, description: type.oneLiner, siteName: "Alice Test", images: ["/characters/keyvisual.webp"] },
    robots: { index: true, follow: true },
  };
}

export default async function IndonesianPreviewTypePage({ params }: Props) {
  const { typeId } = await params;
  if (!TYPE_ID_SET.has(typeId)) notFound();
  return <MeResultPage params={Promise.resolve({ token: "preview" })} searchParams={Promise.resolve({ previewType: typeId, previewLock: "1", fromPreview: "1" })} locale="id" />;
}
