"use client";

// 「広告費を入れる」の入力画面。
//   * X のエクスポート (xlsx) を置く → 日本時間の時間別の実績として保存
//   * 日別の金額を手で入れる (TikTok など)
//   * 配信計画 (時間別の予算) を手で入れる → 実績が入っていない時間帯を、この金額で補う
import { useCallback, useEffect, useState } from "react";

import {
  shiftNumbersDay,
  todayInJst,
  formatNumbersDay,
} from "@/lib/internal-numbers";
import {
  detectXAdsAccount,
  parseXAdsExport,
  toJstHourly,
  type XAdsExportRow,
  type XAdsHourlyRow,
} from "@/lib/x-ads-export";

import { Segmented, numberFormat, yen } from "./numbers-ui";

interface Account {
  code: string;
  name: string;
  medium: string;
  timezone: string;
  locale: string;
}
interface CostsState {
  accounts: Account[];
  plan: {
    effective_from: string;
    medium: string;
    hour: number;
    amount_jpy: number;
  }[];
  daily: { day: string; medium: string; spend_jpy: number }[];
  coverage: { day: string; account: string; hours: number; spend: number }[];
}

type Tab = "export" | "daily" | "plan";
const TABS: { value: Tab; label: string }[] = [
  { value: "export", label: "Xのエクスポート" },
  { value: "daily", label: "日別の金額" },
  { value: "plan", label: "配信計画" },
];
const MEDIUM_LABELS: Record<string, string> = {
  x: "X",
  tiktok: "TikTok",
  meta: "Meta",
  other: "その他",
};
const TIME_ZONES = [
  { value: "America/Los_Angeles", label: "ロサンゼルス" },
  { value: "Asia/Tokyo", label: "東京" },
  { value: "Asia/Seoul", label: "ソウル" },
  { value: "UTC", label: "UTC" },
];
const LOCALE_LABELS: Record<string, string> = {
  ja: "日本語版",
  ko: "韓国語版",
  en: "英語版",
  id: "インドネシア語版",
};

const field =
  "h-9 rounded-lg border border-[var(--nb-border-strong)] bg-transparent px-2.5 text-sm text-[var(--nb-text)]";
const primaryButton =
  "h-9 rounded-lg bg-[var(--nb-text)] px-4 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50";
const quietButton =
  "h-8 rounded-lg border border-[var(--nb-border-strong)] px-3 text-xs font-bold text-[var(--nb-text)] transition-colors hover:bg-[var(--nb-surface-2)] disabled:opacity-50";

async function post(body: Record<string, unknown>): Promise<void> {
  const response = await fetch("/api/internal/numbers/costs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`costs ${response.status}`);
}

export function NumbersCostEntry({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** 保存できたとき。呼び出し側が数字を取り直す。 */
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<Tab>("export");
  const [state, setState] = useState<CostsState | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/internal/numbers/costs", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`costs ${response.status}`);
      setState((await response.json()) as CostsState);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await reload();
    })();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, reload]);

  const saved = () => {
    onSaved();
    void reload();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="広告費を入れる"
        className="w-full max-w-3xl rounded-2xl border border-[var(--nb-border-strong)] bg-[var(--nb-surface)] text-[var(--nb-text)] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-[var(--nb-border)] px-4 py-3 sm:px-5">
          <h2 className="mr-auto text-base font-bold">広告費を入れる</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="h-8 w-8 rounded-lg border border-[var(--nb-border)] text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
          >
            ×
          </button>
        </header>
        <div className="overflow-x-auto px-4 pt-3 sm:px-5">
          <Segmented
            label="入れ方"
            value={tab}
            onChange={setTab}
            options={TABS}
          />
        </div>
        <div className="px-4 pb-5 pt-4 sm:px-5">
          {failed && (
            <p role="alert" className="mb-3 text-sm text-[var(--nb-down)]">
              登録内容を取得できませんでした。
              <button
                type="button"
                onClick={() => void reload()}
                className="ml-2 underline"
              >
                もう一度試す
              </button>
            </p>
          )}
          {!state && !failed && (
            <p className="text-sm text-[var(--nb-text-2)]">
              読み込んでいます...
            </p>
          )}
          {state && tab === "export" && (
            <ExportTab state={state} onSaved={saved} />
          )}
          {state && tab === "daily" && (
            <DailyTab state={state} onSaved={saved} />
          )}
          {state && tab === "plan" && <PlanTab state={state} onSaved={saved} />}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- X のエクスポート */

interface ExportItem {
  id: string;
  fileName: string;
  status: "needs_account" | "ready" | "saving" | "saved" | "error";
  message?: string;
  rows: XAdsExportRow[];
  code: string | null;
  unmatched: number;
  hourly?: XAdsHourlyRow[];
}

function summarize(hourly: XAdsHourlyRow[]) {
  const first = hourly[0];
  const last = hourly[hourly.length - 1];
  return {
    range: `${formatNumbersDay(first.day)} ${first.hour}時 〜 ${formatNumbersDay(last.day)} ${last.hour}時`,
    hours: hourly.length,
    spend: hourly.reduce((total, row) => total + row.spend, 0),
  };
}

function ExportTab({
  state,
  onSaved,
}: {
  state: CostsState;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<ExportItem[]>([]);
  const patch = (id: string, change: Partial<ExportItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );

  const addFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const id = `${file.name}-${file.size}-${Date.now()}`;
      try {
        const rows = await parseXAdsExport(await file.arrayBuffer());
        if (rows.length === 0) throw new Error("時間別の行がありません");
        const { code, unmatchedCampaigns } = detectXAdsAccount(rows);
        const account = state.accounts.find((item) => item.code === code);
        setItems((current) => [
          ...current,
          {
            id,
            fileName: file.name,
            rows,
            code,
            unmatched: unmatchedCampaigns,
            status: account ? "ready" : "needs_account",
            hourly: account ? toJstHourly(rows, account.timezone) : undefined,
          },
        ]);
      } catch (error) {
        setItems((current) => [
          ...current,
          {
            id,
            fileName: file.name,
            rows: [],
            code: null,
            unmatched: 0,
            status: "error",
            message:
              error instanceof Error ? error.message : "読み取れませんでした",
          },
        ]);
      }
    }
  };

  const save = async (item: ExportItem) => {
    if (!item.code || !item.hourly) return;
    patch(item.id, { status: "saving" });
    try {
      await post({ action: "upload", account: item.code, rows: item.hourly });
      patch(item.id, { status: "saved" });
      onSaved();
    } catch {
      patch(item.id, { status: "error", message: "保存できませんでした" });
    }
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-[var(--nb-text-2)]">
        X広告マネージャーの時間別エクスポート（xlsx）を選んでください。1アカウント1ファイルで、複数まとめて選べます。キャンペーン名からアカウントを判別し、日本時間に直して保存します。同じ期間を置き直すと上書きされます。
      </p>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-[var(--nb-border-strong)] px-4 py-6 text-center text-sm hover:bg-[var(--nb-surface-2)]">
        <span className="font-bold">ファイルを選ぶ</span>
        <span className="text-xs text-[var(--nb-text-2)]">export-….xlsx</span>
        <input
          type="file"
          accept=".xlsx"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      {items.map((item) => {
        const summary = item.hourly?.length ? summarize(item.hourly) : null;
        const account = state.accounts.find(
          (entry) => entry.code === item.code,
        );
        return (
          <div
            key={item.id}
            className="rounded-xl border border-[var(--nb-border)] px-4 py-3"
          >
            <p className="truncate text-xs text-[var(--nb-text-2)]">
              {item.fileName}
            </p>
            {item.status === "error" && (
              <p className="mt-1 text-sm text-[var(--nb-down)]">
                {item.message}
              </p>
            )}
            {item.status === "needs_account" && (
              <NewAccountForm
                code={item.code}
                onRegistered={(registered) => {
                  patch(item.id, {
                    code: registered.code,
                    status: "ready",
                    hourly: toJstHourly(item.rows, registered.timezone),
                  });
                  onSaved();
                }}
              />
            )}
            {summary && item.status !== "error" && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="mr-auto text-sm tabular-nums">
                  <span className="font-bold">
                    {account?.name ?? item.code}
                  </span>
                  <span className="ml-2 text-[var(--nb-text-2)]">
                    {summary.range}（{numberFormat.format(summary.hours)}
                    時間分）
                  </span>
                  <span className="ml-2 font-bold">{yen(summary.spend)}</span>
                  {item.unmatched > 0 && (
                    <span className="ml-2 text-xs text-[var(--nb-text-2)]">
                      名前の形が違うキャンペーン {item.unmatched}{" "}
                      件も、このアカウントとして含めています
                    </span>
                  )}
                </p>
                {item.status === "saved" ? (
                  <span className="text-sm font-bold text-[var(--nb-up)]">
                    保存しました
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={item.status === "saving"}
                    onClick={() => void save(item)}
                    className={primaryButton}
                  >
                    {item.status === "saving" ? "保存中..." : "取り込む"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Coverage state={state} />
    </div>
  );
}

/** はじめて見るアカウント記号のファイル。名前とタイムゾーンを登録してから取り込む。 */
function NewAccountForm({
  code,
  onRegistered,
}: {
  code: string | null;
  onRegistered: (account: Account) => void;
}) {
  const [form, setForm] = useState({
    code: code ?? "",
    name: "",
    timezone: "America/Los_Angeles",
    locale: "ja",
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const valid = /^[A-Z]{1,6}$/.test(form.code) && form.name.trim().length > 0;
  return (
    <div className="mt-2 grid gap-2">
      <p className="text-sm">
        {code
          ? `はじめて見るアカウント記号「${code}」です。`
          : "キャンペーン名からアカウントを判別できませんでした。"}
        名前とタイムゾーンを登録してください（タイムゾーンは広告マネージャーのアカウント設定で確認できます）。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!code && (
          <input
            aria-label="アカウント記号（英大文字）"
            placeholder="記号（例: M）"
            value={form.code}
            onChange={(event) =>
              setForm({ ...form, code: event.target.value.toUpperCase() })
            }
            className={`${field} w-28`}
          />
        )}
        <input
          aria-label="アカウントの名前"
          placeholder="アカウントの名前"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          className={`${field} w-44`}
        />
        <select
          aria-label="タイムゾーン"
          value={form.timezone}
          onChange={(event) =>
            setForm({ ...form, timezone: event.target.value })
          }
          className={field}
        >
          {TIME_ZONES.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </select>
        <select
          aria-label="どの言語版の広告か"
          value={form.locale}
          onChange={(event) => setForm({ ...form, locale: event.target.value })}
          className={field}
        >
          {Object.entries(LOCALE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!valid || busy}
          className={quietButton}
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            const account = { ...form, name: form.name.trim(), medium: "x" };
            try {
              await post({ action: "account", ...account });
              onRegistered(account);
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "登録中..." : "登録する"}
        </button>
      </div>
      {failed && (
        <p className="text-sm text-[var(--nb-down)]">登録できませんでした。</p>
      )}
    </div>
  );
}

/** 直近の日に、どのアカウントの実績が何時間分入っているか。 */
function Coverage({ state }: { state: CostsState }) {
  const days = [...new Set(state.coverage.map((entry) => entry.day))]
    .sort()
    .reverse()
    .slice(0, 7);
  if (days.length === 0) {
    return (
      <p className="text-xs text-[var(--nb-text-2)]">
        時間別の実績は、まだ入っていません。
      </p>
    );
  }
  return (
    <div>
      <h3 className="text-xs font-bold text-[var(--nb-text-2)]">
        入っている実績（直近）
      </h3>
      <ul className="mt-1.5 grid gap-1 text-xs tabular-nums text-[var(--nb-text-2)]">
        {days.map((target) => (
          <li key={target}>
            <span className="mr-2 font-bold text-[var(--nb-text)]">
              {formatNumbersDay(target)}
            </span>
            {state.coverage
              .filter((entry) => entry.day === target)
              .map(
                (entry) =>
                  `${state.accounts.find((account) => account.code === entry.account)?.name ?? entry.account} ${entry.hours}時間 ${yen(entry.spend)}`,
              )
              .join(" ・ ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ 日別の金額 */

function DailyTab({
  state,
  onSaved,
}: {
  state: CostsState;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    day: shiftNumbersDay(todayInJst(), -1),
    medium: "tiktok",
    spend: "",
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const amount = Number(form.spend);
  const valid =
    form.day &&
    form.spend.trim() !== "" &&
    Number.isFinite(amount) &&
    amount >= 0;
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await post({ action: "daily", ...body });
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-[var(--nb-text-2)]">
        エクスポートを置けない媒体は、1日分の金額を入れてください。配信していない日は
        0 を入れると「実績
        0円」になります。Xは、エクスポートを置いた日はそちらが優先されます。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          aria-label="日付"
          value={form.day}
          max={todayInJst()}
          onChange={(event) => setForm({ ...form, day: event.target.value })}
          className={field}
        />
        <select
          aria-label="媒体"
          value={form.medium}
          onChange={(event) => setForm({ ...form, medium: event.target.value })}
          className={field}
        >
          {Object.entries(MEDIUM_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          inputMode="decimal"
          aria-label="金額（円）"
          placeholder="金額（円）"
          value={form.spend}
          onChange={(event) => setForm({ ...form, spend: event.target.value })}
          className={`${field} w-32 text-right tabular-nums`}
        />
        <button
          type="button"
          disabled={!valid || busy}
          className={primaryButton}
          onClick={() =>
            void send({ day: form.day, medium: form.medium, spend: amount })
          }
        >
          {busy ? "保存中..." : "保存する"}
        </button>
      </div>
      {failed && (
        <p className="text-sm text-[var(--nb-down)]">保存できませんでした。</p>
      )}
      <div>
        <h3 className="text-xs font-bold text-[var(--nb-text-2)]">
          入っている金額（直近3週間）
        </h3>
        {state.daily.length === 0 ? (
          <p className="mt-1.5 text-xs text-[var(--nb-text-2)]">
            まだ入っていません。
          </p>
        ) : (
          <ul className="mt-1.5 grid gap-1 text-sm tabular-nums">
            {state.daily.map((entry) => (
              <li
                key={`${entry.day}-${entry.medium}`}
                className="flex items-center gap-3"
              >
                <span className="w-24 text-[var(--nb-text-2)]">
                  {formatNumbersDay(entry.day)}
                </span>
                <span className="w-16">
                  {MEDIUM_LABELS[entry.medium] ?? entry.medium}
                </span>
                <span className="mr-auto font-bold">
                  {yen(Number(entry.spend_jpy))}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className={quietButton}
                  onClick={() =>
                    void send({
                      day: entry.day,
                      medium: entry.medium,
                      spend: null,
                    })
                  }
                >
                  取り消す
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 配信計画 */

function PlanTab({
  state,
  onSaved,
}: {
  state: CostsState;
  onSaved: () => void;
}) {
  // いま有効な X の計画 (開始日がいちばん新しく、今日以前のもの) を初期値にする。
  const today = todayInJst();
  const current = state.plan.filter(
    (row) => row.medium === "x" && row.effective_from <= today,
  );
  const latest = current[0]?.effective_from;
  const initial = Array.from({ length: 24 }, (_, hour) =>
    String(
      Number(
        current.find(
          (row) => row.effective_from === latest && row.hour === hour,
        )?.amount_jpy ?? 0,
      ),
    ),
  );
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [hours, setHours] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"saved" | "failed" | null>(null);
  const amounts = hours.map((value) => Number(value));
  const valid =
    Boolean(effectiveFrom) &&
    amounts.every(
      (value, index) =>
        hours[index].trim() !== "" && Number.isFinite(value) && value >= 0,
    );
  const total = amounts.reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0,
  );
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-[var(--nb-text-2)]">
        Xの1日の配信計画を、時間帯ごとの金額（全アカウントの合計・円）で入れてください。実績がまだ入っていない時間帯の広告費を、この金額で補います（画面には「推定」と出ます）。開始日以降、次の計画を登録するまで毎日使われます。
        {latest
          ? `いまの計画は ${formatNumbersDay(latest)} からのものです。`
          : "まだ計画がありません。"}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--nb-text-2)]">開始日</span>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            className={field}
          />
        </label>
        <p className="text-sm tabular-nums">
          <span className="text-[var(--nb-text-2)]">1日の合計</span>{" "}
          <span className="font-bold">{yen(total)}</span>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {hours.map((value, hour) => (
          <label
            key={hour}
            className="grid gap-1 text-xs text-[var(--nb-text-2)]"
          >
            {hour}時台
            <input
              inputMode="decimal"
              value={value}
              onChange={(event) =>
                setHours((list) =>
                  list.map((item, index) =>
                    index === hour ? event.target.value : item,
                  ),
                )
              }
              className={`${field} w-full text-right tabular-nums`}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!valid || busy}
          className={primaryButton}
          onClick={async () => {
            setBusy(true);
            setResult(null);
            try {
              await post({
                action: "plan",
                effective_from: effectiveFrom,
                medium: "x",
                hours: amounts,
              });
              setResult("saved");
              onSaved();
            } catch {
              setResult("failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "保存中..." : "この計画を保存する"}
        </button>
        {result === "saved" && (
          <span className="text-sm font-bold text-[var(--nb-up)]">
            保存しました
          </span>
        )}
        {result === "failed" && (
          <span className="text-sm text-[var(--nb-down)]">
            保存できませんでした。
          </span>
        )}
      </div>
    </div>
  );
}
