import type { Metadata } from "next";
import EnFriendIndividualPage from "@/components/en/EnFriendIndividualPage";

export const metadata: Metadata = {
  title: "A friend's perspective",
  robots: { index: false, follow: false },
};

export default async function EnglishFriendIndividualRoute({
  params,
}: {
  params: Promise<{ token: string; perceptionId: string }>;
}) {
  const { token, perceptionId } = await params;
  return <EnFriendIndividualPage token={token} perceptionId={perceptionId} />;
}
