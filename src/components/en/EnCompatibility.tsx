"use client";

import { useMemo, useState } from "react";
import { EN_RESULT_TYPES } from "@/i18n/en/result";
import { compat } from "@/lib/aisho-compat";
import { allThirtyTwoTypeIds, type ThirtyTwoTypeId } from "@/lib/thirty-two-types";

const IDS = allThirtyTwoTypeIds();
export default function EnCompatibility() {
  const [a, setA] = useState<ThirtyTwoTypeId>(IDS[0]);
  const [b, setB] = useState<ThirtyTwoTypeId>(IDS[1]);
  const result = useMemo(() => compat(a, b, "en"), [a, b]);
  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-8">
      <p className="text-sm font-black uppercase tracking-[.14em] text-[#5B5BEF]">Complete Edition</p>
      <h1 className="mt-2 text-[38px] font-black sm:text-[52px]">Compatibility</h1>
      <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-[#67677C]">Choose two personality types to explore where the relationship flows naturally and where a little care helps.</p>
      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        {[{ value: a, set: setA, label: "First person" }, { value: b, set: setB, label: "Second person" }].map((item) => <label key={item.label} className="font-bold">{item.label}<select value={item.value} onChange={(event) => item.set(event.target.value as ThirtyTwoTypeId)} className="mt-2 w-full rounded-2xl border border-[#DCDCEA] bg-white px-4 py-4">{IDS.map((id) => <option key={id} value={id}>{EN_RESULT_TYPES[id].name}</option>)}</select></label>)}
      </div>
      <section className="mt-8 rounded-[30px] bg-white p-7 shadow-[0_15px_45px_rgba(46,46,92,.08)] sm:p-10">
        <p className="text-center text-sm font-black uppercase tracking-[.12em] text-[#77778D]">Compatibility score</p>
        <p className="mt-2 text-center text-[64px] font-black text-[#5B5BEF]">{result.percent}%</p>
        <p className="mt-1 text-center text-lg font-black">{result.summary}</p>
        <h2 className="mt-8 text-2xl font-black">What works well</h2>
        <ul className="mt-4 space-y-3 text-[16px] leading-relaxed text-[#51516E]">{result.goods.map((line) => <li key={line}>✓ {line}</li>)}</ul>
        <h2 className="mt-8 text-2xl font-black">Handle with care</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-[#51516E]">{result.caution}</p>
      </section>
    </div>
  );
}
