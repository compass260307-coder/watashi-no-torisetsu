"use client";

// 案内ページ (FriendIndividualGuide) の「診断する」主ボタン。
// デザインは既存のネイビー・チャンキーボタンのまま。以下2つの計測を維持できるようにする:
//   - href に ?source=<owner invite_code> を載せる (バイラルツリー source_user_id/generation の材料)
//   - trackSource 指定時に friend_to_diagnosis_clicked を発火 (評価者→診断の転換KPI)
// trackSource 未指定 (個別ページの案内など) は計測なし = 従来挙動。

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/track";

export function GuideDiagnoseButton({
  href = "/diagnosis",
  trackSource,
  children,
}: {
  href?: string;
  /** 指定時のみ friend_to_diagnosis_clicked を計測 (評価者ページ用)。未指定=計測なし。 */
  trackSource?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={
        trackSource
          ? () =>
              track("friend_to_diagnosis_clicked", {
                metadata: { source: trackSource },
              })
          : undefined
      }
      className="flex items-center justify-center w-full bg-[#2E2E5C] text-white font-black text-base px-6 py-3.5 rounded-full shadow-[0_4px_0_#1b1b3e] hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-[0_0_0_#1b1b3e] transition-all"
    >
      {children}
    </Link>
  );
}
