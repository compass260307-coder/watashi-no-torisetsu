import FriendDiagnosisPage from "@/components/friend/FriendDiagnosisPage";

export default function JapaneseFriendPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  return <FriendDiagnosisPage params={params} locale="ja" />;
}
