"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TorisetsuCard } from "@/components/torisetsu/TorisetsuCard";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import {
  generateAllZukanEntries,
  type ZukanEntry,
} from "@/lib/zukan-helpers";
import { getModifierLabel } from "@/lib/modifier-data";
import type { TorisetsuTypeId } from "@/lib/types";

type Filter = TorisetsuTypeId | "all";

export default function ZukanAllPage() {
  const allEntries = useMemo(() => generateAllZukanEntries(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [myFullCode, setMyFullCode] = useState<string | null>(null);

  // localStorage の自己診断結果から fullCode を読んで「YOU」バッジを点ける
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("torisetsu_result");
      if (!stored) return;
      const parsed = JSON.parse(stored) as { fullCode?: string };
      if (parsed?.fullCode) setMyFullCode(parsed.fullCode);
    } catch {
      // 破損データ無視
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo<ZukanEntry[]>(() => {
    if (filter === "all") return allEntries;
    return allEntries.filter((e) => e.typeId === filter);
  }, [allEntries, filter]);

  const typeList = Object.values(torisetsuTypes);

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-4 py-6 max-w-5xl mx-auto w-full">
        <header className="text-center mb-6">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            ZUKAN — ALL 32
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
            全 32 サブパターン
          </h1>
          <p className="text-sm text-muted">
            8 タイプ × 4 モディファイア = 32 通りの「ワタシ」
          </p>
        </header>

        {/* フィルター */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
              filter === "all"
                ? "bg-primary-gradient text-white"
                : "bg-card-bg border border-card-border text-muted hover:text-foreground"
            }`}
          >
            全て (32)
          </button>
          {typeList.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
                filter === t.id
                  ? "text-white"
                  : "bg-card-bg border border-card-border text-muted hover:text-foreground"
              }`}
              style={
                filter === t.id ? { backgroundColor: t.color } : undefined
              }
            >
              {t.shortName} (4)
            </button>
          ))}
        </div>

        {/* グリッド: モバイル 2 / sm 3 / md 4 列 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((entry) => {
            const isMe = myFullCode === entry.fullCode;
            const modifierLabel = getModifierLabel(
              entry.cModifier,
              entry.nModifier,
            );
            return (
              <div
                key={entry.fullCode}
                className="flex flex-col items-center"
              >
                <div className="relative">
                  <TorisetsuCard fullCode={entry.fullCode} size="sm" />
                  {isMe && (
                    <div
                      className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-md"
                      style={{ backgroundColor: entry.color }}
                    >
                      YOU
                    </div>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className="text-[10px] tracking-wider font-bold"
                    style={{ color: entry.color }}
                  >
                    {entry.fullCode}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                    {modifierLabel}
                  </div>
                  <div className="text-[10px] text-muted">
                    {entry.shortName}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/diagnosis"
            className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md"
          >
            自分の 5 文字を診断する
          </Link>
        </div>
      </main>
    </div>
  );
}
