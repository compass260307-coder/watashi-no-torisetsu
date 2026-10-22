"use client";

import { useEffect, useRef, useState } from "react";
import { createLineUpgradeCheckout, type LineUpgradeCheckoutResult } from "@/lib/line-upgrade-checkout-client";
import { redirectToFullAccessCheckout } from "@/lib/redirect-to-checkout";
import { LINE_UPGRADE_TALK_URL } from "@/lib/line-upgrade-dialogue";

export function LineUpgradeCheckoutRedirect() {
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Share the in-flight request across Strict Mode effect setup/cleanup.
  const pending = useRef<Promise<LineUpgradeCheckoutResult> | null>(null);
  useEffect(() => {
    let active = true;
    pending.current ??= createLineUpgradeCheckout();
    void pending.current.then(result => {
      if (!active) return;
      if (result.kind === "checkout") {
        redirectToFullAccessCheckout(result.url, { value: result.amount, currency: result.currency });
      } else if (result.kind === "paid") {
        window.location.replace("/line/result-upgrade?paid=1");
      } else {
        setError(result.kind === "reauthenticate"
          ? "LINEの本人確認が必要みたい。トークで「結果アップグレード」と送って、新しいカードから開いてね🌿"
          : "保存した回答を確認したいから、LINEのトークへ戻ってね🌿");
      }
    }).catch(() => {
      if (active) setError("決済画面を開けなかったみたい。少し待って、もう一度試してね🌿");
    });
    return () => { active = false; };
  }, [retry]);

  return <section className="mx-auto max-w-xl rounded-3xl border border-[#B9EACD] bg-white p-8 text-center text-[#2E2E5C]">
    <h1 className="text-xl font-black">{error ? "もう一度確認してね" : "決済画面を開いているよ🌙"}</h1>
    <p role="status" className="mt-4 text-sm leading-7">{error ?? "このまま少し待っていてね。お支払いが完了すると、LINEにキャラクターと鑑定書のリンクが届くよ。"}</p>
    {error && <button type="button" className="mt-5 rounded-full bg-[#06C755] px-6 py-3 font-bold text-white" onClick={() => {
      pending.current = null; setError(null); setRetry(value => value + 1);
    }}>もう一度開く</button>}
    <a href={LINE_UPGRADE_TALK_URL} className="mt-5 block text-sm font-bold text-[#007A33] underline">Aliceのトークに戻る</a>
  </section>;
}
