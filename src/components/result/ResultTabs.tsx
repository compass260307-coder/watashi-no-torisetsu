"use client";

// 結果ページの「自分が見た自分 / 友達が見た自分」2 タブ。
// 名前 (CharacterHero) はタブの外 (上部固定) に置き、その下をこのタブで対等に切り替える。
//
// - パネル本文はサーバ側で描画して props で受け取る (selfPanel / friendPanel)。
// - 切り替えはタップ + 横スワイプの両対応。デフォルトは自分タブ。
// - friendBadge=true (友達3人以上) のとき友達タブに新着ドット。

import { useRef, useState, type ReactNode } from "react";

interface ResultTabsProps {
  selfPanel: ReactNode;
  friendPanel: ReactNode;
  /** 友達3人以上で友達タブに新着ドットを付ける。 */
  friendBadge?: boolean;
}

type TabKey = "self" | "friend";

const SWIPE_THRESHOLD = 50; // px

export function ResultTabs({
  selfPanel,
  friendPanel,
  friendBadge = false,
}: ResultTabsProps) {
  const [active, setActive] = useState<TabKey>("self");
  const touchStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (dx <= -SWIPE_THRESHOLD && active === "self") setActive("friend");
    else if (dx >= SWIPE_THRESHOLD && active === "friend") setActive("self");
    touchStartX.current = null;
  };

  const tabClass = (key: TabKey) =>
    `relative flex-1 rounded-full border-2 px-4 py-2.5 text-sm font-black transition-colors ${
      active === key
        ? "bg-[#3A2D6B] text-white border-[#3A2D6B]"
        : "bg-white text-[#3A2D6B] border-[#0094D8]/25"
    }`;

  return (
    <div>
      <div
        role="tablist"
        aria-label="結果の見方"
        className="flex gap-2 mb-6"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === "self"}
          onClick={() => setActive("self")}
          className={tabClass("self")}
        >
          自分が見た自分
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "friend"}
          onClick={() => setActive("friend")}
          className={tabClass("friend")}
        >
          友達が見た自分
          {friendBadge && (
            <span
              aria-label="新着あり"
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FE3C72] border-2 border-white"
            />
          )}
        </button>
      </div>

      <div role="tabpanel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {active === "self" ? selfPanel : friendPanel}
      </div>
    </div>
  );
}
