import type { Metadata } from "next";
import {
  FriendIndividualResultPage,
  type FriendIndividualPageProps,
} from "@/components/result/FriendIndividualResultPage";
import { localizedAlternates } from "@/lib/locale-seo";

export async function generateMetadata({
  params,
}: Pick<FriendIndividualPageProps, "params">): Promise<Metadata> {
  const { token, perceptionId } = await params;
  const tokenPath = encodeURIComponent(token);
  const perceptionPath = encodeURIComponent(perceptionId);
  return {
    title: "친구별 관점 일치 결과 | 나의 사용설명서",
    alternates: localizedAlternates(
      "ko",
      `/tako/${tokenPath}/friend/${perceptionPath}`,
      `/ko/tako/${tokenPath}/friend/${perceptionPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default function KoreanFriendIndividualPage(
  props: FriendIndividualPageProps,
) {
  return <FriendIndividualResultPage {...props} locale="ko" />;
}
