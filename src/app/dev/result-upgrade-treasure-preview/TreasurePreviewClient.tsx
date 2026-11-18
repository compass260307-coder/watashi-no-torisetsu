"use client";

import { useState } from "react";
import { CouponTicket, ResultUpgradeOfferCard, ResultUpgradeTreasure } from "@/components/result-upgrade/ResultUpgradeTreasure";
import {
  LINE_RESULT_UPGRADE_COUPON_JPY,
  LINE_RESULT_UPGRADE_LIST_PRICE_JPY,
  RESULT_UPGRADE_PRICE_JPY,
} from "@/lib/access-products";

// ローカル専用: Stripeのテスト決済画面へ進む（テスト用キーが必要）。
const devPurchaseButton = (
  <form action="/api/dev/result-upgrade-checkout" method="post">
    <button
      type="submit"
      className="flex w-full items-center justify-center rounded-full bg-[#A87322] px-6 py-4 text-[16px] font-black text-white shadow-[0_4px_0_#7F5518]"
    >
      結果をアップグレード
    </button>
  </form>
);

export function TreasurePreviewClient() {
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState(true);
  const [received, setReceived] = useState(false);
  return (
    <main className="min-h-screen bg-[#F5F4FB] px-4 py-10">
      <div className="mx-auto max-w-[420px] space-y-5 text-center">
        <p className="text-[12px] font-black tracking-[0.14em] text-[#9A6A24]">LOCAL PREVIEW</p>
        <h1 className="text-[22px] font-black text-[#2E2E5C]">宝箱のクーポン演出</h1>
        <button
          type="button"
          onClick={() => { setReceived(false); setRun((value) => value + 1); setOpen(true); }}
          className="rounded-full bg-[#5B5BEF] px-6 py-3 text-[14px] font-black text-white"
        >
          もう一度見る
        </button>
        {received && (
          <div className="text-left">
            <p className="mb-2 text-[12px] font-bold text-[#66657B]">受け取ったあと、チャットに出るクーポン券と購入カード</p>
            <CouponTicket couponJpy={LINE_RESULT_UPGRADE_COUPON_JPY} variant="chat" />
            <div className="mt-5">
              <ResultUpgradeOfferCard
                couponJpy={LINE_RESULT_UPGRADE_COUPON_JPY}
                listPriceJpy={LINE_RESULT_UPGRADE_LIST_PRICE_JPY}
                priceJpy={RESULT_UPGRADE_PRICE_JPY}
                savedLabel="回答の保存ができました"
                note="買い切り・追加料金なし・30日間の返金保証つき"
                purchaseCta={devPurchaseButton}
              />
            </div>
          </div>
        )}
      </div>
      {open && (
        <ResultUpgradeTreasure
          key={run}
          couponJpy={LINE_RESULT_UPGRADE_COUPON_JPY}
          listPriceJpy={LINE_RESULT_UPGRADE_LIST_PRICE_JPY}
          priceJpy={RESULT_UPGRADE_PRICE_JPY}
          purchaseCta={devPurchaseButton}
          onCouponReceived={() => setReceived(true)}
          onClose={() => setOpen(false)}
          onDismiss={() => setOpen(false)}
        />
      )}
    </main>
  );
}
