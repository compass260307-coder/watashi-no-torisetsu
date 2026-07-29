"use client";

// /unmei?checkout=success 着地 (ログイン済み・webhook 未反映) の決済確認画面。
// Stripe の success_url で戻った直後は users.unmei がまだ立っていないことがあり、
// そのまま販売LPを再表示すると「払ったのに買えていない?」と再購入しかねない
// (/me の ?paid=1 + PaidUnlockWatcher と同じ問題への、/unmei 版のガード)。
// /api/unmei/status が 'unpurchased' 以外を返したら反映済みなので、
// ?checkout=success を外した /unmei へ replace してサーバ描画に切り替える
// (通常は出生情報フォームへ進む)。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 60_000;

export default function UnmeiCheckoutConfirming() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const deadline = Date.now() + TIMEOUT_MS;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/unmei/status", { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as { state?: string };
          if (!cancelled && j?.state && j.state !== "unpurchased") {
            clearInterval(timer);
            router.replace("/unmei");
            return;
          }
        }
      } catch {
        // 一時的なネットワークエラーは次のポーリングで回復
      }
      if (!cancelled && Date.now() >= deadline) {
        clearInterval(timer);
        setTimedOut(true);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);

  if (timedOut) {
    return (
      <main className="mx-auto max-w-[640px] px-6 py-16 text-center">
        <h1 className="mb-4 text-2xl font-black">決済の確認に時間がかかっています</h1>
        <p className="mb-8 leading-relaxed text-gray-700">
          少し時間をおいて、もう一度お試しください。
          <br />
          再読み込みしても反映されない場合は、購入時のメールアドレスを添えて{" "}
          <a
            href="mailto:support@watashi-torisetsu.com"
            className="underline underline-offset-2"
          >
            support@watashi-torisetsu.com
          </a>{" "}
          までご連絡ください。
        </p>
        <button
          type="button"
          onClick={() => router.replace("/unmei")}
          className="rounded-full bg-[#5B5BEF] px-6 py-3 font-bold text-white"
        >
          再読み込みする
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[640px] flex-col items-center px-6 py-16 text-center">
      <h1 className="mb-4 text-2xl font-black">決済を確認しています</h1>
      <p className="mb-8 text-gray-700">
        購入ありがとうございます！このまま少しお待ちください。
      </p>
      <div className="h-24 w-24 animate-spin rounded-full border-4 border-gray-200 border-t-[#5B5BEF]" />
    </main>
  );
}
