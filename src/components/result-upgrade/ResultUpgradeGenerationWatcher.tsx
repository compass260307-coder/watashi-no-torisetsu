"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { watchResultUpgrade } from "@/lib/result-upgrade-polling";

export function ResultUpgradeGenerationWatcher({
  initialState,
}: {
  initialState: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ source: string; state: string } | null>(null);
  const state = progress?.source === initialState ? progress.state : initialState;
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (initialState === "ready" || (initialState === "failed" && retryKey === 0)) return;
    return watchResultUpgrade({
      force: retryKey > 0,
      onReady: () => {
        setProgress({ source: initialState, state: "ready" });
        router.refresh();
      },
      onFailed: () => setProgress({ source: initialState, state: "failed" }),
    });
  }, [initialState, retryKey, router]);

  if (state === "ready") {
    return (
      <div className="bg-[#FFF8E8] px-4 py-3 text-center text-[13px] font-bold text-[#72501D]">
        あなた専用の結果が完成しました。{" "}
        <Link href="/result-upgrade/reading" className="underline underline-offset-2">
          鑑定書を見る
        </Link>
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3 bg-[#FFF1F0] px-4 py-3 text-[13px] font-bold text-[#8A3932]">
        作成が途中で止まりました。回答は保存されています。
        <button
          type="button"
          onClick={() => {
            setRetryKey((value) => value + 1);
            setProgress({ source: initialState, state: "generating" });
          }}
          className="rounded-full bg-[#8A3932] px-4 py-2 text-white"
        >
          もう一度作成する
        </button>
      </div>
    );
  }
  return (
    <div className="bg-[#FFF8E8] px-4 py-3 text-center text-[13px] font-bold text-[#72501D]">
      Aliceがあなた専用のキャラクターと鑑定書を作成しています…
    </div>
  );
}
