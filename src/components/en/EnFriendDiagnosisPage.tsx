"use client";

import FriendDiagnosisPage from "@/components/friend/FriendDiagnosisPage";

export default function EnFriendDiagnosisPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  return <FriendDiagnosisPage params={params} locale="en" />;
}
