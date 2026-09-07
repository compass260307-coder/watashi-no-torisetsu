import TarotLanding from "@/components/tarot/TarotLanding";
import { requireTarotAccess } from "@/lib/tarot/access";

export default async function KoreanTarotPage() {
  await requireTarotAccess("ko");
  return <TarotLanding locale="ko" />;
}
