"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Preset, Stats } from "./admin-types";
import {
  buildStatsUrl,
  COURSE_LABELS,
  downloadStatsCsv,
  formatMoney,
  formatRevenue,
  getHeadlines,
  KO_COURSE_LABELS,
  PAYMENT_KIND_LABELS,
  pct,
  periodLabel,
  PRESETS,
  previousRangeFor,
  rangeFor,
  toLocalDate,
} from "./admin-utils";

type IconName =
  | "overview"
  | "revenue"
  | "unmei"
  | "alice"
  | "growth"
  | "acquisition"
  | "library"
  | "menu"
  | "close"
  | "refresh"
  | "download"
  | "logout"
  | "calendar"
  | "arrow"
  | "check"
  | "alert"
  | "lock";

const NAV_ITEMS: {
  id: string;
  href: string;
  label: string;
  group: string;
  icon: IconName;
}[] = [
  { id: "overview", href: "#overview", label: "サマリー", group: "メイン", icon: "overview" },
  { id: "revenue", href: "#revenue", label: "売上・購入", group: "ビジネス", icon: "revenue" },
  { id: "unmei", href: "#unmei", label: "運命の設計図", group: "商品", icon: "unmei" },
  { id: "alice", href: "#alice", label: "Alice", group: "商品", icon: "alice" },
  { id: "alice-plus", href: "#alice-plus", label: "Alice Plus", group: "商品", icon: "alice" },
  { id: "friend-funnel", href: "#friend-funnel", label: "友達・拡散", group: "成長", icon: "growth" },
  { id: "acquisition", href: "#acquisition", label: "流入・集客", group: "成長", icon: "acquisition" },
];

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  revenue: <><path d="M12 2v20M17 6.5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H7"/></>,
  unmei: <><path d="m12 3 8 14H4L12 3Z"/><path d="M12 3v18M4 17h16M7 8l2 2m8-2-2 2"/></>,
  alice: <><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m12 8 .7 1.5 1.6.7-1.6.7L12 13l-.7-2.1-1.6-.7 1.6-.7L12 8Z"/></>,
  growth: <><path d="M4 19V9m6 10V5m6 14v-7m4 7V3"/></>,
  acquisition: <><circle cx="12" cy="12" r="8"/><path d="M12 8v8m-4-4h8M5 5l3 3m11-3-3 3"/></>,
  library: <><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/></>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 20h16"/></>,
  logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  alert: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4m0 3h.01"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
};

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function isStats(value: unknown): value is Stats {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Stats>;
  return Boolean(
    candidate.coreKpis?.periodRevenue &&
      candidate.coreKpis?.dataQuality &&
      Array.isArray(candidate.paywallFunnel) &&
      Array.isArray(candidate.revenueByKind) &&
      Array.isArray(candidate.alice?.funnel) &&
      candidate.friendDiagnosisFunnel &&
      Array.isArray(candidate.selfResultShareFunnel?.steps) &&
      candidate.acquisitionStats,
  );
}

function AdminLogin({
  inputKey,
  setInputKey,
  error,
  onSubmit,
  siteLocale,
}: {
  inputKey: string;
  setInputKey: (value: string) => void;
  error: string;
  onSubmit: (event: React.FormEvent) => void;
  siteLocale?: "ja" | "ko";
}) {
  const isKoreanProperty = siteLocale === "ko";
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f7fb] px-4 py-8 text-[#172033] sm:px-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#dfe7ff] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-[#ebe4ff] blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1080px] items-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-[#e0e5ef] bg-white shadow-[0_28px_80px_rgba(38,49,86,0.13)] md:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden overflow-hidden bg-[#15203a] p-12 text-white md:flex md:min-h-[610px] md:flex-col md:justify-between lg:p-14">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[42px] border-white/[0.04]" />
            <div className="absolute bottom-14 right-12 grid grid-cols-5 gap-2 opacity-20">
              {Array.from({ length: 25 }, (_, index) => (
                <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#8aa4ff]" />
              ))}
            </div>
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#4f6fec] shadow-lg shadow-[#4f6fec]/25">
                  <Icon name="overview" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{isKoreanProperty ? "나의 사용설명서" : "ワタシのトリセツ"}</p>
                  <p className="mt-0.5 text-[11px] text-white/55">{isKoreanProperty ? "Korea operations dashboard" : "Operations dashboard"}</p>
                </div>
              </div>
              <p className="mt-20 text-xs font-semibold tracking-[0.18em] text-[#9fb3ff]">{isKoreanProperty ? "KOREA PRIVATE CONSOLE" : "PRIVATE CONSOLE"}</p>
              <h1 className="mt-5 text-[44px] font-semibold leading-[1.14] tracking-[-0.045em] lg:text-[52px]">
                {isKoreanProperty ? "韓国の動きを、" : "今日の動きを、"}
                <br />迷わずつかむ。
              </h1>
              <p className="mt-6 max-w-md text-sm leading-7 text-white/62">
                {isKoreanProperty
                  ? "韓国語サイトの診断、KRW売上、拡散、集客をひとつの流れで確認できます。"
                  : "診断、売上、商品、拡散、集客。運営に必要な数字をひとつの流れで確認できます。"}
              </p>
            </div>
            <div className="relative flex items-center gap-3 text-xs text-white/55">
              <span className="h-2 w-2 rounded-full bg-[#62d39a] shadow-[0_0_0_5px_rgba(98,211,154,0.1)]" />
              管理者専用・検索エンジン非公開
            </div>
          </section>

          <section className="flex min-h-[560px] items-center p-7 sm:p-11 lg:p-14">
            <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf1ff] text-[#405fd4]">
                <Icon name="lock" className="h-5 w-5" />
              </span>
              <p className="mt-8 text-xs font-semibold tracking-[0.14em] text-[#60708f]">ADMIN LOGIN</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">{isKoreanProperty ? <>韓国管理画面<br />ログイン</> : "管理画面へログイン"}</h2>
              <p className="mt-3 text-sm leading-6 text-[#68748a]">管理パスワードを入力してください。</p>
              <label htmlFor="admin-password" className="mt-9 block text-xs font-semibold text-[#3d4a61]">
                管理パスワード
              </label>
              <input
                id="admin-password"
                type="password"
                value={inputKey}
                onChange={(event) => setInputKey(event.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                autoFocus
                className="mt-2.5 w-full rounded-2xl border border-[#ccd4e3] bg-white px-4 py-3.5 text-base outline-none transition placeholder:text-[#a0a9b9] focus:border-[#5270e8] focus:ring-4 focus:ring-[#5270e8]/10"
              />
              {error && (
                <p role="alert" className="mt-3 flex items-center gap-2 text-xs font-medium text-[#b42318]">
                  <Icon name="alert" className="h-4 w-4" />
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={!inputKey.trim()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#405fd4] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#405fd4]/20 transition hover:bg-[#3452c5] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ログイン
                <Icon name="arrow" className="h-4 w-4" />
              </button>
              <p className="mt-6 text-center text-[11px] text-[#8a94a7]">パスワードはこのタブ内にのみ保存されます</p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function Sidebar({
  activeSection,
  mobileOpen,
  onClose,
  onLogout,
  updatedAt,
  dataReady,
  siteLocale,
}: {
  activeSection: string;
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  updatedAt: string | null;
  dataReady: boolean;
  siteLocale?: "ja" | "ko";
}) {
  const isKoreanProperty = siteLocale === "ko";
  const content = (
    <>
      <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.08] px-5">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#506ee8] text-white shadow-lg shadow-black/15">
          <Icon name="overview" className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{isKoreanProperty ? "나의 사용설명서" : "ワタシのトリセツ"}</p>
          <p className="mt-0.5 text-[10px] tracking-[0.12em] text-white/40">{isKoreanProperty ? "KOREA ADMIN CONSOLE" : "ADMIN CONSOLE"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="メニューを閉じる" className="grid h-9 w-9 place-items-center rounded-xl text-white/60 hover:bg-white/10 lg:hidden">
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>
      <div className="border-b border-white/[0.08] px-4 py-4">
        <p className="px-2 text-[9px] font-semibold tracking-[0.15em] text-white/35">PROPERTY</p>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-3">
          <span className="h-2 w-2 rounded-full bg-[#62d39a]" />
          <span className="truncate text-xs font-medium text-white/80">watashi-torisetsu.com{isKoreanProperty ? "/ko" : ""}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-black/10 p-1 text-[10px] font-semibold">
          <Link href="/admin" className={`rounded-lg px-2 py-2 text-center transition ${isKoreanProperty ? "text-white/45 hover:text-white" : "bg-white/12 text-white"}`}>JP / 全体</Link>
          <Link href="/ko/admin" className={`rounded-lg px-2 py-2 text-center transition ${isKoreanProperty ? "bg-white/12 text-white" : "text-white/45 hover:text-white"}`}>KR</Link>
        </div>
      </div>
      <nav aria-label="管理画面メニュー" className="flex-1 overflow-y-auto px-3 py-4">
        {Array.from(new Set(NAV_ITEMS.map((item) => item.group))).map((group) => (
          <div key={group} className="mb-5">
            <p className="mb-1.5 px-3 text-[9px] font-semibold tracking-[0.15em] text-white/30">{group.toUpperCase()}</p>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const active = item.id === activeSection;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${active ? "bg-[#506ee8] text-white shadow-lg shadow-black/10" : "text-white/58 hover:bg-white/[0.07] hover:text-white"}`}
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
        <Link href="/admin/social" className="mt-2 flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 text-[13px] font-medium text-white/58 transition hover:bg-white/[0.07] hover:text-white">
          <Icon name="library" className="h-[18px] w-[18px]" />
          SNS素材ライブラリ
        </Link>
      </nav>
      <div className="border-t border-white/[0.08] p-3">
        <div className="rounded-2xl bg-white/[0.055] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[11px] font-medium text-white/65">
              <span className={`h-2 w-2 rounded-full ${dataReady ? "bg-[#62d39a]" : "bg-[#f5b84b]"}`} />
              {dataReady ? "データ正常" : "確認が必要"}
            </span>
            <span className="text-[10px] tabular-nums text-white/35">
              {updatedAt ? new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(updatedAt)) : "—"}
            </span>
          </div>
          <button type="button" onClick={onLogout} className="mt-3 flex w-full items-center gap-2 border-t border-white/[0.08] pt-3 text-left text-[11px] font-medium text-white/45 hover:text-white">
            <Icon name="logout" className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </div>
    </>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col bg-[#141d31] lg:flex">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" onClick={onClose} aria-label="メニューを閉じる" className="absolute inset-0 bg-[#0b1020]/55 backdrop-blur-sm" />
          <aside className="relative flex h-full w-[286px] flex-col bg-[#141d31] shadow-2xl">{content}</aside>
        </div>
      )}
    </>
  );
}

function MobileHeader({ onMenu, siteLocale }: { onMenu: () => void; siteLocale?: "ja" | "ko" }) {
  const isKoreanProperty = siteLocale === "ko";
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e1e5ed] bg-white/95 px-4 backdrop-blur lg:hidden">
      <button type="button" onClick={onMenu} aria-label="メニューを開く" className="grid h-10 w-10 place-items-center rounded-xl border border-[#e1e5ed] text-[#3d4a61]">
        <Icon name="menu" className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#506ee8] text-white"><Icon name="overview" className="h-4 w-4" /></span>
        <div><p className="text-xs font-semibold text-[#172033]">{isKoreanProperty ? "韓国サイト管理" : "管理コンソール"}</p><p className="text-[9px] text-[#8490a5]">watashi-torisetsu.com{isKoreanProperty ? "/ko" : ""}</p></div>
      </div>
      <div className="h-10 w-10" />
    </header>
  );
}

function PeriodControls({
  preset,
  customFrom,
  customTo,
  loading,
  onPreset,
  onFrom,
  onTo,
  onRefresh,
  onDownload,
}: {
  preset: Preset;
  customFrom: string;
  customTo: string;
  loading: boolean;
  onPreset: (preset: Preset) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onRefresh: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#e1e5ed] bg-white p-3 shadow-[0_1px_2px_rgba(26,34,56,0.04)] sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-[#7d899e]">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            表示期間
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#f3f5f9] p-1" role="group" aria-label="表示期間">
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={preset === item.key}
                onClick={() => onPreset(item.key)}
                className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold transition sm:px-3.5 ${preset === item.key ? "bg-white text-[#3554ca] shadow-sm ring-1 ring-[#dfe4f1]" : "text-[#67748a] hover:text-[#263248]"}`}
              >
                <span className="sm:hidden">{item.shortLabel}</span><span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {preset === "custom" && (
            <>
              <label className="text-[10px] font-medium text-[#6f7b90]">開始<input type="date" value={customFrom} max={customTo} onChange={(event) => onFrom(event.target.value)} className="mt-1 block rounded-xl border border-[#d9deea] bg-white px-3 py-2 text-xs text-[#263248]" /></label>
              <span className="pb-2.5 text-[#9aa3b3]">〜</span>
              <label className="text-[10px] font-medium text-[#6f7b90]">終了<input type="date" value={customTo} min={customFrom} onChange={(event) => onTo(event.target.value)} className="mt-1 block rounded-xl border border-[#d9deea] bg-white px-3 py-2 text-xs text-[#263248]" /></label>
            </>
          )}
          <button type="button" onClick={onDownload} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d9deea] bg-white text-[#5f6d84] hover:bg-[#f7f8fb]" aria-label="CSVを出力"><Icon name="download" className="h-[18px] w-[18px]" /></button>
          <button type="button" onClick={onRefresh} disabled={loading} className="flex h-10 items-center gap-2 rounded-xl bg-[#405fd4] px-4 text-xs font-semibold text-white shadow-md shadow-[#405fd4]/15 hover:bg-[#3452c5] disabled:opacity-55">
            <Icon name="refresh" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "更新中" : "更新"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#e1e5ed] bg-white shadow-[0_1px_3px_rgba(24,32,52,0.045)] ${className}`}>{children}</div>;
}

function SectionHeader({ kicker, title, description, side }: { kicker: string; title: string; description: string; side?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] font-semibold tracking-[0.16em] text-[#526fe1]">{kicker}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033] sm:text-[28px]">{title}</h2><p className="mt-1.5 max-w-2xl text-xs leading-6 text-[#748097]">{description}</p></div>
      {side}
    </div>
  );
}

const CARD_TONES = {
  indigo: { bar: "bg-[#506ee8]", soft: "bg-[#eef1ff] text-[#405fd4]", value: "text-[#3454c7]" },
  emerald: { bar: "bg-[#44a46f]", soft: "bg-[#edf8f1] text-[#2d7c50]", value: "text-[#2e7d50]" },
  amber: { bar: "bg-[#e5a93d]", soft: "bg-[#fff7e8] text-[#9a6812]", value: "text-[#96640f]" },
  cyan: { bar: "bg-[#41a4b2]", soft: "bg-[#ebf8fa] text-[#27747f]", value: "text-[#277783]" },
};

function MetricCard({ label, value, unit, hint, badge, comparison, tone = "indigo" }: { label: string; value: string; unit?: string; hint: string; badge: string; comparison?: string | null; tone?: keyof typeof CARD_TONES }) {
  const colors = CARD_TONES[tone];
  return (
    <article className="relative min-h-[194px] overflow-hidden rounded-2xl border border-[#e1e5ed] bg-white p-5 shadow-[0_1px_3px_rgba(24,32,52,0.045)]">
      <span className={`absolute inset-x-0 top-0 h-1 ${colors.bar}`} />
      <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-[#56647b]">{label}</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${colors.soft}`}>{badge}</span></div>
      <p className={`mt-7 break-words text-[35px] font-semibold leading-none tracking-[-0.045em] tabular-nums ${colors.value}`}>{value}{unit && <span className="ml-1.5 text-base font-medium text-[#7b879b]">{unit}</span>}</p>
      {comparison && <p className="mt-4 inline-flex rounded-lg bg-[#f5f6f9] px-2.5 py-1.5 text-[10px] font-medium text-[#69758a]">{comparison}</p>}
      <p className="mt-4 border-t border-[#edf0f4] pt-3 text-[10px] leading-5 text-[#7d889b]">{hint}</p>
    </article>
  );
}

function TrendChart({ points }: { points: { date: string; count: number }[] }) {
  if (points.length === 0) return <div className="grid h-64 place-items-center text-xs text-[#8a94a7]">期間内のデータがありません</div>;
  const width = 760; const height = 280; const left = 48; const right = 18; const top = 20; const bottom = 42;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const max = Math.max(...points.map((point) => point.count), 1);
  const chartPoints = points.map((point, index) => ({ ...point, x: points.length === 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth, y: top + plotHeight - (point.count / max) * plotHeight }));
  const line = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${left},${top + plotHeight} ${line} ${width - right},${top + plotHeight}`;
  const labels = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));
  return (
    <div className="h-[280px] w-full overflow-hidden" role="img" aria-label="自己診断完了の日別推移">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        <defs><linearGradient id="diagnosis-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#506ee8" stopOpacity="0.22"/><stop offset="100%" stopColor="#506ee8" stopOpacity="0.01"/></linearGradient></defs>
        {[0, .25, .5, .75, 1].map((ratio) => { const y = top + plotHeight - ratio * plotHeight; return <g key={ratio}><line x1={left} x2={width-right} y1={y} y2={y} stroke="#e8ebf1"/><text x={left-10} y={y+4} textAnchor="end" fill="#8b96a9" fontSize="10">{Math.round(max*ratio)}</text></g>; })}
        {chartPoints.length > 1 && <polygon points={area} fill="url(#diagnosis-fill)"/>}
        {chartPoints.length > 1 ? <polyline points={line} fill="none" stroke="#506ee8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/> : <circle cx={chartPoints[0].x} cy={chartPoints[0].y} r="5" fill="#506ee8"/>}
        {labels.map((index) => { const point = chartPoints[index]; const date = new Date(`${point.date}T00:00:00`); return <text key={point.date} x={point.x} y={height-13} textAnchor={index===0?"start":index===points.length-1?"end":"middle"} fill="#8b96a9" fontSize="10">{`${date.getMonth()+1}/${date.getDate()}`}</text>; })}
      </svg>
    </div>
  );
}

function Funnel({ steps, baseLabel = "前段比", accent = "indigo" }: { steps: { label: string; count: number }[]; baseLabel?: string; accent?: "indigo" | "emerald" | "violet" }) {
  const max = Math.max(...steps.map((step) => step.count), 1);
  const bars = { indigo: "bg-[#506ee8]", emerald: "bg-[#43a26d]", violet: "bg-[#7b61d6]" };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[#edf0f4] pb-2 text-[9px] font-semibold tracking-[0.08em] text-[#929caf]"><span>ステップ</span><span>{baseLabel}</span></div>
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].count : null;
        const rate = previous && previous > 0 ? step.count / previous : null;
        return <div key={`${step.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-4"><div className="min-w-0"><div className="flex items-center justify-between gap-3"><p className="truncate text-[11px] font-medium text-[#425068]" title={step.label}>{step.label}</p><span className="text-xs font-semibold tabular-nums text-[#1f2b40]">{step.count.toLocaleString()}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0f5]"><span className={`block h-full rounded-full ${bars[accent]}`} style={{ width: `${Math.max(step.count > 0 ? 3 : 0, (step.count/max)*100)}%` }}/></div></div><span className="text-right text-[11px] font-semibold tabular-nums text-[#7b8799]">{index === 0 ? "起点" : pct(rate)}</span></div>;
      })}
    </div>
  );
}

function ReachFunnel({ steps, rateKey }: { steps: Stats["friendDiagnosisFunnel"]["ownerFunnel"] | Stats["friendDiagnosisFunnel"]["friendFunnel"] | Stats["selfResultShareFunnel"]["steps"]; rateKey: "rateFromDiagnosis" | "rateFromLanding" | "rateFromResult" }) {
  const max = Math.max(...steps.map((step) => step.count), 1);
  return <ol className="space-y-3">{steps.map((step, index) => {
    const baseRate = rateKey in step ? (step as unknown as Record<string, number>)[rateKey] : 0;
    return <li key={step.key} className="rounded-xl border border-[#e8ebf1] bg-[#fafbfc] p-3.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf1ff] text-[10px] font-semibold tabular-nums text-[#405fd4]">{String(index+1).padStart(2,"0")}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold text-[#324057]" title={step.label}>{step.label}</p><p className="text-sm font-semibold tabular-nums text-[#172033]">{step.count.toLocaleString()}<span className="ml-0.5 text-[10px] font-medium text-[#8a94a6]">人</span></p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7eaf0]"><span className="block h-full rounded-full bg-[#506ee8]" style={{width:`${Math.max(step.count>0?3:0,(step.count/max)*100)}%`}}/></div></div></div><div className="mt-3 flex justify-end gap-2 text-[9px] font-medium"><span className="rounded-md bg-white px-2 py-1 text-[#68758b] ring-1 ring-[#e3e7ee]">全体比 {pct(baseRate)}</span><span className="rounded-md bg-white px-2 py-1 text-[#68758b] ring-1 ring-[#e3e7ee]">前段比 {step.rateFromPrevious === null ? "起点" : pct(step.rateFromPrevious)}</span></div></li>;
  })}</ol>;
}

function LoadingDashboard() {
  return (
    <div className="animate-pulse space-y-6" aria-label="データを読み込み中">
      <div className="h-24 rounded-2xl bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4},(_,index)=><div key={index} className="h-48 rounded-2xl bg-white" />)}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]"><div className="h-[360px] rounded-2xl bg-white"/><div className="h-[360px] rounded-2xl bg-white"/></div>
      <p className="text-center text-xs font-medium text-[#7e899c]">集計データを読み込んでいます。初回は20秒ほどかかる場合があります。</p>
    </div>
  );
}

export default function AdminDashboard({ siteLocale }: { siteLocale?: "ja" | "ko" }) {
  const isKoreanProperty = siteLocale === "ko";
  const [inputKey, setInputKey] = useState("");
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [comparison, setComparison] = useState<{ stats: Stats; label: string } | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(() => toLocalDate(new Date()));
  const [customTo, setCustomTo] = useState(() => toLocalDate(new Date()));
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const statsRef = useRef<Stats | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("torisetsu_admin_key");
    if (!stored) return;
    const timer = window.setTimeout(() => setAdminKey(stored), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const fetchStats = useCallback(async (key: string, selectedPreset: Preset, from: string, to: string, fresh = false) => {
    const range = rangeFor(selectedPreset, from, to);
    if (selectedPreset === "custom" && !range) {
      setError("開始日と終了日を確認してください");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(buildStatsUrl(range, fresh, siteLocale), {
        headers: { "x-admin-key": key },
        signal: controller.signal,
      });
      if (response.status === 401) {
        sessionStorage.removeItem("torisetsu_admin_key");
        statsRef.current = null;
        setStats(null);
        setAdminKey(null);
        setLoginError("パスワードが正しくありません");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (!isStats(payload)) throw new Error("Unexpected response shape");
      statsRef.current = payload;
      setStats(payload);
      setLastUpdatedAt(new Date().toISOString());
      sessionStorage.setItem("torisetsu_admin_key", key);
    } catch (fetchError) {
      if ((fetchError as Error).name !== "AbortError") {
        setError(statsRef.current ? "最新データの取得に失敗しました。表示中のデータはそのままです。" : "データを取得できませんでした。時間をおいて再試行してください。");
      }
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }, [siteLocale]);

  useEffect(() => {
    if (!adminKey) return;
    const timer = window.setTimeout(() => void fetchStats(adminKey, preset, customFrom, customTo), preset === "custom" ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [adminKey, preset, customFrom, customTo, fetchStats]);

  useEffect(() => {
    if (!stats) return;
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter((item): item is HTMLElement => Boolean(item));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-20% 0px -68% 0px", threshold: [0, .15, .45] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [stats]);

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    const key = inputKey.trim();
    if (!key) return;
    setLoginError("");
    sessionStorage.setItem("torisetsu_admin_key", key);
    setAdminKey(key);
  };

  const handleLogout = () => {
    requestRef.current?.abort();
    sessionStorage.removeItem("torisetsu_admin_key");
    statsRef.current = null;
    setAdminKey(null); setStats(null); setComparison(null); setInputKey(""); setError("");
  };

  const handlePreset = (next: Preset) => {
    setPreset(next); setComparison(null); setError("");
  };

  const loadComparison = async () => {
    if (!adminKey || !stats) return;
    const range = previousRangeFor(preset, customFrom, customTo);
    if (!range) { setError("この表示期間では前期間を比較できません"); return; }
    setComparisonLoading(true); setError("");
    try {
      const response = await fetch(buildStatsUrl(range, false, siteLocale), { headers: { "x-admin-key": adminKey } });
      if (!response.ok) throw new Error();
      const payload: unknown = await response.json();
      if (!isStats(payload)) throw new Error();
      setComparison({ stats: payload, label: range.label });
    } catch { setError("比較データの取得に失敗しました。現在期間の表示には影響ありません。"); }
    finally { setComparisonLoading(false); }
  };

  const comparisonHeadlines = comparison ? getHeadlines(comparison.stats) : null;
  const headlines = useMemo(() => stats ? getHeadlines(stats) : null, [stats]);

  if (!adminKey) return <AdminLogin inputKey={inputKey} setInputKey={setInputKey} error={loginError} onSubmit={handleLogin} siteLocale={siteLocale} />;

  const dataReady = stats?.coreKpis.dataQuality.ready ?? true;
  const paywallSteps = (stats?.paywallFunnel ?? []).filter((step) => step.label !== "解除ボタン押下");
  const unlockClicks = (stats?.paywallFunnel ?? []).find((step) => step.label === "解除ボタン押下")?.count ?? 0;
  const isLegacyPaywall = stats?.coursePaywall.version === "legacy";
  const displayedPaywallPlans = isLegacyPaywall
    ? (stats?.coursePaywall.plans ?? []).filter((plan) => plan.product === "full_access")
    : isKoreanProperty
      ? (stats?.coursePaywall.plans ?? [])
      : (["full_access", "self_report"] as const)
          .map((product) =>
            (stats?.coursePaywall.plans ?? []).find(
              (plan) => plan.product === product,
            ),
          )
          .filter((plan) => plan !== undefined);
  const largestDrop = paywallSteps.slice(1).map((step,index)=>({ from:paywallSteps[index], to:step, drop:Math.max(paywallSteps[index].count-step.count,0) })).sort((a,b)=>b.drop-a.drop)[0];
  const topSource = stats?.acquisitionStats.sources[0] ?? null;
  const courseLabels = isKoreanProperty ? KO_COURSE_LABELS : COURSE_LABELS;
  const actionItems = stats ? [
    { label: "売上", value: `${headlines?.revenue}・購入者 ${headlines?.payers.toLocaleString()}人`, href: "#revenue", tone: "bg-[#506ee8]" },
    { label: "最大の離脱", value: largestDrop ? `${largestDrop.from.label} → ${largestDrop.to.label} で ${largestDrop.drop.toLocaleString()}減少` : "ファネルデータなし", href: "#revenue", tone: "bg-[#e5a93d]" },
    { label: "最多の流入元", value: topSource ? `${topSource.source}・${topSource.users.toLocaleString()}人 (${pct(topSource.share)})` : "期間内の流入なし", href: "#acquisition", tone: "bg-[#43a26d]" },
  ] : [];

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <MobileHeader onMenu={() => setMobileOpen(true)} siteLocale={siteLocale} />
      <div className="flex min-h-screen">
        <Sidebar activeSection={activeSection} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={handleLogout} updatedAt={lastUpdatedAt} dataReady={dataReady} siteLocale={siteLocale} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 xl:py-8" aria-busy={loading}>
          <div className="mx-auto max-w-[1420px]">
            {error && <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-[#f0d2cc] bg-[#fff7f5] px-4 py-3 text-xs leading-5 text-[#9d3329]"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0"/><span className="flex-1">{error}</span><button type="button" onClick={()=>setError("")} className="text-[#9d3329]" aria-label="通知を閉じる"><Icon name="close" className="h-4 w-4"/></button></div>}
            {!stats ? (
              <LoadingDashboard />
            ) : (
              <>
                <section id="overview" className="scroll-mt-24">
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div><p className="text-[10px] font-semibold tracking-[0.16em] text-[#526fe1]">{isKoreanProperty ? "KOREA OVERVIEW" : "OVERVIEW"}</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em] sm:text-[36px]">{isKoreanProperty ? "韓国サイト運営サマリー" : "運営サマリー"}</h1><p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#768298]"><span className={`h-2 w-2 rounded-full ${dataReady ? "bg-[#4aad73]" : "bg-[#e5a93d]"}`}/>{dataReady ? "集計データは正常です" : "DB更新が必要な指標があります"}<span className="text-[#b1b8c4]">·</span>{periodLabel(preset,customFrom,customTo)}{isKoreanProperty ? <><span className="text-[#b1b8c4]">·</span><span className="rounded-full bg-[#edf1ff] px-2 py-0.5 font-semibold text-[#405fd4]">KRのみ</span></> : null}</p></div>
                    <button type="button" onClick={()=>void loadComparison()} disabled={comparisonLoading || preset === "all"} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-[#d9deea] bg-white px-4 text-[11px] font-semibold text-[#5e6b82] hover:bg-[#f9fafc] disabled:opacity-45 sm:self-auto"><Icon name="refresh" className={`h-3.5 w-3.5 ${comparisonLoading?"animate-spin":""}`}/>{comparison ? `${comparison.label}を再読込` : "前期間を比較"}</button>
                  </div>
                  <PeriodControls preset={preset} customFrom={customFrom} customTo={customTo} loading={loading} onPreset={handlePreset} onFrom={(value)=>{setCustomFrom(value);setComparison(null);}} onTo={(value)=>{setCustomTo(value);setComparison(null);}} onRefresh={()=>void fetchStats(adminKey,preset,customFrom,customTo,true)} onDownload={()=>downloadStatsCsv(stats,preset)} />

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="純売上" value={headlines!.revenue} badge="返金反映後" tone="emerald" comparison={comparisonHeadlines ? `${comparison!.label} ${comparisonHeadlines.revenue}` : null} hint={`決済 ${headlines!.purchases.toLocaleString()}件・購入者 ${headlines!.payers.toLocaleString()}人`} />
                    <MetricCard label="自己診断完了" value={headlines!.diagnosisUsers.toLocaleString()} unit="人" badge="ユニーク" comparison={comparisonHeadlines ? `${comparison!.label} ${comparisonHeadlines.diagnosisUsers.toLocaleString()}人` : null} hint={stats.coreKpis.cohort.definition} />
                    <MetricCard label="診断からの購入率" value={pct(headlines!.paidRate)} badge="診断 → 購入" tone="amber" comparison={comparisonHeadlines ? `${comparison!.label} ${pct(comparisonHeadlines.paidRate)}` : null} hint={`${stats.coreKpis.diagnosisToPaid.numerator.toLocaleString()}人 / ${stats.coreKpis.diagnosisToPaid.denominator.toLocaleString()}人`} />
                    <MetricCard label="診断から友達回答" value={pct(headlines!.friendRate)} badge="成長ループ" tone="cyan" comparison={comparisonHeadlines ? `${comparison!.label} ${pct(comparisonHeadlines.friendRate)}` : null} hint={`${stats.coreKpis.diagnosisToFriend.numerator.toLocaleString()}人 / ${stats.coreKpis.diagnosisToFriend.denominator.toLocaleString()}人`} />
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
                    <Panel className="overflow-hidden"><div className="flex flex-col gap-2 border-b border-[#edf0f4] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold">自己診断完了の推移</h2><p className="mt-1 text-[10px] text-[#7d899c]">1日ごとの完了ユーザー数（JST）</p></div><span className="flex items-center gap-2 text-[10px] font-medium text-[#526fe1]"><span className="h-0.5 w-5 bg-[#526fe1]"/>自己診断完了</span></div><div className="px-3 pb-3 pt-2 sm:px-5"><TrendChart points={stats.coreKpis.diagnosisTrend.points}/></div></Panel>
                    <Panel className="overflow-hidden"><div className="border-b border-[#edf0f4] p-5"><p className="text-[9px] font-semibold tracking-[0.14em] text-[#526fe1]">ACTION CENTER</p><h2 className="mt-2 text-base font-semibold">今見るポイント</h2></div><div>{actionItems.map((item)=><a key={item.label} href={item.href} className="group flex gap-3 border-b border-[#edf0f4] p-5 last:border-0 hover:bg-[#fafbfc]"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.tone}`}/><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-[#3e4b61]">{item.label}</p><p className="mt-1.5 text-[11px] leading-5 text-[#7a8699]">{item.value}</p></div><Icon name="arrow" className="mt-1 h-4 w-4 text-[#a4acb9] group-hover:text-[#526fe1]"/></a>)}</div></Panel>
                  </div>
                </section>

                <section id="revenue" className="scroll-mt-24 pt-16">
                  <SectionHeader kicker="BUSINESS" title="売上・購入" description="売上の結果と、購入導線のどこで離脱しているかを確認します。" side={<div className="rounded-xl border border-[#cfe8d8] bg-[#f0f9f3] px-4 py-3"><p className="text-[9px] font-semibold text-[#4c8965]">選択期間の純売上</p><p className="mt-1 text-lg font-semibold text-[#2f7950]">{headlines!.revenue}</p></div>} />
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
                    <Panel className="p-5 sm:p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">購入ファネル</h3><p className="mt-1 text-[10px] text-[#7d899d]">自己・友達・相性・運命・Aliceの現行課金カードを集計。解除導線 {unlockClicks.toLocaleString()}クリックは別集計</p></div><span className="rounded-lg bg-[#edf1ff] px-3 py-1.5 text-[10px] font-semibold text-[#405fd4]">カード表示 → 決済</span></div><Funnel steps={paywallSteps}/></Panel>
                    <Panel className="overflow-hidden"><div className="border-b border-[#edf0f4] p-5"><h3 className="text-sm font-semibold">商品別売上</h3><p className="mt-1 text-[10px] text-[#7d899d]">実決済・返金反映後</p></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[11px]"><thead className="bg-[#fafbfc] text-[#7c879a]"><tr><th className="px-4 py-3 font-medium">商品</th><th className="px-3 py-3 text-right font-medium">決済</th><th className="px-3 py-3 text-right font-medium">返金</th><th className="px-4 py-3 text-right font-medium">純売上</th></tr></thead><tbody>{stats.revenueByKind.length ? stats.revenueByKind.map((item)=><tr key={`${item.kind}-${item.currency}`} className="border-t border-[#edf0f4]"><td className="px-4 py-3.5 font-medium text-[#344158]">{PAYMENT_KIND_LABELS[item.kind]??item.kind}<span className="ml-2 text-[9px] text-[#9aa3b2]">{item.currency.toUpperCase()}</span></td><td className="px-3 py-3.5 text-right tabular-nums">{item.purchases}</td><td className="px-3 py-3.5 text-right tabular-nums text-[#b04a42]">{item.refundedMinor?`−${formatMoney(item.refundedMinor,item.currency)}`:"—"}</td><td className="px-4 py-3.5 text-right font-semibold tabular-nums">{formatMoney(item.netRevenueMinor,item.currency)}</td></tr>):<tr><td colSpan={4} className="px-4 py-10 text-center text-[#8b95a7]">期間内の決済はありません</td></tr>}</tbody></table></div></Panel>
                  </div>
                  <Panel className="mt-4 overflow-hidden">
                    <div className="flex flex-col gap-2 border-b border-[#edf0f4] p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div><h3 className="text-sm font-semibold">課金計測の健全性</h3><p className="mt-1 text-[10px] text-[#7d899d]">Stripe確定決済を基準に、アプリ内イベントと広告送信を照合・送信待ち {stats.purchaseTracking.serverQueuePending}件 / 再試行 {stats.purchaseTracking.serverQueueFailed}件</p></div>
                      <span className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold ${stats.purchaseTracking.missingPurchaseEvents===0?"bg-[#eef8f2] text-[#31845a]":"bg-[#fff3e8] text-[#aa6426]"}`}>{stats.purchaseTracking.missingPurchaseEvents===0?"購入イベント正常":`欠損 ${stats.purchaseTracking.missingPurchaseEvents}件`}</span>
                    </div>
                    <div className="grid divide-y divide-[#edf0f4] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                      <div className="p-5"><p className="text-[10px] font-medium text-[#7d899d]">確定決済 → 購入イベント</p><p className="mt-2 text-lg font-semibold tabular-nums">{stats.purchaseTracking.purchaseEvents}<span className="ml-1 text-[10px] font-medium text-[#8b95a6]">/ {stats.purchaseTracking.verifiedPayments}件</span></p></div>
                      <div className="p-5"><p className="text-[10px] font-medium text-[#7d899d]">ブラウザ送信</p><p className="mt-2 text-lg font-semibold tabular-nums">{stats.purchaseTracking.browserMetaPushed}<span className="ml-1 text-[10px] font-medium text-[#8b95a6]">件</span></p><p className="mt-1 text-[9px] text-[#8b95a6]">うちTikTok Pixel {stats.purchaseTracking.browserTikTokPushed}件</p></div>
                      <div className="p-5"><p className="text-[10px] font-medium text-[#7d899d]">Meta サーバー送信</p><p className="mt-2 text-lg font-semibold tabular-nums">{stats.purchaseTracking.metaServerConfigured?`${stats.purchaseTracking.serverMetaSent}件`:"未設定"}</p></div>
                      <div className="p-5"><p className="text-[10px] font-medium text-[#7d899d]">TikTok サーバー送信</p><p className="mt-2 text-lg font-semibold tabular-nums">{stats.purchaseTracking.tiktokServerConfigured?`${stats.purchaseTracking.serverTikTokSent}件`:"未設定"}</p></div>
                    </div>
                  </Panel>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <Panel className="overflow-hidden"><div className="border-b border-[#edf0f4] p-5"><h3 className="text-sm font-semibold">{isLegacyPaywall?"旧カードのコンバージョン":"商品別コンバージョン"}</h3><p className="mt-1 text-[10px] text-[#7d899d]">{isLegacyPaywall?"過去の単一・完全版カードのみ":"現行の完全版と学生向けを分けて集計"}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[11px]"><thead className="bg-[#fafbfc] text-[#7c879a]"><tr><th className="px-4 py-3 text-left font-medium">{isLegacyPaywall?"カード":"商品"}</th><th className="px-3 py-3 text-right font-medium">表示</th><th className="px-3 py-3 text-right font-medium">CTA</th><th className="px-3 py-3 text-right font-medium">購入者</th><th className="px-3 py-3 text-right font-medium">購入率</th><th className="px-4 py-3 text-right font-medium">売上</th></tr></thead><tbody>{displayedPaywallPlans.map((plan)=><tr key={plan.product} className="border-t border-[#edf0f4]"><td className="px-4 py-3.5 font-medium text-[#344158]">{isLegacyPaywall?(isKoreanProperty?"旧カード・完全版 ₩4,900":"旧カード・完全版 ¥499"):courseLabels[plan.product]}</td><td className="px-3 py-3.5 text-right tabular-nums">{plan.viewers}</td><td className="px-3 py-3.5 text-right tabular-nums">{plan.ctaClickers}</td><td className="px-3 py-3.5 text-right tabular-nums">{plan.purchasers}</td><td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#405fd4]">{pct(plan.purchaseRate)}</td><td className="px-4 py-3.5 text-right font-semibold tabular-nums">{formatMoney(plan.revenueMinor,plan.currency)}</td></tr>)}</tbody></table></div></Panel>
                    <Panel className="overflow-hidden"><div className="border-b border-[#edf0f4] p-5"><h3 className="text-sm font-semibold">日別売上</h3><p className="mt-1 text-[10px] text-[#7d899d]">新しい日付を上に表示</p></div><div className="max-h-[330px] overflow-auto"><table className="w-full min-w-[480px] text-[11px]"><thead className="sticky top-0 bg-[#fafbfc] text-[#7c879a]"><tr><th className="px-4 py-3 text-left font-medium">日付</th><th className="px-3 py-3 text-right font-medium">決済</th><th className="px-3 py-3 text-right font-medium">返金</th><th className="px-4 py-3 text-right font-medium">純売上</th></tr></thead><tbody>{stats.revenueDaily.length ? stats.revenueDaily.map((day)=><tr key={day.date} className="border-t border-[#edf0f4]"><td className="px-4 py-3 font-medium">{day.date}</td><td className="px-3 py-3 text-right tabular-nums">{day.purchases}</td><td className="px-3 py-3 text-right text-[#b04a42]">{day.currencies.some((item)=>item.refundedMinor>0)?day.currencies.filter((item)=>item.refundedMinor>0).map((item)=>`−${formatMoney(item.refundedMinor,item.currency)}`).join(" / "):"—"}</td><td className="px-4 py-3 text-right font-semibold">{formatRevenue(day.currencies)}</td></tr>):<tr><td colSpan={4} className="px-4 py-10 text-center text-[#8b95a7]">期間内の売上はありません</td></tr>}</tbody></table></div></Panel>
                  </div>
                </section>

                <section id="unmei" className="scroll-mt-24 pt-16">
                  <SectionHeader kicker="PRODUCT" title="運命の設計図" description="現行チャットとナビロックを分けて、出生情報入力・コース購入・鑑定表示まで追います。" side={<div className="rounded-xl border border-[#ded5f5] bg-[#f7f3ff] px-4 py-3"><p className="text-[9px] font-semibold text-[#765caa]">運命導線売上</p><p className="mt-1 text-lg font-semibold text-[#6849a4]">{formatRevenue(stats.unmei.revenue.currencies)}</p></div>} />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="LP表示" value={(stats.unmei.funnel[0]?.count??0).toLocaleString()} unit="人" badge="入口" hint="未購入LPの表示セッション" />
                    <MetricCard label="決済完了" value={stats.unmei.purchases.total.toLocaleString()} unit="件" badge="購入" tone="emerald" hint={`現行コース ${stats.unmei.purchases.current}（プレミアム ${stats.unmei.purchases.premium}）/ 旧商品 ${stats.unmei.purchases.legacy}`} />
                    <MetricCard label="出生情報保存" value={stats.unmei.birthForm.submitted.toLocaleString()} unit="人" badge="オンボーディング" tone="cyan" hint={`保存率 ${pct(stats.unmei.birthForm.submitRate)}・スキップ ${stats.unmei.birthForm.skipped}`} />
                    <MetricCard label="鑑定表示" value={(stats.unmei.funnel[6]?.count??0).toLocaleString()} unit="人" badge="体験完了" tone="amber" hint={`旧バッジ反応率 ${pct(stats.unmei.navBadge.clickRate)}`} />
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <Panel className="p-5 sm:p-6"><div className="mb-6"><h3 className="text-sm font-semibold">設計図チャット導線</h3><p className="mt-1 text-[10px] text-[#7d899d]">LPでチャットを起動し、出生情報を保存してから決済する現行フロー</p></div><Funnel steps={stats.unmei.chatFunnel} accent="violet"/></Panel>
                    <Panel className="p-5 sm:p-6"><div className="mb-6"><h3 className="text-sm font-semibold">ナビロック購入導線</h3><p className="mt-1 text-[10px] text-[#7d899d]">運命タブのロックからコース選択を開いたフロー</p></div><Funnel steps={stats.unmei.navigationFunnel} accent="violet"/></Panel>
                  </div>
                </section>

                <section id="alice" className="scroll-mt-24 pt-16">
                  <SectionHeader
                    kicker="AI CONCIERGE"
                    title="Alice"
                    description="ロックからのコース購入と、購入後の会話利用を別々に確認します。"
                    side={<div className="rounded-xl border border-[#ded5f5] bg-[#f7f3ff] px-4 py-3"><p className="text-[9px] font-semibold text-[#765caa]">Alice導線売上</p><p className="mt-1 text-lg font-semibold text-[#6849a4]">{formatRevenue(stats.alice.revenue.currencies)}</p></div>}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="ページ閲覧" value={stats.alice.pageViews.toLocaleString()} unit="セッション" badge="入口" hint={`未解放 ${stats.alice.lockedViewers.toLocaleString()} / 解放済み ${stats.alice.accessViewers.toLocaleString()}`} />
                    <MetricCard label="決済完了" value={stats.alice.purchases.toLocaleString()} unit="件" badge="購入" tone="emerald" hint={`${stats.alice.purchasers.toLocaleString()}人がAlice導線から購入`} />
                    <MetricCard label="利用ユーザー" value={stats.alice.activeUsers.toLocaleString()} unit="人" badge="実利用" tone="cyan" hint={`新規会話 ${stats.alice.conversationsStarted.toLocaleString()}件`} />
                    <MetricCard label="Aliceの応答" value={stats.alice.responsesCompleted.toLocaleString()} unit="回" badge="完了" tone="amber" hint={`成功率 ${pct(stats.alice.responseSuccessRate)}・失敗 ${stats.alice.responsesFailed.toLocaleString()}回`} />
                  </div>
                  <Panel className="mt-4 p-5 sm:p-6">
                    <div className="mb-6"><h3 className="text-sm font-semibold">Alice購入ファネル</h3><p className="mt-1 text-[10px] text-[#7d899d]">Aliceページの初回送信と、下部ナビのAliceロックから開いたコースカードを集計</p></div>
                    <Funnel steps={stats.alice.purchaseFunnel} accent="violet" />
                  </Panel>
                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
                    <Panel className="p-5 sm:p-6">
                      <div className="mb-6"><h3 className="text-sm font-semibold">Alice利用ファネル</h3><p className="mt-1 text-[10px] text-[#7d899d]">各段階はユニークセッションで集計</p></div>
                      <Funnel steps={stats.alice.funnel} accent="violet" />
                    </Panel>
                    <Panel className="overflow-hidden">
                      <div className="border-b border-[#edf0f4] p-5"><h3 className="text-sm font-semibold">利用回数と購入後残高</h3><p className="mt-1 text-[10px] text-[#7d899d]">会話本文は表示・集計しません</p></div>
                      <div className="space-y-4 p-5">
                        <div>
                          <div className="flex items-end justify-between gap-3"><p className="text-[11px] font-medium text-[#657188]">消費済み回数</p><p className="text-lg font-semibold tabular-nums">{stats.alice.credits.used.toLocaleString()}<span className="ml-1 text-[10px] font-medium text-[#8b95a6]">/ {stats.alice.credits.total.toLocaleString()}回</span></p></div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eceef4]"><span className="block h-full rounded-full bg-[#7b61d6]" style={{width:`${stats.alice.credits.total>0?Math.min(100,(stats.alice.credits.used/stats.alice.credits.total)*100):0}%`}} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-[#f7f8fb] p-3"><p className="text-[9px] font-medium text-[#7d899d]">残り回数</p><p className="mt-1 text-base font-semibold tabular-nums">{stats.alice.credits.remaining.toLocaleString()}<span className="ml-1 text-[9px] font-medium text-[#8b95a6]">回</span></p></div>
                          <div className="rounded-xl bg-[#f7f8fb] p-3"><p className="text-[9px] font-medium text-[#7d899d]">回数保有者</p><p className="mt-1 text-base font-semibold tabular-nums">{stats.alice.credits.holders.toLocaleString()}<span className="ml-1 text-[9px] font-medium text-[#8b95a6]">人</span></p></div>
                        </div>
                        <div className="divide-y divide-[#edf0f4] rounded-xl border border-[#e8ebf1]">
                          <div className="flex items-center justify-between gap-3 px-3.5 py-3 text-[11px]"><span className="text-[#657188]">購入カード表示</span><span className="font-semibold tabular-nums">{stats.alice.cardViewers.toLocaleString()}セッション</span></div>
                          <div className="flex items-center justify-between gap-3 px-3.5 py-3 text-[11px]"><span className="text-[#657188]">応答失敗を見た人</span><span className="font-semibold tabular-nums">{stats.alice.responseFailureViewers.toLocaleString()}人</span></div>
                        </div>
                      </div>
                    </Panel>
                  </div>
                  <p className="mt-3 text-[9px] leading-5 text-[#929caf]">Alice利用イベントの計測開始: {stats.alice.measurementStartedAt} / 決済はStripe確定イベント、応答数・残回数はサーバーの利用記録を正としています。
                  </p>
                </section>

                {/* LINE基盤 + Alice Plus (サブスク・2026-09-01)。
                    友だち/連携/加入者/MRRは現在値、イベント系は期間内件数 */}
                <section id="alice-plus" className="scroll-mt-24 pt-16">
                  <SectionHeader
                    kicker="LINE / SUBSCRIPTION"
                    title="Alice Plus (LINE)"
                    description="LINE友だち・診断連携と、月額・年額サブスクの加入状況を確認します。"
                    side={<div className="rounded-xl border border-[#cfe8d8] bg-[#f0f9f3] px-4 py-3"><p className="text-[9px] font-semibold text-[#4c8965]">MRR (有料中・月額換算)</p><p className="mt-1 text-lg font-semibold tabular-nums text-[#2f7950]">¥{(stats.linePlus?.mrrJpy ?? 0).toLocaleString()}</p></div>}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="LINE友だち" value={(stats.linePlus?.friends ?? 0).toLocaleString()} unit="人" badge="現在" hint={`診断連携済み ${(stats.linePlus?.linked ?? 0).toLocaleString()}人`} />
                    <MetricCard label="サブスク加入中" value={(stats.linePlus?.activeSubscribers ?? 0).toLocaleString()} unit="人" badge="現在" tone="emerald" hint={`月額 ${stats.linePlus?.monthlySubscribers ?? 0}・年額 ${stats.linePlus?.annualSubscribers ?? 0}・無料体験 ${stats.linePlus?.trialingSubscribers ?? 0}人`} />
                    <MetricCard label="新規加入" value={(stats.linePlus?.subscribed ?? 0).toLocaleString()} unit="件" badge="期間" tone="cyan" hint={`決済ページ到達 ${(stats.linePlus?.checkoutOpened ?? 0).toLocaleString()}件`} />
                    <MetricCard label="友だち追加 / 解約" value={`${(stats.linePlus?.follows ?? 0).toLocaleString()} / ${(stats.linePlus?.canceled ?? 0).toLocaleString()}`} badge="期間" tone="amber" hint={`診断連携の完了 ${(stats.linePlus?.linkCompleted ?? 0).toLocaleString()}件`} />
                    <MetricCard label="LINEカード表示" value={(stats.linePlus?.cardViewed ?? 0).toLocaleString()} unit="回" badge="期間" hint={`友だち追加CTA ${(stats.linePlus?.addFriendClicked ?? 0).toLocaleString()}回`} />
                    <MetricCard label="連携コード発行" value={(stats.linePlus?.linkCodeIssued ?? 0).toLocaleString()} unit="回" badge="期間" tone="cyan" hint={`開始 ${(stats.linePlus?.linkCodeRequested ?? 0).toLocaleString()}回・失敗 ${(stats.linePlus?.linkCodeFailed ?? 0).toLocaleString()}回`} />
                  </div>
                  <p className="mt-3 text-[9px] leading-5 text-[#929caf]">友だち数・加入者・MRRは現在のスナップショット (期間フィルタ非適用)。MRRは有料中の月額を480円、年額を400円/月で換算し、無料体験と期間パスの一時売上は含みません。カード表示・CTA・コード発行、新規加入・友だち追加・解約は選択期間内のイベント数です。</p>
                </section>

                <section id="friend-funnel" className="scroll-mt-24 pt-16">
                  <SectionHeader kicker="GROWTH LOOP" title="友達・拡散" description="診断者が友達を招待し、新しい診断が生まれるまでを追います。" side={<div className="rounded-xl border border-[#cfe8d8] bg-[#f0f9f3] px-4 py-3"><p className="text-[9px] font-semibold text-[#4c8965]">拡散係数</p><p className="mt-1 text-lg font-semibold tabular-nums text-[#2f7950]">{dataReady?stats.coreKpis.viralCoefficient.value.toFixed(3):"要DB更新"}</p></div>} />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="診断 → 友達回答" value={pct(headlines!.friendRate)} badge="本人起点" tone="cyan" hint={`${stats.coreKpis.diagnosisToFriend.numerator}人 / ${stats.coreKpis.diagnosisToFriend.denominator}人`} />
                    <MetricCard label="購入者 → 友達回答" value={dataReady?pct(stats.coreKpis.paidToFriend.rate):"要更新"} badge="購入者起点" tone="emerald" hint={`${stats.coreKpis.paidToFriend.numerator}人 / ${stats.coreKpis.paidToFriend.denominator}人`} />
                    <MetricCard label="招待経由の新規診断" value={stats.coreKpis.viralCoefficient.children.toLocaleString()} unit="人" badge="獲得" hint="source_user_id がある新規診断" />
                    <MetricCard label="共有者あたり到達" value={stats.viral.avgLandingPerSharer.toFixed(1)} unit="人" badge="リーチ" tone="amber" hint={`友達ページ到達 ${stats.viral.friendLandingViewed.toLocaleString()}セッション`} />
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <Panel className="p-5 sm:p-6"><h3 className="text-sm font-semibold">本人側の到達</h3><p className="mt-1 text-[10px] leading-5 text-[#7d899d]">自己診断完了者を起点に、友達回答が届くまで。</p><div className="mt-5"><ReachFunnel steps={stats.friendDiagnosisFunnel.ownerFunnel} rateKey="rateFromDiagnosis"/></div></Panel>
                    <Panel className="p-5 sm:p-6"><h3 className="text-sm font-semibold">友達側の拡散</h3><p className="mt-1 text-[10px] leading-5 text-[#7d899d]">招待ページ到達から、新しい自己診断完了まで。</p><div className="mt-5"><ReachFunnel steps={stats.friendDiagnosisFunnel.friendFunnel} rateKey="rateFromLanding"/></div></Panel>
                    <Panel className="p-5 sm:p-6"><h3 className="text-sm font-semibold">自己結果シェア</h3><p className="mt-1 text-[10px] leading-5 text-[#7d899d]">結果シェアの表示から、新しい自己診断完了まで。</p><div className="mt-5"><ReachFunnel steps={stats.selfResultShareFunnel.steps} rateKey="rateFromResult"/></div></Panel>
                  </div>
                  <p className="mt-3 text-[9px] leading-5 text-[#929caf]">計測開始: {stats.friendDiagnosisFunnel.measurementStartedAt} / {stats.friendDiagnosisFunnel.cohortDefinition}</p>
                  <p className="mt-1 text-[9px] leading-5 text-[#929caf]">自己結果シェア: {stats.selfResultShareFunnel.cohortDefinition}</p>
                </section>

                <section id="acquisition" className="scroll-mt-24 pb-16 pt-16">
                  <SectionHeader kicker="ACQUISITION" title="流入・集客" description="新規診断を連れてきた媒体とキャンペーンを比較します。" side={topSource?<div className="rounded-xl border border-[#d8def5] bg-[#f1f4ff] px-4 py-3"><p className="text-[9px] font-semibold text-[#6475b7]">最多の流入元</p><p className="mt-1 max-w-44 truncate text-sm font-semibold text-[#4056a9]">{topSource.source}</p><p className="mt-0.5 text-[10px] text-[#6e7a90]">{topSource.users.toLocaleString()}人・{pct(topSource.share)}</p></div>:undefined} />
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
                    <Panel className="overflow-hidden"><div className="border-b border-[#edf0f4] p-5"><h3 className="text-sm font-semibold">流入元別</h3><p className="mt-1 text-[10px] text-[#7d899d]">first-touch の新規診断完了者</p></div><div className="divide-y divide-[#edf0f4]">{stats.acquisitionStats.sources.length?stats.acquisitionStats.sources.map((source)=><div key={source.source} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-5 px-5 py-3.5"><div className="min-w-0"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-medium text-[#354258]">{source.source}</p><p className="text-[10px] font-semibold text-[#68758b]">{pct(source.share)}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ebedf3]"><span className="block h-full rounded-full bg-[#506ee8]" style={{width:`${Math.max(source.share>0?2:0,source.share*100)}%`}}/></div></div><p className="text-right text-sm font-semibold tabular-nums">{source.users.toLocaleString()}<span className="ml-1 text-[9px] font-medium text-[#8b95a6]">人</span></p></div>):<p className="p-10 text-center text-xs text-[#8b95a7]">期間内の新規ユーザーはいません</p>}</div></Panel>
                    <div className="space-y-4"><Panel className="p-5"><h3 className="text-sm font-semibold">キャンペーン内訳</h3><p className="mt-1 text-[10px] text-[#7d899d]">utm_campaign / camp</p><div className="mt-4 space-y-2.5">{stats.acquisitionStats.campaigns.length?stats.acquisitionStats.campaigns.map((campaign)=><div key={`${campaign.source}-${campaign.campaign}`} className="flex items-center gap-3 rounded-xl bg-[#f7f8fb] px-3.5 py-3"><span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-semibold text-[#405fd4]">{campaign.source}</span><p className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#657188]" title={campaign.campaign}>{campaign.campaign}</p><span className="text-xs font-semibold tabular-nums">{campaign.users}</span></div>):<p className="py-6 text-center text-xs text-[#8b95a7]">キャンペーン指定の流入はありません</p>}</div></Panel>{stats.campaignStats.length>0&&<Panel className="p-5"><h3 className="text-sm font-semibold">キャンペーン成果</h3><div className="mt-4 space-y-3">{stats.campaignStats.map((campaign)=><div key={campaign.campaign} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><p className="truncate font-mono text-[10px] text-[#657188]">{campaign.campaign}</p><p className="text-[10px] font-medium text-[#57647a]">診断 {campaign.completed} / 友達 {campaign.friendCompleted}</p></div>)}</div></Panel>}</div>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
