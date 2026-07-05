"use client";

// Phase 1.5-α Day 12 hotfix: ¥500 perception 解除の決済直後ランディング。
//
// success_url = /evaluate/result/[perceptionId]?checkout=success で同一デバイスに戻った直後、
// Webhook (checkout.session.completed → payment_history completed) の反映が
// まだの場合に表示する「解除を確認中」画面。
//
// 動作: 一定間隔で ?try を増やして自動再読込。Server 側で isPerceptionUnlocked が
// true になれば解除済みページが描画され、この画面は出なくなる。
// クエリで解除を偽装はしない (ペイウォール維持。あくまで Webhook 反映待ち)。
// 上限到達時は「反映に時間がかかっています」フォールバックを表示 (決済自体は完了済み)。

import { useEffect, useState } from "react";
import Link from "next/link";

const MAX_TRIES = 8; // 約 2.5s × 8 ≒ 20s 待つ
const INTERVAL_MS = 2500;

export function UnlockConfirming({
  myTrisetsuUrl,
}: {
  myTrisetsuUrl: string;
}) {
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const t = Number(url.searchParams.get("try") ?? "0");
    if (!Number.isFinite(t) || t >= MAX_TRIES) {
      setGaveUp(true);
      return;
    }
    const id = window.setTimeout(() => {
      url.searchParams.set("try", String(t + 1));
      window.location.replace(url.toString());
    }, INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, []);

  const reload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("try", "0");
    window.location.replace(url.toString());
  };

  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4">
      <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
        <div className="flex flex-col items-center text-center py-16">
          {!gaveUp ? (
            <>
              <div
                className="h-12 w-12 rounded-full border-4 border-[#0094D8]/25 border-t-[#5B5BEF] mb-6 animate-spin"
                aria-hidden="true"
              />
              <p className="text-[#2E2E5C] font-black text-base mb-2">
                解除を確認しています…
              </p>
              <p className="text-[#2E2E5C]/70 text-sm leading-relaxed">
                決済ありがとうございます。
                <br />
                解除を反映中です。そのままお待ちください。
              </p>
            </>
          ) : (
            <>
              <p className="text-[#2E2E5C] font-black text-base mb-2">
                反映に少し時間がかかっています
              </p>
              <p className="text-[#2E2E5C]/70 text-sm leading-relaxed mb-6">
                決済は完了しています。
                <br />
                少し待ってから再読み込みすると、解除済みの結果が表示されます。
              </p>
              <button
                type="button"
                onClick={reload}
                className="bg-[#5B5BEF] text-white font-black text-sm px-8 py-3 rounded-full shadow-[0_8px_20px_rgba(91,91,239,0.30)] active:translate-y-1 active:shadow-[0_0_0_#2E2E5C] transition-all"
              >
                再読み込み
              </button>
              <Link
                href={myTrisetsuUrl}
                className="text-[#2E2E5C]/60 font-bold text-xs underline mt-5 hover:text-[#5B5BEF] transition-colors"
              >
                マイトリセツに戻る
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
