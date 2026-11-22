"use client";

// 「広告費を入れる」の入力画面。1 枚で、今なにが入っているかと、入れる場所の両方が見える。
//   左: 実績 ... X のエクスポート (xlsx) を画面のどこかに置くと、その場で取り込む。
//        直近 7 日 × アカウントごとに、どの時間帯の実績が入っているかを帯で見せる。
//        エクスポートを置けない媒体は、日別の金額を入れる。
//   右: 配信計画 ... 時間帯ごとの予算。棒グラフで形を見ながら直す (棒をなぞる・数字を打つ・
//        表計算から 24 個まとめて貼る)。実績が入っていない時間帯を、この金額で補う。
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import {
  formatNumbersDay,
  shiftNumbersDay,
  todayInJst,
} from "@/lib/internal-numbers";
import {
  detectXAdsAccount,
  parseXAdsExport,
  toJstHourly,
  type XAdsExportRow,
  type XAdsHourlyRow,
} from "@/lib/x-ads-export";

import { Card, numberFormat, yen } from "./numbers-ui";

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
  /** mask は 0〜23 時台の 24 文字で、実績がある時間帯が "1"。 */
  coverage: {
    day: string;
    account: string;
    hours: number;
    spend: number;
    mask?: string;
  }[];
}

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
  "h-9 rounded-lg border border-[var(--nb-border-strong)] bg-transparent px-2.5 text-sm text-[var(--nb-text)] outline-none transition-colors focus:border-[var(--nb-accent)]";
const primaryButton =
  "h-9 rounded-lg bg-[var(--nb-text)] px-4 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-40";
const quietButton =
  "h-8 rounded-lg border border-[var(--nb-border-strong)] px-3 text-xs font-bold text-[var(--nb-text)] transition-colors hover:bg-[var(--nb-surface-2)] disabled:opacity-40";
const accentTint = (percent: number) =>
  `color-mix(in srgb, var(--nb-accent) ${percent}%, transparent)`;

const jstHourNow = () => new Date(Date.now() + 9 * 3600e3).getUTCHours();

async function post(body: Record<string, unknown>): Promise<void> {
  const response = await fetch("/api/internal/numbers/costs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`costs ${response.status}`);
}

/* ------------------------------------------------------------------ 小物 */

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--nb-border-strong)] border-t-[var(--nb-text)]"
    />
  );
}

function Mark({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold leading-none"
      style={{
        color: tone,
        background: `color-mix(in srgb, ${tone} 16%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- 取り込み */

interface ImportItem {
  id: string;
  fileName: string;
  status: "reading" | "needs_account" | "saving" | "saved" | "error";
  message?: string;
  rows: XAdsExportRow[];
  code: string | null;
  accountName?: string;
  unmatched: number;
  summary?: { range: string; hours: number; spend: number };
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

const hasFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer.types).includes("Files");

export function NumbersCostEntry({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** 保存できたとき。呼び出し側が数字を取り直す。 */
  onSaved: () => void;
}) {
  const [state, setState] = useState<CostsState | null>(null);
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

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

  const changed = useCallback(() => {
    onSaved();
    void reload();
  }, [onSaved, reload]);

  const patch = (id: string, change: Partial<ImportItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );

  /** 読み取った行を、そのアカウントの実績として保存する。 */
  const importRows = async (
    id: string,
    rows: XAdsExportRow[],
    account: Account,
  ): Promise<boolean> => {
    const hourly = toJstHourly(rows, account.timezone);
    patch(id, {
      status: "saving",
      code: account.code,
      accountName: account.name,
      summary: summarize(hourly),
      message: undefined,
    });
    try {
      await post({ action: "upload", account: account.code, rows: hourly });
      patch(id, { status: "saved" });
      return true;
    } catch {
      patch(id, { status: "error", message: "保存できませんでした" });
      return false;
    }
  };

  /** 置かれたファイルを読み、登録済みのアカウントのものは、その場で保存する。 */
  const addFiles = async (files: File[]) => {
    if (!state || files.length === 0) return;
    let saved = false;
    for (const file of files) {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const base = {
        id,
        fileName: file.name,
        rows: [],
        code: null,
        unmatched: 0,
      };
      setItems((current) => [{ ...base, status: "reading" }, ...current]);
      try {
        if (!/\.xlsx$/i.test(file.name)) {
          throw new Error("xlsx ファイルではありません");
        }
        const rows = await parseXAdsExport(await file.arrayBuffer());
        if (rows.length === 0) throw new Error("時間別の行がありません");
        const { code, unmatchedCampaigns } = detectXAdsAccount(rows);
        const account = state.accounts.find((entry) => entry.code === code);
        patch(id, { rows, code, unmatched: unmatchedCampaigns });
        if (!account) {
          patch(id, { status: "needs_account" });
          continue;
        }
        saved = (await importRows(id, rows, account)) || saved;
      } catch (error) {
        patch(id, {
          status: "error",
          message:
            error instanceof Error ? error.message : "読み取れませんでした",
        });
      }
    }
    if (saved) changed();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 sm:p-4 xl:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="広告費を入れる"
        className="relative mx-auto flex min-h-full w-full max-w-[1480px] flex-col bg-[var(--nb-bg)] text-[var(--nb-text)] shadow-[0_24px_80px_rgba(0,0,0,0.8)] sm:min-h-0 sm:rounded-2xl sm:border sm:border-[var(--nb-border-strong)]"
        onDragEnter={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (hasFiles(event)) event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!hasFiles(event)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          void addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3 sm:rounded-t-2xl sm:px-5">
          <div className="mr-auto min-w-0">
            <h2 className="text-base font-bold">広告費を入れる</h2>
            <p className="mt-0.5 text-xs text-[var(--nb-text-2)]">
              入れた内容はすぐに保存され、数値画面に反映されます。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 shrink-0 whitespace-nowrap rounded-lg border border-[var(--nb-border-strong)] px-3 text-xs font-bold text-[var(--nb-text)] transition-colors hover:bg-[var(--nb-surface-2)]"
          >
            閉じる
          </button>
        </header>

        {failed && (
          <p
            role="alert"
            className="mx-4 mt-4 rounded-lg border border-[var(--nb-down)] px-3 py-2 text-sm text-[var(--nb-down)] sm:mx-5"
          >
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
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-[var(--nb-text-2)]">
            <Spinner />
            読み込んでいます...
          </p>
        )}

        {state && (
          <div className="grid gap-3 p-3 sm:p-4 xl:grid-cols-12 xl:gap-4 xl:p-5">
            <div className="grid min-w-0 content-start gap-3 xl:col-span-7 xl:gap-4">
              <Card
                title="実績を入れる"
                hint="X広告マネージャーの時間別エクスポート（xlsx）"
              >
                <div className="grid gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
                  <DropZone dragging={dragging} onFiles={addFiles} />
                  <ImportList
                    items={items}
                    onRetry={(item) => {
                      const account = state.accounts.find(
                        (entry) => entry.code === item.code,
                      );
                      if (!account) return;
                      void importRows(item.id, item.rows, account).then(
                        (ok) => ok && changed(),
                      );
                    }}
                    onRegistered={(item, account) => {
                      void importRows(item.id, item.rows, account).then(() =>
                        changed(),
                      );
                    }}
                  />
                </div>
              </Card>
              <Card
                title="入っている実績"
                hint="直近7日。帯の1目盛りが1時間で、左が0時台、右が23時台です"
              >
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <Coverage state={state} />
                </div>
              </Card>
              <Card
                title="そのほかの媒体"
                hint="エクスポートを置けない媒体は、1日分の金額を入れます"
              >
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <OtherMedia state={state} onSaved={changed} />
                </div>
              </Card>
            </div>
            <div className="grid min-w-0 content-start gap-3 xl:col-span-5 xl:gap-4">
              <Card
                title="配信計画"
                hint="Xの時間帯ごとの予算（全アカウントの合計）。実績が入っていない時間帯の広告費を、この金額で補います"
              >
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <PlanEditor state={state} onSaved={changed} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {dragging && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center border-2 border-dashed border-[var(--nb-accent)] sm:rounded-2xl"
            style={{ background: "rgba(0, 0, 0, 0.72)" }}
          >
            <p className="text-lg font-bold">
              ここに置くと、そのまま取り込みます
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DropZone({
  dragging,
  onFiles,
}: {
  dragging: boolean;
  onFiles: (files: File[]) => Promise<void>;
}) {
  return (
    <label
      className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center transition-colors hover:bg-[var(--nb-surface-2)]"
      style={{
        borderColor: dragging ? "var(--nb-accent)" : "var(--nb-border-strong)",
        background: dragging ? accentTint(10) : undefined,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-7 w-7 text-[var(--nb-text-2)] transition-colors group-hover:text-[var(--nb-text)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 16V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </svg>
      <span className="text-sm font-bold">エクスポートをここに置く</span>
      <span className="text-xs leading-relaxed text-[var(--nb-text-2)]">
        クリックして選ぶこともできます。複数まとめて置けます。
        <br />
        アカウントは自動で判別し、日本時間に直して保存します。同じ期間を置き直すと上書きされます。
      </span>
      <input
        type="file"
        accept=".xlsx"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void onFiles(files);
        }}
      />
    </label>
  );
}

function ImportList({
  items,
  onRetry,
  onRegistered,
}: {
  items: ImportItem[];
  onRetry: (item: ImportItem) => void;
  onRegistered: (item: ImportItem, account: Account) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-surface-2)] px-3.5 py-3"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {item.status === "saved" ? (
              <Mark tone="var(--nb-up)">✓</Mark>
            ) : item.status === "error" ? (
              <Mark tone="var(--nb-down)">!</Mark>
            ) : item.status === "needs_account" ? (
              <Mark tone="var(--nb-text-2)">?</Mark>
            ) : (
              <Spinner />
            )}
            <p className="mr-auto min-w-0 text-sm tabular-nums">
              {item.summary ? (
                <>
                  <span className="font-bold">
                    {item.accountName ?? item.code}
                  </span>
                  <span className="ml-2 text-[var(--nb-text-2)]">
                    {item.summary.range}（
                    {numberFormat.format(item.summary.hours)}時間分）
                  </span>
                </>
              ) : (
                <span className="text-[var(--nb-text-2)]">
                  {item.status === "reading" ? "読み取っています..." : ""}
                  {item.status === "error" ? "取り込めませんでした" : ""}
                  {item.status === "needs_account"
                    ? "アカウントの登録が必要です"
                    : ""}
                </span>
              )}
            </p>
            {item.summary && (
              <span className="text-sm font-bold tabular-nums">
                {yen(item.summary.spend)}
              </span>
            )}
            <span
              className="text-xs font-bold"
              style={{
                color:
                  item.status === "saved"
                    ? "var(--nb-up)"
                    : item.status === "error"
                      ? "var(--nb-down)"
                      : "var(--nb-text-2)",
              }}
            >
              {item.status === "saved" && "取り込みました"}
              {item.status === "saving" && "保存中..."}
              {item.status === "error" && item.message}
            </span>
            {item.status === "error" && item.summary && (
              <button
                type="button"
                className={quietButton}
                onClick={() => onRetry(item)}
              >
                もう一度
              </button>
            )}
          </div>
          <p className="mt-1 truncate pl-8 text-[11px] text-[var(--nb-text-3)]">
            {item.fileName}
            {item.unmatched > 0 && item.status !== "needs_account"
              ? ` ・ 名前の形が違うキャンペーン ${item.unmatched} 件も、このアカウントとして含めています`
              : ""}
          </p>
          {item.status === "needs_account" && (
            <NewAccountForm
              code={item.code}
              onRegistered={(account) => onRegistered(item, account)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

/** はじめて見るアカウント記号のファイル。名前とタイムゾーンを登録すると、続けて取り込む。 */
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
    <div className="mt-2.5 grid gap-2 pl-8">
      <p className="text-sm leading-relaxed">
        {code
          ? `はじめて見るアカウント記号「${code}」です。`
          : "キャンペーン名からアカウントを判別できませんでした。"}
        名前とタイムゾーンを登録すると、続けて取り込みます（タイムゾーンは広告マネージャーのアカウント設定で確認できます）。
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
          className={primaryButton}
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
          {busy ? "登録中..." : "登録して取り込む"}
        </button>
      </div>
      {failed && (
        <p className="text-sm text-[var(--nb-down)]">登録できませんでした。</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------ 入っている実績の帯 */

/** 1 日 × 1 アカウントの 24 時間。実績がある時間帯を塗る。 */
function HourStrip({
  mask,
  futureFrom,
  label,
}: {
  mask: string | undefined;
  /** この時間帯から先は、まだ来ていない (今日だけ)。 */
  futureFrom: number;
  label: string;
}) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 24 6"
      preserveAspectRatio="none"
      className="h-3 w-full"
    >
      <title>{label}</title>
      {Array.from({ length: 24 }, (_, hour) => {
        const filled = mask?.[hour] === "1";
        return (
          <rect
            key={hour}
            x={hour + 0.1}
            y={0}
            width={0.8}
            height={6}
            fill={
              filled
                ? "var(--nb-accent)"
                : hour >= futureFrom
                  ? "var(--nb-border)"
                  : "var(--nb-border-strong)"
            }
            opacity={filled ? 1 : hour >= futureFrom ? 0.6 : 1}
          />
        );
      })}
    </svg>
  );
}

function Coverage({ state }: { state: CostsState }) {
  const [clock] = useState(() => ({ today: todayInJst(), hour: jstHourNow() }));
  const days = Array.from({ length: 7 }, (_, back) =>
    shiftNumbersDay(clock.today, -back),
  );
  const accounts = state.accounts.filter((account) => account.medium === "x");
  const cells = new Map(
    state.coverage.map((entry) => [`${entry.day} ${entry.account}`, entry]),
  );
  if (accounts.length === 0) {
    return (
      <p className="text-sm text-[var(--nb-text-2)]">
        アカウントがまだ登録されていません。エクスポートを置くと、登録の案内が出ます。
      </p>
    );
  }
  const columns = `5.5rem repeat(${accounts.length}, minmax(2.75rem, 1fr)) 5rem`;
  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="grid items-center gap-x-2 gap-y-2.5"
          style={{
            gridTemplateColumns: columns,
            minWidth: `${10.5 + accounts.length * 3.25}rem`,
          }}
        >
          <span />
          {accounts.map((account) => (
            <span
              key={account.code}
              title={`${account.name}（${account.code}）`}
              className="truncate text-[11px] font-bold text-[var(--nb-text-2)]"
            >
              {account.name}
            </span>
          ))}
          <span className="text-right text-[11px] font-bold text-[var(--nb-text-2)]">
            実績の合計
          </span>
          {days.map((day, back) => {
            const total = accounts.reduce(
              (sum, account) =>
                sum + (cells.get(`${day} ${account.code}`)?.spend ?? 0),
              0,
            );
            const entered = accounts.some((account) =>
              cells.has(`${day} ${account.code}`),
            );
            return (
              <div key={day} className="contents">
                <span className="text-xs tabular-nums text-[var(--nb-text)]">
                  {formatNumbersDay(day)}
                  {back === 0 && (
                    <span className="ml-1 text-[10px] text-[var(--nb-text-2)]">
                      今日
                    </span>
                  )}
                </span>
                {accounts.map((account) => {
                  const entry = cells.get(`${day} ${account.code}`);
                  return (
                    <HourStrip
                      key={account.code}
                      mask={entry?.mask}
                      futureFrom={back === 0 ? clock.hour + 1 : 24}
                      label={`${formatNumbersDay(day)} ${account.name}: ${
                        entry
                          ? `${entry.hours}時間分 ${yen(entry.spend)}`
                          : "未入力"
                      }`}
                    />
                  );
                })}
                <span
                  className="text-right text-xs font-bold tabular-nums"
                  style={{
                    color: entered ? "var(--nb-text)" : "var(--nb-text-3)",
                  }}
                >
                  {entered ? yen(total) : "未入力"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--nb-text-2)]">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ background: "var(--nb-accent)" }}
          />
          実績あり
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ background: "var(--nb-border-strong)" }}
          />
          未入力（配信計画の金額で補います）
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ background: "var(--nb-border)", opacity: 0.6 }}
          />
          これから
        </span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- そのほかの媒体 */

function OtherMedia({
  state,
  onSaved,
}: {
  state: CostsState;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    day: shiftNumbersDay(todayInJst(), -1),
    medium: "tiktok",
    spend: "",
  }));
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
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || busy) return;
          void send({
            day: form.day,
            medium: form.medium,
            spend: amount,
          }).then(
            (ok) => ok && setForm((current) => ({ ...current, spend: "" })),
          );
        }}
      >
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
        <label className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--nb-text-3)]">
            ¥
          </span>
          <input
            inputMode="decimal"
            aria-label="金額（円）"
            placeholder="0"
            value={form.spend}
            onChange={(event) =>
              setForm({ ...form, spend: event.target.value })
            }
            className={`${field} w-32 pl-6 text-right tabular-nums`}
          />
        </label>
        <button
          type="submit"
          disabled={!valid || busy}
          className={primaryButton}
        >
          {busy ? "保存中..." : "保存する"}
        </button>
      </form>
      <p className="text-xs leading-relaxed text-[var(--nb-text-2)]">
        配信していない日は 0 を入れると「実績
        0円」になります。Xは、エクスポートを置いた日はそちらが優先されます。
      </p>
      {failed && (
        <p className="text-sm text-[var(--nb-down)]">保存できませんでした。</p>
      )}
      {state.daily.length > 0 && (
        <ul className="grid gap-1 border-t border-[var(--nb-border)] pt-3 text-sm tabular-nums">
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
  );
}

/* -------------------------------------------------------------- 配信計画 */

const NO_PLAN: number[] = Array.from({ length: 24 }, () => 0);
/** 棒をなぞって変えるときの刻み (円)。細かい数字は入力欄で打つ。 */
const DRAW_STEP = 120;

function niceCeil(value: number): number {
  const unit = value <= 2000 ? 500 : value <= 10000 ? 1000 : 5000;
  return Math.max(unit, Math.ceil(value / unit) * unit);
}

/**
 * 貼り付けた文字から金額を取り出す。表計算からの貼り付け (タブ・改行区切り) では、
 * 桁区切りのカンマと ¥ を取る。タブも改行も無ければ、空白かカンマで区切る。
 */
function parsePastedAmounts(text: string): number[] {
  const cells = /[\t\n]/.test(text)
    ? text.split(/[\t\r\n]+/)
    : text.split(/[\s,、]+/);
  return cells
    .map((cell) => cell.replace(/[¥￥,円\s]/g, ""))
    .filter((cell) => cell !== "")
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function PlanEditor({
  state,
  onSaved,
}: {
  state: CostsState;
  onSaved: () => void;
}) {
  const [today] = useState(() => todayInJst());
  // 登録済みの X の計画を、開始日が新しい順に。
  const plans = useMemo(() => {
    const byStart = new Map<string, number[]>();
    for (const row of state.plan) {
      if (row.medium !== "x") continue;
      const hours = byStart.get(row.effective_from) ?? [...NO_PLAN];
      hours[row.hour] = Number(row.amount_jpy);
      byStart.set(row.effective_from, hours);
    }
    return [...byStart.entries()]
      .map(([from, hours]) => ({ from, hours }))
      .sort((a, b) => (a.from < b.from ? 1 : -1));
  }, [state.plan]);
  // いま使っている計画 (開始日が今日以前で、いちばん新しいもの)。
  const current = plans.find((plan) => plan.from <= today) ?? null;
  const saved = current?.hours ?? NO_PLAN;

  const [values, setValues] = useState<string[]>(() => saved.map(String));
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "ok" | "ng";
    text: string;
  } | null>(null);
  const drawing = useRef(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const amounts = values.map((value) =>
    value.trim() === "" ? Number.NaN : Number(value),
  );
  const valid =
    Boolean(effectiveFrom) &&
    amounts.every((value) => Number.isFinite(value) && value >= 0);
  const total = amounts.reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0,
  );
  const savedTotal = saved.reduce((sum, value) => sum + value, 0);
  const changedFromSaved = amounts.some((value, hour) => value !== saved[hour]);
  // 縦の目盛り。なぞっている間に動かないよう、登録済みの計画から決める
  // (それより大きい数字を打ったときだけ広げる)。
  const scale = Math.max(
    niceCeil(Math.max(...saved, 800) * 1.25),
    ...amounts.filter((value) => Number.isFinite(value)),
  );

  const setHour = (hour: number, value: string) =>
    setValues((list) =>
      list[hour] === value
        ? list
        : list.map((item, index) => (index === hour ? value : item)),
    );
  const hourAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(
      23,
      Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * 24)),
    );
  };
  const paint = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, 1 - (event.clientY - rect.top) / rect.height),
    );
    const hour = hourAt(event);
    setHour(hour, String(Math.round((ratio * scale) / DRAW_STEP) * DRAW_STEP));
    setHover(hour);
    setNotice(null);
  };

  const onPaste =
    (hour: number) => (event: ClipboardEvent<HTMLInputElement>) => {
      const numbers = parsePastedAmounts(event.clipboardData.getData("text"));
      // 1 個だけなら、ふつうの貼り付けに任せる。
      if (numbers.length < 2) return;
      event.preventDefault();
      // 24 個ちょうどなら 0 時台から。それ以外は、貼った欄から順に入れる。
      const start = numbers.length === 24 ? 0 : hour;
      const count = Math.min(numbers.length, 24 - start);
      setValues((list) =>
        list.map((item, index) =>
          index >= start && index < start + count
            ? String(numbers[index - start])
            : item,
        ),
      );
      setNotice({
        tone: "ok",
        text: `${count}個の金額を、${start}時台から貼り付けました`,
      });
    };

  const scaleAll = (factor: number) => {
    setValues((list) =>
      list.map((item) => {
        const value = Number(item);
        return item.trim() === "" || !Number.isFinite(value)
          ? item
          : String(Math.max(0, Math.round((value * factor) / 10) * 10));
      }),
    );
    setNotice(null);
  };

  const hoverAmount = hover === null ? null : amounts[hover];

  return (
    <div className="grid gap-3">
      <p className="flex min-h-5 flex-wrap items-baseline gap-x-3 text-xs tabular-nums text-[var(--nb-text-2)]">
        {hover !== null ? (
          <>
            <span className="text-sm font-bold text-[var(--nb-text)]">
              {hover}時台{" "}
              {Number.isFinite(hoverAmount) ? yen(hoverAmount as number) : "–"}
            </span>
            {current && hoverAmount !== saved[hover] && (
              <span>いまの計画は {yen(saved[hover])}</span>
            )}
          </>
        ) : (
          <span>
            棒をなぞると金額を変えられます。下の欄に数字を打つことも、表計算から24個まとめて貼ることもできます。
          </span>
        )}
      </p>

      {/* 棒グラフ。なぞった位置の高さを、その時間帯の金額にする。 */}
      <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 pb-2 pt-3">
        <div className="relative pr-11">
          <span className="pointer-events-none absolute -top-1.5 right-0 text-[10px] tabular-nums text-[var(--nb-text-3)]">
            {yen(scale)}
          </span>
          <span
            className="pointer-events-none absolute right-0 text-[10px] tabular-nums text-[var(--nb-text-3)]"
            style={{ top: "calc(50% - 0.45rem)" }}
          >
            {yen(scale / 2)}
          </span>
          <div className="pointer-events-none absolute left-0 right-11 top-0 border-t border-dashed border-[var(--nb-border)]" />
          <div className="pointer-events-none absolute left-0 right-11 top-1/2 border-t border-dashed border-[var(--nb-border)]" />
          <div
            role="img"
            aria-label={`配信計画の棒グラフ。1日の合計 ${yen(total)}`}
            data-plan-chart=""
            className="relative flex h-44 cursor-crosshair touch-pan-y select-none items-end gap-[3px] border-b border-[var(--nb-border-strong)]"
            onPointerDown={(event) => {
              // 指でのスクロールを邪魔しないよう、なぞって描くのはマウスとペンだけ。
              if (event.pointerType === "touch") {
                setHover(hourAt(event));
                return;
              }
              event.currentTarget.setPointerCapture(event.pointerId);
              drawing.current = true;
              paint(event);
            }}
            onPointerMove={(event) => {
              if (drawing.current) paint(event);
              else if (event.pointerType !== "touch") setHover(hourAt(event));
            }}
            onPointerUp={() => {
              drawing.current = false;
            }}
            onPointerCancel={() => {
              drawing.current = false;
            }}
            onPointerLeave={() => {
              if (!drawing.current) setHover(null);
            }}
          >
            {amounts.map((value, hour) => {
              const height = Number.isFinite(value)
                ? Math.min(100, (value / scale) * 100)
                : 0;
              const before = Math.min(100, (saved[hour] / scale) * 100);
              return (
                <div key={hour} className="relative h-full flex-1">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-[3px]"
                    style={{
                      height: `${height}%`,
                      background:
                        hover === hour ? "var(--nb-accent)" : accentTint(62),
                    }}
                  />
                  {/* 変える前 (いまの計画) の高さ。変えた時間帯だけ線で残す。 */}
                  {current && value !== saved[hour] && (
                    <div
                      className="absolute inset-x-0 border-t-2 border-[var(--nb-compare)]"
                      style={{ bottom: `${before}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-1 flex gap-[3px] pr-11 text-[10px] tabular-nums text-[var(--nb-text-3)]">
          {amounts.map((_, hour) => (
            <span key={hour} className="flex-1 text-center">
              {hour % 3 === 0 ? hour : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {values.map((value, hour) => (
          <label
            key={hour}
            className="relative block rounded-lg border transition-colors focus-within:border-[var(--nb-accent)]"
            style={{
              borderColor:
                hover === hour ? "var(--nb-accent)" : "var(--nb-border-strong)",
            }}
          >
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-[var(--nb-text-3)]">
              {hour}時
            </span>
            <input
              ref={(element) => {
                inputs.current[hour] = element;
              }}
              inputMode="numeric"
              aria-label={`${hour}時台の金額（円）`}
              value={value}
              onChange={(event) => {
                setHour(hour, event.target.value);
                setNotice(null);
              }}
              onFocus={(event) => {
                setHover(hour);
                event.target.select();
              }}
              onBlur={() => setHover(null)}
              onPaste={onPaste(hour)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                inputs.current[(hour + 1) % 24]?.focus();
              }}
              className="h-8 w-full bg-transparent pl-8 pr-2 text-right text-sm tabular-nums text-[var(--nb-text)] outline-none"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={quietButton}
          onClick={() => scaleAll(0.9)}
        >
          全体を −10%
        </button>
        <button
          type="button"
          className={quietButton}
          onClick={() => scaleAll(1.1)}
        >
          全体を +10%
        </button>
        <button
          type="button"
          className={quietButton}
          disabled={!changedFromSaved}
          onClick={() => {
            setValues(saved.map(String));
            setNotice(null);
          }}
        >
          いまの計画に戻す
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-[var(--nb-border)] pt-3">
        <div>
          <p className="text-[11px] font-bold text-[var(--nb-text-2)]">
            1日の合計
          </p>
          <p className="mt-0.5 text-xl font-bold leading-none tabular-nums">
            {yen(total)}
          </p>
          <p className="mt-1 min-h-4 text-[11px] tabular-nums text-[var(--nb-text-2)]">
            {current && total !== savedTotal
              ? `いまの計画より ${total > savedTotal ? "+" : "−"}${yen(Math.abs(total - savedTotal))}`
              : ""}
          </p>
        </div>
        <label className="grid gap-1 text-[11px] font-bold text-[var(--nb-text-2)]">
          いつから使うか
          <input
            type="date"
            aria-label="計画の開始日"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            className={`${field} font-normal`}
          />
        </label>
        <button
          type="button"
          disabled={!valid || busy}
          className={`${primaryButton} ml-auto`}
          onClick={async () => {
            setBusy(true);
            setNotice(null);
            try {
              await post({
                action: "plan",
                effective_from: effectiveFrom,
                medium: "x",
                hours: amounts,
              });
              setNotice({ tone: "ok", text: "保存しました" });
              onSaved();
            } catch {
              setNotice({ tone: "ng", text: "保存できませんでした" });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "保存中..." : "この計画を保存する"}
        </button>
      </div>
      <p
        role="status"
        className="min-h-4 text-xs font-bold"
        style={{
          color: notice?.tone === "ng" ? "var(--nb-down)" : "var(--nb-up)",
        }}
      >
        {notice?.text ?? (valid ? "" : "金額は 0 以上の数字で入れてください")}
      </p>

      <div className="border-t border-[var(--nb-border)] pt-3">
        <h3 className="text-[11px] font-bold text-[var(--nb-text-2)]">
          登録済みの計画
        </h3>
        {plans.length === 0 ? (
          <p className="mt-1.5 text-xs text-[var(--nb-text-2)]">
            まだありません。実績が入っていない時間帯の広告費は 0
            として扱われます。
          </p>
        ) : (
          <ul className="mt-1.5 grid gap-1 text-xs tabular-nums">
            {plans.slice(0, 5).map((plan) => (
              <li key={plan.from} className="flex items-center gap-3">
                <span className="w-28 text-[var(--nb-text-2)]">
                  {formatNumbersDay(plan.from)} から
                </span>
                <span className="font-bold">
                  {yen(plan.hours.reduce((sum, value) => sum + value, 0))}
                  <span className="font-normal text-[var(--nb-text-2)]">
                    {" "}
                    / 日
                  </span>
                </span>
                {plan.from === current?.from && (
                  <span className="rounded-full border border-[var(--nb-border-strong)] px-2 py-0.5 text-[10px] font-bold text-[var(--nb-text)]">
                    いま使っている計画
                  </span>
                )}
                {plan.from > today && (
                  <span className="text-[10px] text-[var(--nb-text-2)]">
                    これから
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
