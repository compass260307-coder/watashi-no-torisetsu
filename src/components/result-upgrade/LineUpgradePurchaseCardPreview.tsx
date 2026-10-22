import { LINE_UPGRADE_CARD_COPY } from "@/lib/line-upgrade-dialogue";

/** Local visual preview; production sends the Flex JSON built from the same copy. */
export function LineUpgradePurchaseCardPreview() {
  const copy = LINE_UPGRADE_CARD_COPY;
  return <section aria-label="LINEの購入案内カード" className="mr-2 overflow-hidden rounded-2xl bg-white shadow-lg">
    <header className="bg-[#06C755] p-5 text-white">
      <p className="text-xl font-black">Alice</p>
      <p className="mt-1 text-sm font-bold">アップグレード内容の確認</p>
    </header>
    <div className="space-y-4 p-5">
      <p className="text-xs font-bold text-[#9A6A24]">回答の保存ができたよ🌷</p>
      <h2 className="text-lg font-black leading-8">{copy.title}</h2>
      <p className="text-sm leading-7 text-[#66657B]">{copy.body}</p>
      <hr className="border-[#ECEAF5]" />
      <p className="text-sm text-[#66657B] line-through">{copy.listPrice}</p>
      <p className="text-sm text-[#66657B]">{copy.coupon}</p>
      <p className="text-lg font-black">{copy.payment}</p>
      <p className="text-xs leading-6 text-[#66657B]">{copy.guarantee}</p>
      <p className="text-xs leading-6 text-[#66657B]">{copy.delivery}</p>
      <form action="/api/dev/result-upgrade-checkout?channel=line" method="post">
        <button type="submit" className="w-full rounded-xl bg-[#A87322] px-5 py-3 font-bold text-white">{copy.button}</button>
      </form>
    </div>
  </section>;
}
