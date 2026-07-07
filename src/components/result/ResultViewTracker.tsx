"use client";

// 結果ページ (/me) の表示計測。サーバーコンポーネントからは track() (client 専用) を
// 呼べないため、マウント時に一度だけ発火する薄いクライアント境界として切り出す。
//
// 発火するイベント (いずれも ownerToken 付き → admin/stats は owner_token 単位で集計):
//   result_viewed        セッション内で当該 token 初表示 (metadata.friendCount)
//   result_revisited     セッション内で 2 回目以降の表示
//   three_friends_unlocked  friendCount >= 3 に到達した token を 1 回だけ (localStorage で永続 dedup)
//
// dedup 方針:
//   - viewed/revisited は sessionStorage (タブを閉じるまで) 単位。
//   - three_friends_unlocked は localStorage 単位 (端末で 1 回)。stats は unique owner_token を
//     数えるので多重発火でも二重計上されないが、無駄な POST を避けるため client でも抑止する。

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
        track("result_viewed", { ownerToken, metadata: { friendCount } });
      }

      if (friendCount >= 3) {
        const unlockedKey = `torisetsu_unlocked3_${ownerToken}`;
        if (localStorage.getItem(unlockedKey) !== "1") {
          localStorage.setItem(unlockedKey, "1");
          track("three_friends_unlocked", {
            ownerToken,
            metadata: { friendCount },
          });
        }
      }
    } catch {
      // 計測は UX を阻害しない
    }
    // ownerToken 単位で 1 度。friendCount 変化での再発火は不要 (SSR で確定値)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerToken]);

  return null;
}
