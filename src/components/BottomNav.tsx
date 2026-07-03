"use client";

// 全ページ共通の下部固定ナビ (16personalities 風)。ハンバーガーメニューの代替。
//   - fixed bottom-0 全幅・白地・上端 0.5px 境界線 + 淡い上向き影・角丸なし。
//   - 中身は max-w-[480px] 中央寄せ (PCでもアプリ風に中央に収める。md:hidden にはしない)。
//   - 5列均等 grid。各列アイコン(インラインSVG)+ラベル(10px)縦積み。
//   - 配色は全ネイビー濃淡: アクティブ #2A3A5C / 非アクティブ #9BA3B4。
//   - アクティブ項目の上端に短いインジケーターバー (幅34px・高さ3px・角丸)。
//   - iOS セーフエリア: paddingBottom: env(safe-area-inset-bottom)。
//   - アクティブ判定は usePathname()。トリセツ(2) の URL は既存 HamburgerMenu と同じく
//     localStorage torisetsu_owner_token から /me/[token] を解決 (無ければ /diagnosis)。

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactElement } from "react";

// アクティブ=ブランドのディープネイビー / 非アクティブ=グレーネイビー。
const ACTIVE = "#2A3A5C";
const INACTIVE = "#9BA3B4";

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V19h12v-8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.5 11h7M8.5 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserSearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="8" r="3.4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-3.3 2.7-5.5 6-5.5 1 0 1.9.2 2.7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="m21 20-1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14.6c2 .6 3.5 2.4 3.5 4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  // トリセツ(2) の遷移先: localStorage の owner_token から /me/[token] を解決。
  // 無ければ /diagnosis (既存 HamburgerMenu の挙動をそのまま踏襲)。
  const [torisetsuUrl, setTorisetsuUrl] = useState("/diagnosis");
  useEffect(() => {
    // localStorage は SSR 時に存在しないため初期化子では読めず、マウント後に読む。
    // この用途 (外部ストレージ→state の同期) は set-state-in-effect の正当なケース。
    try {
      const token = localStorage.getItem("torisetsu_owner_token");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (token) setTorisetsuUrl(`/me/${token}`);
    } catch {
      // localStorage 不可環境は /diagnosis のまま。
    }
  }, []);

  const items: {
    key: string;
    label: string;
    href: string;
    active: boolean;
    Icon: () => ReactElement;
  }[] = [
    { key: "home", label: "トップ", href: "/?stay=1", active: pathname === "/", Icon: HomeIcon },
    { key: "me", label: "トリセツ", href: torisetsuUrl, active: pathname.startsWith("/me"), Icon: ClipboardIcon },
    { key: "diagnosis", label: "自己診断", href: "/diagnosis", active: pathname.startsWith("/diagnosis"), Icon: UserSearchIcon },
    { key: "friend", label: "他己診断", href: "/friend-evaluation", active: pathname.startsWith("/friend-evaluation"), Icon: UsersIcon },
    { key: "type", label: "タイプ", href: "/zukan-internal", active: pathname.startsWith("/zukan"), Icon: GridIcon },
  ];

  return (
    <nav
      aria-label="グローバルナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 bg-white"
      style={{
        borderTop: "0.5px solid rgba(42,58,92,0.14)",
        boxShadow: "0 -2px 10px rgba(42,58,92,0.06)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto grid max-w-[480px] grid-cols-5">
        {items.map((it) => {
          const { Icon } = it;
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={it.active ? "page" : undefined}
              className="relative flex flex-col items-center justify-center gap-1 py-2"
              style={{ color: it.active ? ACTIVE : INACTIVE }}
            >
              {it.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-[3px] w-[34px] rounded-full"
                  style={{ background: ACTIVE }}
                />
              )}
              <Icon />
              <span className="text-[10px] font-bold leading-none">
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
