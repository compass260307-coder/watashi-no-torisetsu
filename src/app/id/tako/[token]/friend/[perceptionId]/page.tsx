import type { Metadata } from "next";
import {
  FriendIndividualResultPage,
  type FriendIndividualPageProps,
} from "@/components/result/FriendIndividualResultPage";

export const metadata: Metadata = {
  title: "Saling memahami dengan teman",
  robots: { index: false, follow: false },
};

export default function IndonesianFriendIndividualPage(
  props: FriendIndividualPageProps,
) {
  return <FriendIndividualResultPage {...props} locale="id" />;
}
