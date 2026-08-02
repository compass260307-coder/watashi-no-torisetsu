import FriendDiagnosisPage from "@/components/friend/FriendDiagnosisPage";

export default function KoreanFriendPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  return <FriendDiagnosisPage params={params} locale="ko" />;
}
