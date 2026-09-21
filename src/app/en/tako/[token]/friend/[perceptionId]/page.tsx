import type { Metadata } from "next";
import {
  FriendIndividualResultPage,
  type FriendIndividualPageProps,
} from "@/components/result/FriendIndividualResultPage";
import { localizedAlternates } from "@/lib/locale-seo";

export async function generateMetadata({ params }: {
  params: Promise<{ token: string; perceptionId: string }>;
}): Promise<Metadata> {
  const { token, perceptionId } = await params;
  const tokenPath = encodeURIComponent(token);
  const perceptionPath = encodeURIComponent(perceptionId);
  return {
    title: "A friend's perspective",
    alternates: localizedAlternates(
      "en",
      `/tako/${tokenPath}/friend/${perceptionPath}`,
      `/ko/tako/${tokenPath}/friend/${perceptionPath}`,
      `/en/tako/${tokenPath}/friend/${perceptionPath}`,
      `/id/tako/${tokenPath}/friend/${perceptionPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default function EnglishFriendIndividualRoute(
  props: FriendIndividualPageProps,
) {
  return <FriendIndividualResultPage {...props} locale="en" />;
}
