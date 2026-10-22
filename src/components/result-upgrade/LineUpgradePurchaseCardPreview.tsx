import { LINE_UPGRADE_CARD_COPY } from "@/lib/line-upgrade-dialogue";

/** Local visual preview of the native, button-only Flex card. */
export function LineUpgradePurchaseCardPreview() {
  return <section aria-label="LINEの購入案内カード" className="mr-2 rounded-2xl bg-white p-5 shadow-lg">
    <form action="/api/dev/result-upgrade-checkout?channel=line" method="post">
      <button type="submit" className="w-full rounded-xl bg-[#06C755] px-5 py-3 font-bold text-white">{LINE_UPGRADE_CARD_COPY.button}</button>
    </form>
  </section>;
}
