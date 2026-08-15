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
    title: "友達ごとの相互理解",
    alternates: localizedAlternates(
      "ja",
      `/tako/${tokenPath}/friend/${perceptionPath}`,
      `/ko/tako/${tokenPath}/friend/${perceptionPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default function FriendIndividualPage(props: FriendIndividualPageProps) {
  return <FriendIndividualResultPage {...props} locale="ja" />;
}
