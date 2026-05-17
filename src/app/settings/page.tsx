"use client";

// Phase 3-β D-10 + D-11 + D-12: /settings タブ集約ページ (LIFF 上で開く想定)
//
// 構造:
//   LIFF init → id_token 取得 (削除タブ等で必須)
//   タブ切替: 🔔 通知 / 🗑️ 削除 / ❓ ヘルプ
//   ❓ ヘルプタブは id_token なくても見られる (静的)
//   通知 / 削除は id_token 必須

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { HelpFAQ } from "@/components/settings/HelpFAQ";

type Tab = "notifications" | "delete" | "help";
type Status = "loading" | "missing-liff" | "needs-liff" | "ready" | "error";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("notifications");
  const [status, setStatus] = useState<Status>("loading");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const initialized = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
    if (!liffId) {
      setStatus("missing-liff");
      return;
    }
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const token = liff.getIDToken();
        if (!token) {
          setStatus("error");
          setErrorMessage("LIFF id_token not available");
          return;
        }
        setIdToken(token);
        setStatus("ready");
      } catch (err) {
        console.error("[settings] init error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    })();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ステータス別レンダリング
  if (status === "loading") {
    return (
      <div className="flex flex-col flex-1 px-5 py-8 max-w-lg mx-auto w-full">
        <SettingsHeader />
        <p className="text-sm text-muted text-center py-10">読み込み中...</p>
      </div>
    );
  }
  if (status === "missing-liff") {
    return (
      <div className="flex flex-col flex-1 px-5 py-8 max-w-lg mx-auto w-full">
        <SettingsHeader />
        <p className="text-sm text-muted text-center py-10">
          LIFF 設定が見つかりません
          <br />
          管理者にお問い合わせください
        </p>
      </div>
    );
  }
  if (status === "needs-liff") {
    return (
      <div className="flex flex-col flex-1 px-5 py-8 max-w-lg mx-auto w-full">
        <SettingsHeader />
        <p className="text-sm text-muted text-center py-10">
          LINE 内で開いてください
          <br />
          <span className="text-xs">(LIFF 経由でのみ利用できます)</span>
        </p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 px-5 py-8 max-w-lg mx-auto w-full">
        <SettingsHeader />
        <div className="text-center py-10">
          <p className="text-sm text-foreground mb-2">
            読み込みに失敗しました
          </p>
          <p className="text-xs text-muted">{errorMessage}</p>
        </div>
      </div>
    );
  }

  // ready: タブ切替で本体描画
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-8 max-w-lg mx-auto w-full pb-12">
        <SettingsHeader />
        <SettingsTabBar tab={tab} setTab={setTab} />

        {tab === "notifications" && idToken && (
          <NotificationSettings idToken={idToken} />
        )}
        {tab === "delete" && idToken && <DeleteAccount idToken={idToken} />}
        {tab === "help" && <HelpFAQ />}

        <Link
          href="/zukan-mine"
          className="text-xs text-muted/70 underline hover:text-foreground text-center mt-10"
        >
          🎴 マイ図鑑に戻る
        </Link>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-all border-b-2 -mb-px ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// react-hooks/static-components: コンポーネントは render 外で宣言する
function SettingsHeader() {
  return (
    <header className="text-center mb-5">
      <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
        SETTINGS
      </p>
      <h1 className="text-2xl font-extrabold">⚙️ 設定</h1>
    </header>
  );
}

function SettingsTabBar({
  tab,
  setTab,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6 border-b border-card-border">
      <TabButton
        active={tab === "notifications"}
        onClick={() => setTab("notifications")}
        icon="🔔"
        label="通知"
      />
      <TabButton
        active={tab === "delete"}
        onClick={() => setTab("delete")}
        icon="🗑️"
        label="削除"
      />
      <TabButton
        active={tab === "help"}
        onClick={() => setTab("help")}
        icon="❓"
        label="ヘルプ"
      />
    </div>
  );
}
