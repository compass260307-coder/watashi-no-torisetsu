"use client";

// プレミアム化 v3 Day 3: /settings タブ集約ページ (Web ファースト版)
//
// LIFF 認可を撤去。Cookie wn_session で各 API 呼び出し。
// 通知タブはプレースホルダ表示 (Phase 2 復活待ち)。
// 削除タブは Cookie 認可で /api/account/delete を叩く。
// ヘルプタブは静的。

import { useState } from "react";
import Link from "next/link";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { HelpFAQ } from "@/components/settings/HelpFAQ";

type Tab = "notifications" | "delete" | "help";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("notifications");

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-8 max-w-lg mx-auto w-full pb-12">
        <SettingsHeader />
        <SettingsTabBar tab={tab} setTab={setTab} />

        {tab === "notifications" && <NotificationSettings />}
        {tab === "delete" && <DeleteAccount />}
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
