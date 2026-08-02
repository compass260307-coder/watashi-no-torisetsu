import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MeResultPage from "@/components/result/MeResultPage";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import { KO_TYPE_ZUKAN_DESCRIPTIONS } from "@/i18n/ko/types";
import {
  allThirtyTwoTypeIds,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";

interface KoreanPreviewTypePageProps {
  params: Promise<{ typeId: string }>;
}

const BASE_URL = "https://www.watashi-torisetsu.com";
const TYPE_IDS = allThirtyTwoTypeIds();
const TYPE_ID_SET = new Set<string>(TYPE_IDS);

export const dynamicParams = false;

export function generateStaticParams() {
  return TYPE_IDS.map((typeId) => ({ typeId }));
}

export async function generateMetadata({
  params,
}: KoreanPreviewTypePageProps): Promise<Metadata> {
  const { typeId } = await params;
  if (!TYPE_ID_SET.has(typeId)) return {};

  const id = typeId as ThirtyTwoTypeId;
  const type = KO_RESULT_TYPES[id];
  const japaneseUrl = `${BASE_URL}/preview/${typeId}`;
  const koreanUrl = `${BASE_URL}/ko/preview/${typeId}`;

  return {
    title: type.essence,
    description: KO_TYPE_ZUKAN_DESCRIPTIONS[id],
    alternates: {
      canonical: koreanUrl,
      languages: {
        "ja-JP": japaneseUrl,
        "ko-KR": koreanUrl,
        "x-default": japaneseUrl,
      },
    },
    openGraph: {
      locale: "ko_KR",
      alternateLocale: ["ja_JP"],
      url: koreanUrl,
      title: `${type.essence} | 나의 사용설명서`,
      description: KO_TYPE_ZUKAN_DESCRIPTIONS[id],
    },
    robots: { index: true, follow: true },
  };
}

export default async function KoreanPreviewTypePage({
  params,
}: KoreanPreviewTypePageProps) {
  const { typeId } = await params;
  if (!TYPE_ID_SET.has(typeId)) notFound();

  return (
    <MeResultPage
      params={Promise.resolve({ token: "preview" })}
      searchParams={Promise.resolve({
        previewType: typeId,
        fromPreview: "1",
        previewLock: "1",
      })}
      locale="ko"
    />
  );
}
