"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DiagnosisResult } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";

export default function ResultFallbackPage() {
  const router = useRouter();
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const ownerToken = localStorage.getItem("torisetsu_owner_token");
    if (ownerToken) {
      router.replace(`/result/${ownerToken}`);
      return;
    }

    const stored = localStorage.getItem("torisetsu_result");
    if (stored) {
      setResult(JSON.parse(stored));
    }
    setChecking(false);
  }, [router]);

  if (checking) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-muted text-sm animate-fade-in">
          トリセツを読み込み中...
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5">
        <p className="text-muted text-sm mb-6">診断結果が見つかりません</p>
        <Link
          href="/diagnosis"
          className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-white"
        >
          診断する
        </Link>
      </div>
    );
  }

  const typeData = torisetsuTypes[result.typeId];

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col items-center px-5 py-6 max-w-lg mx-auto w-full">
        <section
          className="w-full rounded-2xl border bg-card-bg overflow-hidden mb-5 animate-scale-in"
          style={{ borderColor: typeData.color + "40" }}
        >
          <div className="h-1.5" style={{ backgroundColor: typeData.color }} />
          <div className="flex flex-col items-center text-center px-5 pt-6 pb-5">
            <div className="text-[10px] font-bold tracking-wider text-muted mb-4">
              YOUR TYPE
            </div>
            <div
              className="text-5xl mb-3 w-20 h-20 flex items-center justify-center rounded-2xl"
              style={{ backgroundColor: typeData.color + "15" }}
            >
              {typeData.emoji}
            </div>
            <h1
              className="text-2xl font-extrabold mb-1"
              style={{ color: typeData.color }}
            >
              {typeData.name}
            </h1>
            <p className="text-sm text-muted">{typeData.subtitle}</p>
          </div>
          <div className="bg-label-bg/50 px-5 py-2 text-center border-t border-card-border">
            <p className="text-[9px] font-bold tracking-wider text-muted/60">
              ワタシのトリセツ
            </p>
          </div>
        </section>

        <p className="text-sm text-muted text-center mb-6">
          結果の全機能を使うには、もう一度診断してください
        </p>

        <Link
          href="/diagnosis"
          className="rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25"
        >
          診断をやり直す
        </Link>

        <Link
          href="/"
          className="text-xs text-muted hover:text-foreground transition-colors mt-6"
        >
          トップに戻る
        </Link>
      </main>
    </div>
  );
}
