import { LINE_UPGRADE_CARD_COPY } from "@/lib/line-upgrade-dialogue";

/** Local visual preview of the compact native Flex card. */
export function LineUpgradePurchaseCardPreview() {
  const copy = LINE_UPGRADE_CARD_COPY;
  return <section aria-label="LINEの購入案内カード" className="mr-2 overflow-hidden rounded-2xl bg-white shadow-lg">
    <header className="space-y-2 bg-[#06C755] p-5 text-white">
      <h2 className="font-bold">{copy.title}</h2>
      <p className="text-sm">{copy.guarantee}</p>
    </header>
    <form action="/api/dev/result-upgrade-checkout?channel=line" method="post" className="p-5">
      <button type="submit" className="w-full rounded-xl bg-[#06C755] px-5 py-3 font-bold text-white">{copy.button}</button>
    </form>
  </section>;
}
