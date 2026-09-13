import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MeResultPage from "@/components/result/MeResultPage";
import { EN_RESULT_TYPES } from "@/i18n/en/result";
import { SITE_URL } from "@/lib/locale-seo";
import { allThirtyTwoTypeIds, type ThirtyTwoTypeId } from "@/lib/thirty-two-types";

type Props = { params: Promise<{ typeId: string }> };

const TYPE_IDS = allThirtyTwoTypeIds();
const TYPE_ID_SET = new Set<string>(TYPE_IDS);

export const dynamicParams = false;

export function generateStaticParams() {
  return TYPE_IDS.map((typeId) => ({ typeId }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { typeId } = await params;
  if (!TYPE_ID_SET.has(typeId)) return {};
  const type = EN_RESULT_TYPES[typeId as ThirtyTwoTypeId];
  const japanesePath = `/preview/${typeId}`;
  const koreanPath = `/ko/preview/${typeId}`;
  const englishPath = `/en/preview/${typeId}`;
  return {
    title: `${type.name} — ${type.essence}`,
    description: type.oneLiner,
    alternates: {
      canonical: englishPath,
      languages: { "ja-JP": japanesePath, "ko-KR": koreanPath, "en-US": englishPath, "x-default": japanesePath },
    },
    openGraph: {
      locale: "en_US",
      alternateLocale: ["ja_JP", "ko_KR"],
      url: `${SITE_URL}${englishPath}`,
      title: `${type.name} | Alice Test`,
      description: type.oneLiner,
      siteName: "Alice Test",
      images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024, alt: `${type.name} personality type` }],
    },
    twitter: { card: "summary_large_image", title: `${type.name} | Alice Test`, description: type.oneLiner, images: ["/characters/keyvisual.webp"] },
    robots: { index: true, follow: true },
  };
}

export default async function EnglishPreviewTypePage({ params }: Props) {
  const { typeId } = await params;
  if (!TYPE_ID_SET.has(typeId)) notFound();
  return (
    <MeResultPage
      params={Promise.resolve({ token: "preview" })}
      searchParams={Promise.resolve({
        previewType: typeId,
        previewLock: "1",
        fromPreview: "1",
      })}
      locale="en"
    />
  );
}
