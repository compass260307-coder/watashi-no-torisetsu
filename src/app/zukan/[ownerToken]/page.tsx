"use client";

import { Suspense, use, useEffect, useState } from "react";
import Image from "next/image";
import type { ZukanData } from "@/lib/zukan-data";
import type { TorisetsuTypeId } from "@/lib/types";
import { TypeDetailModal } from "@/components/TypeDetailModal";

function getEvaluateInviteHref(): string {
  const liffShareId = process.env.NEXT_PUBLIC_LIFF_ID_SHARE;
  return liffShareId ? `https://liff.line.me/${liffShareId}` : "/";
}

export default function ZukanPage({
  params,
}: {
  params: Promise<{ ownerToken: string }>;
}) {
  const { ownerToken } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex flex-col flex-1 items-center justify-center">
          <p className="text-sm text-muted">読み込み中...</p>
        </div>
      }
    >
      <ZukanContent ownerToken={ownerToken} />
    </Suspense>
  );
}

function ZukanContent({ ownerToken }: { ownerToken: string }) {
  const [data, setData] = useState<ZukanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<TorisetsuTypeId | null>(
    null,
  );
  const inviteHref = getEvaluateInviteHref();

  useEffect(() => {
    fetch(`/api/zukan?token=${encodeURIComponent(ownerToken)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: ZukanData | null) => {
        if (d) setData(d);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [ownerToken]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <p className="text-sm text-muted">図鑑を読み込み中...</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
        <p className="text-muted text-sm">図鑑が見つかりません</p>
      </div>
    );
  }

  const selectedEntry = selectedTypeId
    ? (data.entries.find((e) => e.typeId === selectedTypeId) ?? null)
    : null;
  const progressPct = (data.unlockedCount / data.totalTypes) * 100;

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-6 max-w-lg mx-auto w-full">
        {/* Header */}
        <header className="text-center mb-6 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            ZUKAN
          </p>
          <h1 className="text-2xl font-extrabold mb-3">タイプ図鑑</h1>
          <p className="text-sm font-bold mb-2">
            <span className="text-pink-600 text-base">
              {data.unlockedCount}
            </span>
            <span className="text-muted">
              {" "}
              / {data.totalTypes} 出会った
            </span>
          </p>
          <div className="w-full bg-pink-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-pink-400 to-pink-600 h-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        {/* Grid 4×2 */}
        <section className="w-full mb-8 animate-fade-in-up stagger-2">
          <div className="grid grid-cols-4 gap-3">
            {data.entries.map((entry) => (
              <button
                key={entry.typeId}
                type="button"
                onClick={() => setSelectedTypeId(entry.typeId)}
                aria-label={
                  entry.unlocked ? entry.name : "未開放のタイプ、タップで詳細"
                }
                className={`relative aspect-square rounded-xl border p-1 overflow-hidden transition-transform duration-150 ${
                  entry.unlocked
                    ? "bg-card-bg border-card-border hover:scale-[1.05] active:scale-95 shadow-sm"
                    : "bg-gray-50 border-gray-200 active:scale-95"
                }`}
              >
                {entry.imageUrl && (
                  <div className="relative w-full h-full">
                    <Image
                      src={entry.imageUrl}
                      alt=""
                      width={120}
                      height={120}
                      className={`w-full h-full object-contain ${
                        entry.unlocked
                          ? ""
                          : "grayscale opacity-25 blur-[1.5px]"
                      }`}
                    />
                    {!entry.unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-400 font-bold">
                        ？
                      </div>
                    )}
                  </div>
                )}

                {/* バッジ */}
                {entry.isSelf && (
                  <span className="absolute top-1 right-1 inline-block rounded-full bg-pink-500 text-white text-[8px] font-bold px-1.5 py-0.5 shadow-sm leading-tight">
                    YOU
                  </span>
                )}
                {!entry.isSelf && entry.count > 0 && (
                  <span className="absolute top-1 right-1 inline-block rounded-full bg-white border border-pink-300 text-pink-700 text-[9px] font-bold px-1.5 py-0.5 shadow-sm leading-tight">
                    {entry.count}
                  </span>
                )}

                {/* タイプ名 (unlock 時のみ、画像下に小さく) */}
                {entry.unlocked && (
                  <span
                    className="absolute inset-x-0 bottom-0 px-0.5 py-0.5 text-[8px] font-bold text-center truncate bg-white/80 backdrop-blur-[1px]"
                    style={{ color: entry.color }}
                  >
                    {entry.name}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="w-full text-center mb-8 animate-fade-in-up stagger-3">
          <p className="text-xs text-muted leading-relaxed mb-3">
            あなたの招待で診断した友達が
            <br />
            タイプを増やしてくれます
          </p>
          <a
            href={inviteHref}
            className="inline-block rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-md"
          >
            他己評価を依頼する
          </a>
        </section>
      </main>

      <TypeDetailModal
        isOpen={selectedTypeId !== null}
        onClose={() => setSelectedTypeId(null)}
        typeId={selectedTypeId}
        unlocked={selectedEntry?.unlocked ?? false}
        inviteHref={inviteHref}
        isSelf={selectedEntry?.isSelf}
        count={selectedEntry?.count}
      />
    </div>
  );
}
