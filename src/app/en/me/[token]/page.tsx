import type { Metadata } from "next";
import MeResultPage from "@/components/result/MeResultPage";
import { EN_RESULT_COPY } from "@/i18n/en/result";

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ paid?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const encoded = encodeURIComponent(token);
  return {
    title: { absolute: EN_RESULT_COPY.metadataTitle },
    description: EN_RESULT_COPY.metadataDescription,
    alternates: { canonical: `/en/me/${encoded}`, languages: { "ja-JP": `/me/${encoded}`, "ko-KR": `/ko/me/${encoded}`, "en-US": `/en/me/${encoded}`, "x-default": `/me/${encoded}` } },
    robots: { index: false, follow: false },
  };
}

export default function EnglishMePage({ params, searchParams }: Props) {
  return (
    <MeResultPage
      params={params}
      searchParams={searchParams ?? Promise.resolve({})}
      locale="en"
    />
  );
}
