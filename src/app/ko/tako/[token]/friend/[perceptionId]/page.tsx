import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { localizedAlternates } from "@/lib/locale-seo";

type PageProps = {
  params: Promise<{ token: string; perceptionId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token, perceptionId } = await params;
  const tokenPath = encodeURIComponent(token);
  const perceptionPath = encodeURIComponent(perceptionId);
  return {
    title: "친구별 결과 | 나의 사용설명서",
    alternates: localizedAlternates(
      "ko",
      `/tako/${tokenPath}/friend/${perceptionPath}`,
      `/ko/tako/${tokenPath}/friend/${perceptionPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default async function KoreanFriendIndividualRedirect({
  params,
}: PageProps) {
  const { token, perceptionId } = await params;
  redirect(
    `/ko/tako/${encodeURIComponent(token)}#friend-${encodeURIComponent(perceptionId)}`,
  );
}
