import type { Metadata } from "next";
import FriendDiagnosisPage from "@/components/friend/FriendDiagnosisPage";

export const metadata: Metadata = {
  title: { absolute: "Nilai teman Anda | Alice Test" },
  description: "Jawab 30 pertanyaan singkat tentang cara Anda melihat teman Anda.",
  robots: { index: false, follow: false },
};

export default function IndonesianFriendInvitePage({ params }: { params: Promise<{ inviteCode: string }> }) {
  return <FriendDiagnosisPage params={params} locale="id" />;
}
