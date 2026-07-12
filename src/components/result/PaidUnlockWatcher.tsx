"use client";

// 決済直後 (/me/[token]?paid=1) の webhook 反映待ちオーバーレイ。
//
// 背景: Stripe 決済 → success_url (/me/{token}?paid=1) に着地するが、plan='full' を
//   付けるのは webhook で非同期。着地した瞬間はまだ未反映のことがあり、そのままだと
//   「払ったのに課金カード(ロック)が再表示」→ 再購入(二重課金)や離脱を招く。
//
// このコンポーネントは「?paid=1 かつ まだ未反映 (ロック中)」のときだけ親 (/me) がマウントし、
//   全画面「決済処理中…」を出しつつ status API をポーリング。full になったら paid= を外した
//   URL に置き換えて再描画 (= ロック解除表示)。一定時間で反映されなければ手動再読み込み導線。

import { useEffect, useState } from "react";

const NAVY = "#2E2E5C";
const POLL_INTERVAL_MS = 2000;
const FIRST_DELAY_MS = 1200;
const MAX_TRIES = 20; // 約 40 秒

export function PaidUnlockWatcher({ ownerToken }: { ownerToken: string }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const reloadUnlocked = () => {
      // paid= を外した URL に置換 (履歴を汚さない)。full 反映済みなので本文が出る。
      window.location.replace(`/me/${ownerToken}`);
    };

    const poll = async () => {
      if (cancelled) return;
      tries += 1;
      try {
        const res = await fetch(
          `/api/checkout/full-access-status?owner_token=${encodeURIComponent(ownerToken)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as { full?: boolean };
          if (data.full) {
            reloadUnlocked();
            return;
          }
        }
      } catch {
        // ネットワーク一時失敗は無視して次のポーリングへ
      }
      if (cancelled) return;
      if (tries >= MAX_TRIES) {
        setTimedOut(true);
        return;
      }
      window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    const first = window.setTimeout(poll, FIRST_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
    };
  }, [ownerToken]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "rgba(255,255,255,0.96)" }}
      role="status"
      aria-live="polite"
    >
      {!timedOut ? (
        <>
          {/* スピナー */}
          <div
            aria-hidden="true"
            className="mb-5 h-10 w-10 animate-spin rounded-full border-4 border-[#E3E6F5]"
            style={{ borderTopColor: NAVY }}
          />
          <p
            className="text-[17px] font-black leading-[1.6]"
            style={{ color: NAVY }}
          >
            決済処理中です…
          </p>
          <p className="mt-1.5 text-[13px] font-bold leading-[1.7] text-[#8A8AA3]">
            全解放の反映まで、もう少しお待ちください。
            <br />
            自動でひらきます。
          </p>
        </>
      ) : (
        <>
          <p
            className="text-[17px] font-black leading-[1.6]"
            style={{ color: NAVY }}
          >
            反映に少し時間がかかっています
          </p>
          <p className="mt-1.5 text-[13px] font-bold leading-[1.7] text-[#8A8AA3]">
            決済は完了しています。数分後にもう一度お試しください。
          </p>
          <button
            type="button"
            onClick={() => window.location.replace(`/me/${ownerToken}`)}
            className="mt-6 inline-flex items-center justify-center rounded-full px-8 py-3 text-[15px] font-black text-white"
            style={{ background: NAVY }}
          >
            再読み込み
          </button>
        </>
      )}
    </div>
  );
}
