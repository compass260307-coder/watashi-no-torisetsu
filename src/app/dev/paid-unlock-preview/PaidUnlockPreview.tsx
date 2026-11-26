"use client";

import { useEffect, useState } from "react";
import { PaidUnlockRecovery } from "@/components/result/PaidUnlockRecovery";
import type { AccessProduct } from "@/lib/access-products";

export function PaidUnlockPreview({
  initialState,
  product,
}: {
  initialState: "waiting" | "timedOut";
  product: AccessProduct;
}) {
  const [state, setState] = useState(initialState);
  const [retried, setRetried] = useState(false);

  // 押して確かめ直したときだけ、4秒後に時間切れへ戻す (最初の「確認しています」は出したままにする)。
  useEffect(() => {
    if (state !== "waiting" || !retried) return;
    const timer = setTimeout(() => setState("timedOut"), 4000);
    return () => clearTimeout(timer);
  }, [retried, state]);

  return (
    <PaidUnlockRecovery
      state={state}
      product={product}
      onRetry={() => {
        setRetried(true);
        setState("waiting");
      }}
      onLater={() => setState("timedOut")}
    />
  );
}
