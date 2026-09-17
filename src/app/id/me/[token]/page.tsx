import type { Metadata } from "next";
import MeResultPage from "@/components/result/MeResultPage";
import { ID_RESULT_COPY } from "@/i18n/id/result";

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const encoded = encodeURIComponent(token);
  return {
    title: { absolute: ID_RESULT_COPY.metadataTitle },
    description: ID_RESULT_COPY.metadataDescription,
    alternates: { canonical: `/id/me/${encoded}`, languages: { "ja-JP": `/me/${encoded}`, "ko-KR": `/ko/me/${encoded}`, "en-US": `/en/me/${encoded}`, "id-ID": `/id/me/${encoded}`, "x-default": `/me/${encoded}` } },
    robots: { index: false, follow: false },
  };
}

export default function IndonesianMePage({ params, searchParams }: Props) {
  return <MeResultPage params={params} searchParams={searchParams ?? Promise.resolve({})} locale="id" />;
}
