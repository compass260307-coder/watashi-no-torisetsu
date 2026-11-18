"use client";

// Alice・占星術・タロットの切り替えタブ (日本語版のみ / 2026-11-19)。
// 下部ナビは「Alice」1枠にまとめ、どの占いを使うかはここで選ぶ。
//   - 購入済み (または権限の確認中) の占いはそのままページへ移動する。
//     確認中に未購入だった場合も、各ページのサーバーガードが課金カードへ戻す。
//   - 未購入・未診断の占いは、BottomNav の鍵タブと同じ課金カード / 診断案内を
//     その場で開く (ページを離れない)。

import { requestFortuneLock, type FortuneLockTarget } from "@/lib/fortune-switch";
import { useFullAccessStatus } from "@/lib/use-course-navigation-access";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

type Item = {
  key: "alice" | FortuneLockTarget;
  label: string;
  href: string;
};

const ITEMS: Item[] = [
  { key: "alice", label: "Alice", href: "/hoshiyomi" },
  { key: "unmei", label: "占星術", href: "/unmei" },
  { key: "tarot", label: "タロット", href: "/tarot" },
];

// localStorage の owner_token を読む。SSR / 初回 hydration 中は undefined (= 未確認)。
const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const readOwnerToken = (): string | null => {
  try {
    return localStorage.getItem("torisetsu_owner_token");
  } catch {
    return null;
  }
};
const readOwnerTokenOnServer = (): string | null | undefined => undefined;

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="currentColor" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function FortuneSwitcher({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const storedToken = useSyncExternalStore<string | null | undefined>(
    subscribeStorage,
    readOwnerToken,
    readOwnerTokenOnServer,
  );
  const tokenChecked = storedToken !== undefined;
  const ownerToken = storedToken ?? null;
  const access = useFullAccessStatus(ownerToken);

  const activeKey: Item["key"] = pathname.startsWith("/unmei")
    ? "unmei"
    : pathname.startsWith("/tarot")
      ? "tarot"
      : "alice";

  // 未診断 (token 無し) は確定でロック。token ありで権限確認中はリンク扱い。
  const isLocked = (key: FortuneLockTarget) =>
    tokenChecked && (!ownerToken || (access !== null && !access[key]));

  return (
    <nav
      aria-label="占いをえらぶ"
      className={`mx-auto w-full max-w-[480px] px-4 ${className}`}
    >
      <div className="grid grid-cols-3 gap-1 rounded-full bg-[#2A3A5C]/[0.07] p-1">
        {ITEMS.map((item) => {
          const active = item.key === activeKey;
          const base =
            "flex h-10 items-center justify-center gap-1 rounded-full text-[14px] font-bold transition-colors touch-manipulation active:scale-95";
          const tone = active
            ? "bg-white text-[#2A3A5C] shadow-[0_1px_4px_rgba(42,58,92,0.16)]"
            : "text-[#2A3A5C]";
          if (item.key !== "alice" && !active && isLocked(item.key)) {
            const target = item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-label={`${item.label}（ロック中）`}
                className={`${base} ${tone}`}
                onClick={() =>
                  requestFortuneLock({
                    target,
                    source: `alice_switcher_${target}`,
                  })
                }
              >
                <LockIcon />
                {item.label}
              </button>
            );
          }
          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`${base} ${tone}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
