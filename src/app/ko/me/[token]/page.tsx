import type { Metadata } from "next";
import MeResultPage from "@/components/result/MeResultPage";
import { localizedAlternates } from "@/lib/locale-seo";

interface KoreanMePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: Pick<KoreanMePageProps, "params">): Promise<Metadata> {
  const { token } = await params;
  const tokenPath = encodeURIComponent(token);
  return {
    title: { absolute: "나의 성격 진단 결과 | 나의 사용설명서" },
    description:
      "Big Five를 바탕으로 분석한 나의 성격 유형과 연애, 커리어, 친구 관계 사용설명서예요.",
    alternates: localizedAlternates(
      "ko",
      `/me/${tokenPath}`,
      `/ko/me/${tokenPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default function KoreanMePage(props: KoreanMePageProps) {
  return <MeResultPage {...props} locale="ko" />;
}
