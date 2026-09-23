import type { Metadata } from "next";
import FriendDiagnosisPage from "@/components/friend/FriendDiagnosisPage";

const TITLE = "Describe a friend | Alice Personalities";
const DESCRIPTION =
  "Share how you see your friend in 30 quick personality questions.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    siteName: "Alice Personalities",
    images: ["/characters/keyvisual.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/characters/keyvisual.webp"],
  },
  robots: { index: false, follow: false },
};

export default function EnglishFriendInvitePage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  return <FriendDiagnosisPage params={params} locale="en" />;
}
