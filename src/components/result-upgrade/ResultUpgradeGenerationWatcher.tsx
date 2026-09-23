"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ResultUpgradeGenerationWatcher({
  initialState,
}: {
  initialState: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (state === "ready") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function kick() {
      try {
        await fetch("/api/result-upgrade/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: retryKey > 0 }),
        });
      } catch {
        // 次回のstatus取得で回復する。
      }
    }

    async function poll() {
      if (cancelled) return;
      try {
        const response = await fetch("/api/result-upgrade/status", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { state?: string };
          if (data.state === "ready") {
            setState("ready");
            router.refresh();
            return;
          }
          if (typeof data.state === "string") setState(data.state);
        }
      } catch {
        // 一時的な通信失敗は待機を継続する。
      }
      timer = setTimeout(poll, 2_000);
    }

    void kick().then(poll);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [retryKey, router, state]);

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
            setState("generating");
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
