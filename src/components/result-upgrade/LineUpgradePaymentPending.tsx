"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LineUpgradePaymentPending() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 60_000;
    const expiry = setTimeout(() => { controller.abort(); setWaiting(false); }, 60_000);
    async function poll() {
      try {
        const response = await fetch("/api/result-upgrade/status?channel=line", { cache: "no-store", signal: controller.signal });
        if (response.ok && (await response.json()).premium === true) { clearTimeout(expiry); router.refresh(); return; }
      } catch { /* Keep waiting without exposing payment details. */ }
      if (controller.signal.aborted) return;
      if (Date.now() >= deadline) { setWaiting(false); return; }
      timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); clearTimeout(expiry); };
  }, [attempt, router]);
  return <main className="mx-auto min-h-[60vh] max-w-lg px-5 py-20 text-center text-[#2E2E5C]">
    <h1 className="text-2xl font-black">{waiting ? "お支払いを確認しています" : "お支払いの反映を確認できませんでした"}</h1>
    <p role="status" className="mt-4 leading-8">再購入せずにお待ちください。確認後、自動で専用の結果づくりへ進みます。</p>
    {!waiting && <button className="mt-5 rounded-full bg-[#5B5BEF] px-6 py-3 font-bold text-white" onClick={() => { setWaiting(true); setAttempt(value => value + 1); }}>もう一度確認する</button>}
    <a href="/line/menu" className="mt-6 block font-bold underline">LINEメニューに戻る</a>
  </main>;
}
