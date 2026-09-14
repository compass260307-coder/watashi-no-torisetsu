import TarotLanding from "@/components/tarot/TarotLanding";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import {
  getTarotAccessState,
  redirectToTarotPaywall,
} from "@/lib/tarot/access";

type PageProps = {
  searchParams?: Promise<{ paid?: string | string[] }>;
};

export default async function KoreanTarotPage({ searchParams }: PageProps) {
  const query = (await searchParams) ?? {};
  const access = await getTarotAccessState();
  if (!access.purchased) {
    if (query.paid === "1" && access.ownerToken) {
      return (
        <PaidUnlockWatcher
          ownerToken={access.ownerToken}
          locale="ko"
          returnTo="tarot"
        />
      );
    }
    redirectToTarotPaywall("ko", access.ownerToken);
  }
  return <TarotLanding locale="ko" />;
}
