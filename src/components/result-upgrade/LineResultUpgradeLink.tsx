"use client";
import { useState, type CSSProperties, type ReactNode } from "react";

export function LineResultUpgradeLink({ ownerToken, preview = false, className, style, children }: {
  ownerToken: string; preview?: boolean; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function openLine() {
    if (loading) return;
    if (preview) { window.location.assign("/dev/line-result-upgrade-chat"); return; }
    setLoading(true); setError(null);
    try {
      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
      if (!liffId) throw new Error("LINE連携は現在準備中です。");
      const response = await fetch("/api/line/link-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "liff", owner_token: ownerToken, intent: "result_upgrade" }),
      });
      const data = await response.json();
      if (!response.ok || !data.code || !data.intent_token) throw new Error("LINEへの連携を開始できませんでした。購入した診断結果からもう一度お試しください。");
      const query = new URLSearchParams({ code: data.code, intent_token: data.intent_token });
      window.location.assign(`https://liff.line.me/${encodeURIComponent(liffId)}?${query}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "LINEを開けませんでした。"); setLoading(false);
    }
  }
  return <span className="inline-flex max-w-full flex-col items-center">
    <button type="button" disabled={loading} onClick={openLine} className={className} style={style}>
      {loading ? "LINEへつないでいます…" : children}
    </button>
    {error && <span role="alert" className="mt-3 text-[13px] font-bold text-red-700">{error}</span>}
  </span>;
}
