"use client";

// 結果ページ (/me) の表示計測。サーバーコンポーネントからは track() (client 専用) を
// 呼べないため、マウント時に一度だけ発火する薄いクライアント境界として切り出す。
//
// 発火するイベント (いずれも ownerToken 付き → 計測処理は owner_token 単位で集計):
//   result_viewed        セッション内で当該 token 初表示 (metadata.friendCount)
//   result_revisited     セッション内で 2 回目以降の表示
//
// dedup 方針:
//   - viewed/revisited は sessionStorage (タブを閉じるまで) 単位。

import { useEffect } from "react";
import { track } from "@/lib/track";

interface ResultViewTrackerProps {
  /** users.owner_token。イベントの owner_token 列に載せて達成集計に使う。 */
  ownerToken: string;
  /** 友達評価の件数 (friend_perceptions の行数)。 */
  friendCount: number;
}

export function ResultViewTracker({
  ownerToken,
  friendCount,
}: ResultViewTrackerProps) {
  useEffect(() => {
    try {
      const viewedKey = `torisetsu_me_viewed_${ownerToken}`;
      const revisited = sessionStorage.getItem(viewedKey) === "1";
      if (revisited) {
        track("result_revisited", { ownerToken });
      } else {
        sessionStorage.setItem(viewedKey, "1");
        track("result_viewed", {
          ownerToken,
          metadata: { friendCount, funnelVersion: "share_v3" },
        });
      }
    } catch {
      // 計測は UX を阻害しない
    }
    // ownerToken 単位で 1 度。friendCount 変化での再発火は不要 (SSR で確定値)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerToken]);

  return null;
}
