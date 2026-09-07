import TarotLanding from "@/components/tarot/TarotLanding";
import { requireTarotAccess } from "@/lib/tarot/access";

export default async function TarotPage() {
  await requireTarotAccess("ja");
  return <TarotLanding />;
}
