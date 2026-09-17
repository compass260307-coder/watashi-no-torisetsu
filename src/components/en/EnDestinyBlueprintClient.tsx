"use client";

import { useEffect, useState, type FormEvent } from "react";

export default function EnDestinyBlueprintClient({ initialState }: { initialState: "no_birth" | "pending" | "failed" }) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state !== "pending") return;
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await fetch("/api/unmei/status?locale=en", { cache: "no-store" });
        const data = await response.json() as { state?: string };
        if (stopped) return;
        if (data.state === "ready") { window.location.reload(); return; }
        if (data.state === "failed") { setState("failed"); return; }
      } catch { /* retry below */ }
      if (!stopped) timer = window.setTimeout(poll, 2500);
    };
    void fetch("/api/unmei/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: "en" }) }).finally(poll);
    return () => { stopped = true; if (timer) window.clearTimeout(timer); };
  }, [state]);

  async function saveBirth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null);
    const form = new FormData(event.currentTarget);
    const timeUnknown = form.get("time_unknown") === "on";
    const response = await fetch("/api/birth-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ birth_date: form.get("birth_date"), birth_time: timeUnknown ? null : form.get("birth_time"), time_unknown: timeUnknown, place_unknown: true, analytics_page: "unmei" }) });
    if (!response.ok) { setError("We couldn't save your birth details. Please try again."); setSaving(false); return; }
    setState("pending"); setSaving(false);
  }

  if (state === "no_birth") return <section className="mx-auto max-w-[680px] px-5 py-14 text-[#2E2E5C]"><p className="text-sm font-black uppercase tracking-[.14em] text-[#5B5BEF]">Complete Edition</p><h1 className="mt-2 text-[38px] font-black sm:text-[50px]">Create your Destiny Blueprint</h1><p className="mt-4 text-[17px] leading-relaxed text-[#67677C]">Combine your personality pattern with the sky at the moment you were born. Your reading focuses on work, relationships, and the next turning point.</p><form onSubmit={saveBirth} className="mt-9 space-y-5 rounded-[28px] bg-white p-7 shadow-[0_15px_45px_rgba(46,46,92,.08)]"><label className="block font-bold">Date of birth<input required name="birth_date" type="date" className="mt-2 w-full rounded-xl border border-[#DCDCEA] px-4 py-3" /></label><label className="block font-bold">Time of birth<input name="birth_time" type="time" className="mt-2 w-full rounded-xl border border-[#DCDCEA] px-4 py-3" /></label><label className="flex items-center gap-3 text-sm font-semibold"><input name="time_unknown" type="checkbox" /> I don’t know my birth time</label><p className="text-xs leading-relaxed text-[#77778D]">If your birthplace is unavailable, the chart uses a neutral reference location and avoids time-sensitive placements when the birth time is unknown.</p>{error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}<button disabled={saving} className="w-full rounded-full bg-[#5B5BEF] px-6 py-4 font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Create my blueprint"}</button></form></section>;
  if (state === "failed") return <section className="mx-auto max-w-[680px] px-5 py-20 text-center text-[#2E2E5C]"><h1 className="text-3xl font-black">Your reading needs another try</h1><p className="mt-3 text-[#67677C]">No credit is consumed. You can safely start the generation again.</p><button onClick={() => { void fetch("/api/unmei/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true, locale: "en" }) }); setState("pending"); }} className="mt-7 rounded-full bg-[#5B5BEF] px-8 py-4 font-black text-white">Try again</button></section>;
  return <section className="mx-auto flex min-h-[60dvh] max-w-[680px] flex-col items-center justify-center px-5 py-20 text-center text-[#2E2E5C]"><div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E1DFFE] border-t-[#5B5BEF]"/><h1 className="mt-7 text-3xl font-black">Alice is drawing your blueprint</h1><p className="mt-3 max-w-lg leading-relaxed text-[#67677C]">She’s combining your personality result with your birth chart. This page will refresh when the reading is ready.</p></section>;
}
