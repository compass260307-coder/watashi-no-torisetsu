"use client";

// /unmei 未購入LPの価格表示 + 購入CTA (2026-07-26 指示)。
// 完全版 (¥499 full_access) 保有者にはアップグレード価格 ¥1,480
// (product=unmei_upgrade) を出し分ける。価格の権威はサーバ:
// create-unmei-session が hasFullAccess を検証するため、ここでの判定は表示用。
//
// 判定は BottomNav と同じ流儀:
//   - ログイン session の owner_token か localStorage の torisetsu_owner_token
//   - full 確認済み token は torisetsu_full_token にキャッシュ (即時反映)
//   - 未確認は /api/checkout/full-access-status で確認
// 判定できない/失敗時は通常価格 ¥1,980 のまま (安全側)。

import { useEffect, useState } from "react";
import UnmeiCheckoutButton from "@/components/uranai/UnmeiCheckoutButton";

const OWNER_TOKEN_KEY = "torisetsu_owner_token";
const FULL_TOKEN_KEY = "torisetsu_full_token";

export default function UnmeiPriceCta({
  sessionOwnerToken,
  sessionHasFull,
  align = "start",
  variant = "full",
}: {
  /** ログイン済みならその owner_token (未ログインは null → localStorage を見る)。 */
  sessionOwnerToken: string | null;
  /** サーバで判定済みの完全版保有 (ログイン済みのときのみ true になり得る)。 */
  sessionHasFull: boolean;
  /** PC での寄せ。ヒーロー=start (左寄せ) / 最下部の締めCTA=center。 */
  align?: "start" | "center";
  /**
   * full: 大きな価格行 + 取り消し線/バッジ + ボタン + 返金保証 (ヒーロー用)。
   * compact: 「料金はわずか¥…です。」の一文 + ボタンのみ (締めCTA用。16P 参考)。
   */
  variant?: "full" | "compact";
}) {
  const [ownerToken, setOwnerToken] = useState<string | null>(
    sessionOwnerToken,
  );
  const [hasFull, setHasFull] = useState(sessionHasFull);

  useEffect(() => {
    if (hasFull) return;
    let token = sessionOwnerToken;
    try {
      if (!token) token = localStorage.getItem(OWNER_TOKEN_KEY);
      if (token && localStorage.getItem(FULL_TOKEN_KEY) === token) {
        setOwnerToken(token);
        setHasFull(true);
        return;
      }
    } catch {
      // localStorage 不可環境: 通常価格のまま
    }
    if (!token) return;
    setOwnerToken(token);
    let cancelled = false;
    fetch(
      `/api/checkout/full-access-status?owner_token=${encodeURIComponent(token)}`,
    )
      .then((r) => (r.ok ? r.json() : { full: false }))
      .then((d: { full?: boolean }) => {
        if (cancelled || !d?.full) return;
        setHasFull(true);
        try {
          localStorage.setItem(FULL_TOKEN_KEY, token!);
        } catch {
          // noop
        }
      })
      .catch(() => {
        // 判定失敗時は通常価格のまま (安全側)
      });
    return () => {
      cancelled = true;
    };
  }, [hasFull, sessionOwnerToken]);

  if (variant === "compact") {
    return (
      <>
        <p className="mt-1 text-[15px] font-bold text-[#2E2E5C]/65 md:text-[16px]">
          料金はわずか {hasFull ? "¥1,480" : "¥1,980"} です。
        </p>
        <div className="mt-6 flex justify-center">
          <UnmeiCheckoutButton
            ownerToken={ownerToken}
            product={hasFull ? "unmei_upgrade" : "unmei"}
          >
            続ける →
          </UnmeiCheckoutButton>
        </div>
      </>
    );
  }

  return (
    <>
      {hasFull ? (
        <p className="mt-3 text-[34px] font-black text-[#2E2E5C] md:text-[40px]">
          <span className="mr-2.5 align-middle text-[20px] font-bold text-[#2E2E5C]/40 line-through md:text-[24px]">
            ¥1,980
          </span>
          ¥1,480
          {/* 割引率 = (1980-1480)/1980 ≒ 25%。色はインディゴ系に統一 (赤は使わない) */}
          <span className="ml-2.5 inline-block rounded-lg bg-[#F4F4FE] px-2.5 py-1 align-middle text-[14px] font-black text-[#5B5BEF] md:text-[15px]">
            25%OFF
          </span>
        </p>
      ) : (
        <p className="mt-3 text-[34px] font-black text-[#2E2E5C] md:text-[40px]">
          ¥1,980
          <span className="ml-2.5 text-[14px] font-bold text-[#2E2E5C]/55 md:text-[15px]">
            買い切り
          </span>
        </p>
      )}
      {/* 16P 参考: SP はボタン全幅 + 保証をその下の中央 / PC はボタン横に保証を1行
          (エンタメ表記は特商法/規約ページ側にあるため省略) */}
      <div
        className={`mt-3 flex flex-col gap-3 md:flex-row md:items-center md:gap-5 ${
          align === "start" ? "" : "md:justify-center"
        }`}
      >
        <UnmeiCheckoutButton
          ownerToken={ownerToken}
          product={hasFull ? "unmei_upgrade" : "unmei"}
        >
          続ける →
        </UnmeiCheckoutButton>
        <span className="text-center text-[15px] font-bold text-[#2E2E5C]/55 md:text-left">
          30日間の返金保証
        </span>
      </div>
    </>
  );
}
