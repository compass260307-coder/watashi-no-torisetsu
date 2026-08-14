"use client";

// /unmei 未購入LPの価格表示 + 購入CTA (2026-07-26 指示)。
// 完全版 (¥499 full_access) 保有者にはプレミアムへの差額 ¥400 を出し分ける。
// 価格の権威は統一Checkout APIであり、ここでの判定は表示用。
//
// 判定は BottomNav と同じ流儀:
//   - ログイン session の owner_token か localStorage の torisetsu_owner_token
//   - full 確認済み token は torisetsu_full_token にキャッシュ (即時反映)
//   - 未確認は /api/checkout/full-access-status で確認
// 判定できない/失敗時は通常価格 ¥899 のまま (安全側)。

import { useEffect, useState } from "react";
import UnmeiCheckoutButton from "@/components/uranai/UnmeiCheckoutButton";

const OWNER_TOKEN_KEY = "torisetsu_owner_token";
const FULL_TOKEN_KEY = "torisetsu_full_token";

export default function UnmeiPriceCta({
  sessionOwnerToken,
  sessionHasFull,
  align = "start",
  variant = "full",
  launchChat = false,
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
  /** true = リダイレクトせず全画面チャット決済を起動する (チャット決済フロー)。 */
  launchChat?: boolean;
}) {
  // チャット起動モードでは「作成する」文言、従来のリダイレクトは「続ける」。
  const ctaLabel = launchChat ? "設計図を作成する →" : "続ける →";
  const [ownerToken, setOwnerToken] = useState<string | null>(
    sessionOwnerToken,
  );
  const [hasFull, setHasFull] = useState(sessionHasFull);

  useEffect(() => {
    if (hasFull) return;
    let cancelled = false;
    let ownerTokenTimer: number | null = null;
    let token = sessionOwnerToken;
    try {
      if (!token) token = localStorage.getItem(OWNER_TOKEN_KEY);
      if (token && localStorage.getItem(FULL_TOKEN_KEY) === token) {
        const cachedToken = token;
        ownerTokenTimer = window.setTimeout(() => {
          if (cancelled) return;
          setOwnerToken(cachedToken);
          setHasFull(true);
        }, 0);
        return () => {
          cancelled = true;
          if (ownerTokenTimer !== null) window.clearTimeout(ownerTokenTimer);
        };
      }
    } catch {
      // localStorage 不可環境: 通常価格のまま
    }
    if (!token) return;
    const resolvedToken = token;
    ownerTokenTimer = window.setTimeout(() => {
      if (!cancelled) setOwnerToken(resolvedToken);
    }, 0);
    fetch(
      `/api/checkout/full-access-status?owner_token=${encodeURIComponent(resolvedToken)}`,
    )
      .then((r) => (r.ok ? r.json() : { full: false }))
      .then((d: { full?: boolean }) => {
        if (cancelled || !d?.full) return;
        setHasFull(true);
        try {
          localStorage.setItem(FULL_TOKEN_KEY, resolvedToken);
        } catch {
          // noop
        }
      })
      .catch(() => {
        // 判定失敗時は通常価格のまま (安全側)
      });
    return () => {
      cancelled = true;
      if (ownerTokenTimer !== null) window.clearTimeout(ownerTokenTimer);
    };
  }, [hasFull, sessionOwnerToken]);

  if (variant === "compact") {
    return (
      <>
        {!launchChat && (
          <p className="mt-1 text-[15px] font-bold text-[#2E2E5C]/65 md:text-[16px]">
            料金はわずか {hasFull ? "¥400" : "¥899"} です。
          </p>
        )}
        <div className="mt-6 flex justify-center">
          <UnmeiCheckoutButton
            ownerToken={ownerToken}
            launchChat={launchChat}
          >
            {ctaLabel}
          </UnmeiCheckoutButton>
        </div>
      </>
    );
  }

  return (
    <>
      {/* チャット決済フロー (launchChat) は価格を後のチャット/決済で提示するため、LP では出さない */}
      {!launchChat &&
        (hasFull ? (
          <p className="mt-3 text-[34px] font-black text-[#2E2E5C] md:text-[40px]">
            <span className="mr-2.5 align-middle text-[20px] font-bold text-[#2E2E5C]/40 line-through md:text-[24px]">
              ¥899
            </span>
            ¥400
            {/* 割引率 = (899-400)/899 ≒ 55%。色はインディゴ系に統一 (赤は使わない) */}
            <span className="ml-2.5 inline-block rounded-lg bg-[#F4F4FE] px-2.5 py-1 align-middle text-[14px] font-black text-[#5B5BEF] md:text-[15px]">
              55%OFF
            </span>
            {/* SP は行が窮屈なため、折り返すときは語のまとまりごと次行へ落とす */}
            <span className="ml-2.5 inline-block whitespace-nowrap align-middle text-[14px] font-bold text-[#2E2E5C]/55 md:text-[15px]">
              30日間の返金保証
            </span>
          </p>
        ) : (
          <p className="mt-3 text-[34px] font-black text-[#2E2E5C] md:text-[40px]">
            ¥899
            <span className="ml-2.5 text-[14px] font-bold text-[#2E2E5C]/55 md:text-[15px]">
              買い切り・30日間の返金保証
            </span>
          </p>
        ))}
      {/* 保証表記は価格行の「買い切り」横に移動 (2026-08-02 指示)。
          (エンタメ表記は特商法/規約ページ側にあるため省略) */}
      <div
        className={`${launchChat ? "mt-6" : "mt-3"} flex ${align === "start" ? "" : "md:justify-center"}`}
      >
        <UnmeiCheckoutButton
          ownerToken={ownerToken}
          launchChat={launchChat}
        >
          {ctaLabel}
        </UnmeiCheckoutButton>
      </div>
    </>
  );
}
