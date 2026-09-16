"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";

import {
  LINE_LOVE_FOOTPRINT_KINDS,
  LINE_LOVE_FOOTPRINT_MOODS,
  type LineLoveFootprint,
  type LineLoveFootprintKind,
  type LineLoveFootprintMood,
} from "@/lib/line-love-footprints";

type Auth = { u: string; e: string; s: string };

const KIND_MAP = Object.fromEntries(
  LINE_LOVE_FOOTPRINT_KINDS.map((item) => [item.value, item]),
) as Record<LineLoveFootprintKind, (typeof LINE_LOVE_FOOTPRINT_KINDS)[number]>;

const MOOD_MAP = Object.fromEntries(
  LINE_LOVE_FOOTPRINT_MOODS.map((item) => [item.value, item.label]),
) as Record<LineLoveFootprintMood, string>;

const KIND_TONE: Record<LineLoveFootprintKind, string> = {
  meeting: "bg-[#EEEAFB] text-[#6558D9]",
  happy: "bg-[#FCE8F0] text-[#AD5778]",
  worry: "bg-[#E9EEFA] text-[#6275A6]",
  turning_point: "bg-[#FFF2C9] text-[#8A6B16]",
  goodbye: "bg-[#EEEAF2] text-[#706979]",
  other: "bg-[#E8F3EF] text-[#527A69]",
};

function jstToday(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function monthLabel(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return `${year}年 ${month}月`;
}

function buildPreviewEntry(input: {
  happenedOn: string;
  partnerName: string;
  kind: LineLoveFootprintKind;
  mood: LineLoveFootprintMood;
  title: string;
  note: string;
}): LineLoveFootprint {
  return {
    id: `preview-${Date.now()}`,
    happenedOn: input.happenedOn,
    partnerName: input.partnerName.trim() || null,
    kind: input.kind,
    mood: input.mood,
    title: input.title.trim(),
    note: input.note.trim() || null,
    createdAt: new Date().toISOString(),
  };
}

function EntryCard({
  entry,
  deleting,
  onDelete,
}: {
  entry: LineLoveFootprint;
  deleting: boolean;
  onDelete: () => void;
}) {
  const kind = KIND_MAP[entry.kind];
  return (
    <article className="relative rounded-[24px] border border-[#E7E1F1] bg-white p-5 shadow-[0_12px_34px_rgba(38,24,78,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${KIND_TONE[entry.kind]}`}>
            {kind.icon} {kind.label}
          </span>
          <span className="rounded-full bg-[#F3F0FA] px-3 py-1 text-[11px] font-bold text-[#6F65A1]">
            {MOOD_MAP[entry.mood]}
          </span>
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="shrink-0 rounded-md px-1 py-1 text-[11px] font-bold text-[#9992A6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8D80E3] disabled:opacity-50"
        >
          {deleting ? "削除中" : "削除"}
        </button>
      </div>
      <p className="mt-4 text-[11px] font-bold tracking-wide text-[#8F86A1]">
        {formatDate(entry.happenedOn)}
        {entry.partnerName ? `　${entry.partnerName}` : ""}
      </p>
      <h3 className="mt-2 text-[17px] font-black leading-7 text-[#302847]">
        {entry.title}
      </h3>
      {entry.note ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#69627D]">
          {entry.note}
        </p>
      ) : null}
    </article>
  );
}

export default function LineLoveFootprintsClient({
  auth,
  initialEntries,
  preview = false,
}: {
  auth: Auth;
  initialEntries: LineLoveFootprint[];
  preview?: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [formOpen, setFormOpen] = useState(false);
  const [happenedOn, setHappenedOn] = useState(jstToday);
  const [partnerName, setPartnerName] = useState("");
  const [kind, setKind] = useState<LineLoveFootprintKind>("happy");
  const [mood, setMood] = useState<LineLoveFootprintMood>("flutter");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      b.happenedOn.localeCompare(a.happenedOn) ||
      b.createdAt.localeCompare(a.createdAt),
    );
    return sorted.reduce<Array<{ month: string; entries: LineLoveFootprint[] }>>(
      (result, entry) => {
        const month = monthLabel(entry.happenedOn);
        const current = result.at(-1);
        if (current?.month === month) current.entries.push(entry);
        else result.push({ month, entries: [entry] });
        return result;
      },
      [],
    );
  }, [entries]);

  function resetForm() {
    setHappenedOn(jstToday());
    setPartnerName("");
    setKind("happy");
    setMood("flutter");
    setTitle("");
    setNote("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    const payload = { happenedOn, partnerName, kind, mood, title, note };
    try {
      let entry: LineLoveFootprint;
      if (preview) {
        entry = buildPreviewEntry(payload);
      } else {
        const response = await fetch("/api/line/love-footprints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...auth, ...payload }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          entry?: LineLoveFootprint;
          error?: string;
          plusUrl?: string;
        };
        if (body.error === "plus_required" && body.plusUrl) {
          window.location.assign(body.plusUrl);
          return;
        }
        if (!response.ok || !body.entry) {
          throw new Error(body.error ?? "save_failed");
        }
        entry = body.entry;
      }
      setEntries((current) => [entry, ...current]);
      resetForm();
      setFormOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "save_failed";
      setError(
        code === "rate_limited"
          ? "少し続けて記録しすぎたみたい。時間をおいてもう一度試してね。"
          : "うまく残せませんでした。少し時間をおいて、もう一度試してみてね。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: LineLoveFootprint) {
    if (!window.confirm("この恋の足あとを削除しますか？")) return;
    setDeletingId(entry.id);
    setError("");
    try {
      if (!preview) {
        const response = await fetch("/api/line/love-footprints", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...auth, id: entry.id }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          plusUrl?: string;
        };
        if (body.error === "plus_required" && body.plusUrl) {
          window.location.assign(body.plusUrl);
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "delete_failed");
      }
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch {
      setError("削除できませんでした。少し時間をおいてもう一度試してみてね。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-dvh overflow-x-clip bg-[#F6F3FB] pb-8 text-[#302847]">
      <div className="mx-auto w-full max-w-[480px] bg-[#F6F3FB] sm:my-5 sm:overflow-hidden sm:rounded-[38px] sm:shadow-[0_28px_90px_rgba(37,24,78,0.18)]">
        <section className="relative isolate h-[390px] overflow-hidden bg-[#17102F] text-white">
          <Image
            src="/line/love-footprints-hero-v2.webp"
            alt="星明かりの部屋で恋の記録ノートを書くAlice"
            fill
            priority
            sizes="(max-width: 520px) 100vw, 480px"
            className="object-cover object-[center_32%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,8,40,0.08)_0%,rgba(23,16,47,0.3)_42%,#17102F_100%)]" />
          <div className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#100923]/65 px-3.5 py-2 text-[11px] font-bold tracking-[0.12em] text-white shadow-[0_8px_24px_rgba(5,2,18,0.2)] backdrop-blur-md">
            <span className="text-[#F4D36F]">✦</span>
            Alice Plus
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-7">
            <p className="text-[10px] font-bold tracking-[0.25em] text-[#F4D36F]">
              MY LOVE STORY
            </p>
            <h1 className="mt-1.5 text-[30px] font-black tracking-tight">恋の足あと</h1>
            <p className="mt-2 text-[13px] leading-6 text-white/72">
              うれしかった日も、迷った夜も。<br />あなたの恋は、ここに残っていく。
            </p>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#F0D77D]/20 bg-white/[0.09] px-4 py-3.5 backdrop-blur-md">
              <div>
                <p className="text-[10px] font-bold text-white/55">残してきた記憶</p>
                <p className="mt-0.5 text-lg font-black text-white">{entries.length}つの足あと</p>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-lg text-[#F4D36F]">♡</span>
            </div>
          </div>
        </section>

        <section className="px-5 pb-12 pt-5">
          <button
            type="button"
            onClick={() => {
              setFormOpen((open) => !open);
              setError("");
            }}
            className="w-full rounded-2xl bg-gradient-to-r from-[#5C4FC6] via-[#7160D6] to-[#8B70DA] px-6 py-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(80,63,170,0.26)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#BEB4F4]"
          >
            {formOpen ? "閉じる" : "＋ 今日の恋を残す"}
          </button>

          {formOpen ? (
            <form onSubmit={submit} className="mt-5 space-y-5 rounded-[28px] border border-[#DDD7EE] bg-white p-5 shadow-[0_18px_50px_rgba(38,24,78,0.1)]">
              <div className="border-b border-[#ECE7F4] pb-4">
                <p className="text-[10px] font-black tracking-[0.2em] text-[#7C70D9]">NEW MEMORY</p>
                <h2 className="mt-1.5 text-xl font-black text-[#302847]">今日は、どんな恋の日だった？</h2>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#514963]">日付</span>
                <input
                  type="date"
                  required
                  max={jstToday()}
                  value={happenedOn}
                  onChange={(event) => setHappenedOn(event.target.value)}
                  className="w-full rounded-2xl border border-[#DDD7EE] bg-[#F9F7FD] px-4 py-3 text-base outline-none focus:border-[#7C70D9] focus:ring-4 focus:ring-[#8D80E3]/15"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#514963]">相手の呼び名 <span className="font-medium text-[#9B94A8]">（任意）</span></span>
                <input
                  value={partnerName}
                  onChange={(event) => setPartnerName(event.target.value)}
                  maxLength={40}
                  placeholder="あの人、○○くん など"
                  className="w-full rounded-2xl border border-[#DDD7EE] bg-[#F9F7FD] px-4 py-3 text-base outline-none focus:border-[#7C70D9] focus:ring-4 focus:ring-[#8D80E3]/15"
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-xs font-black text-[#514963]">どんな出来事？</legend>
                <div className="grid grid-cols-3 gap-2">
                  {LINE_LOVE_FOOTPRINT_KINDS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setKind(item.value)}
                      className={`rounded-2xl border px-2 py-3 text-xs font-black transition ${kind === item.value ? "border-[#6558D9] bg-[#6558D9] text-white shadow-[0_6px_14px_rgba(101,88,217,0.2)]" : "border-[#E3DDF0] bg-[#FAF9FD] text-[#69627D]"}`}
                    >
                      <span className="mr-1">{item.icon}</span>{item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-black text-[#514963]">その日の気持ち</legend>
                <div className="flex flex-wrap gap-2">
                  {LINE_LOVE_FOOTPRINT_MOODS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setMood(item.value)}
                      className={`rounded-full border px-4 py-2 text-xs font-black transition ${mood === item.value ? "border-[#8D80E3] bg-[#EEEAFB] text-[#5C50C6]" : "border-[#E3DDF0] bg-white text-[#69627D]"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#514963]">今日のひとこと</span>
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  placeholder="例：帰り道に少しだけ話せた"
                  className="w-full rounded-2xl border border-[#DDD7EE] bg-[#F9F7FD] px-4 py-3 text-base outline-none focus:border-[#7C70D9] focus:ring-4 focus:ring-[#8D80E3]/15"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#514963]">もう少し残しておく <span className="font-medium text-[#9B94A8]">（任意）</span></span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1200}
                  rows={4}
                  placeholder="そのとき言えなかったことも、ここならそのままで大丈夫。"
                  className="w-full resize-none rounded-2xl border border-[#DDD7EE] bg-[#F9F7FD] px-4 py-3 text-base leading-7 outline-none focus:border-[#7C70D9] focus:ring-4 focus:ring-[#8D80E3]/15"
                />
                <span className="mt-1 block text-right text-[10px] text-[#9B94A8]">{note.length}/1200</span>
              </label>

              {error ? <p role="alert" className="rounded-2xl bg-[#FFF0F3] px-4 py-3 text-center text-sm font-bold text-[#A8546D]">{error}</p> : null}

              <button
                type="submit"
                disabled={saving || !title.trim() || !happenedOn}
                className="w-full rounded-2xl bg-gradient-to-r from-[#5C4FC6] to-[#8068D8] px-6 py-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(80,63,170,0.24)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#BEB4F4] disabled:cursor-wait disabled:opacity-55"
              >
                {saving ? "そっと残しています…" : "この日の恋を残す"}
              </button>
            </form>
          ) : null}

          {!formOpen && error ? <p role="alert" className="mt-5 rounded-2xl bg-[#FFF0F3] px-4 py-3 text-center text-sm font-bold text-[#A8546D]">{error}</p> : null}

          {groups.length === 0 ? (
            <section className="mt-8 rounded-[28px] border border-dashed border-[#D7D0E7] bg-white/70 px-7 py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#EEEAFB] text-xl text-[#6558D9]">♡</span>
              <h2 className="mt-4 text-lg font-black text-[#302847]">まだ、最初の1ページ</h2>
              <p className="mt-3 text-sm leading-7 text-[#69627D]">
                小さな出来事で大丈夫。<br />今日、心が少し動いた瞬間から残してみてね。
              </p>
            </section>
          ) : (
            <div className="mt-9 space-y-9">
              {groups.map((group) => (
                <section key={group.month}>
                  <h2 className="mb-4 flex items-center gap-3 text-sm font-black text-[#5C5470]">
                    <span className="h-px flex-1 bg-[#D9D3E7]" />
                    {group.month}
                    <span className="h-px flex-1 bg-[#D9D3E7]" />
                  </h2>
                  <div className="relative space-y-4 pl-5 before:absolute before:bottom-4 before:left-[5px] before:top-4 before:w-px before:bg-[#CEC6E1]">
                    {group.entries.map((entry) => (
                      <div key={entry.id} className="relative before:absolute before:-left-[19px] before:top-7 before:size-[9px] before:rounded-full before:border-2 before:border-[#F6F3FB] before:bg-[#6558D9]">
                        <EntryCard
                          entry={entry}
                          deleting={deletingId === entry.id}
                          onDelete={() => void remove(entry)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <footer className="bg-[#211844] px-6 py-7 text-center text-[11px] leading-5 text-white/55">
          恋の足あとは、あなたのアカウントだけに保存されます。<br />消した記録は元に戻せません。
        </footer>
      </div>
    </main>
  );
}
