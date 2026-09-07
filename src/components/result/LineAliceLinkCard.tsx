"use client";

// LINE連携導線。LIFFを主経路、6桁コードを手入力フォールバックとして扱う。

import { useEffect, useRef, useState } from "react";
import type { LineAliceTrackingSource } from "@/lib/line-alice-analytics";
import { trackLineAliceEvent } from "@/lib/track";

const LINE_ADD_FRIEND_URL = "https://line.me/R/ti/p/%40867domoo";
const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "";

type IssueState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "issued"; code: string; kind: "manual" }
  | { status: "error"; message: string };

function errorMessage(errorCode: string | undefined, httpStatus: number): string {
  if (httpStatus === 401 || errorCode === "login_required") {
    return "診断した時のスマホ・ブラウザで開くと発行できます。診断がまだの人は、先に無料診断からどうぞ。";
  }
  if (httpStatus === 409 || errorCode === "diagnosis_required") {
    return "先にWeb診断を完了すると発行できます。";
  }
  if (httpStatus === 429 || errorCode === "rate_limited") {
    return "発行回数が多いようです。1時間ほどおいてもう一度どうぞ。";
  }
  return "うまく発行できませんでした。少し時間をおいてもう一度どうぞ。";
}

export type { LineAliceTrackingSource } from "@/lib/line-alice-analytics";

export default function LineAliceLinkCard({
  trackingSource = "hoshiyomi_home",
  variant = "conversation",
}: {
  trackingSource?: LineAliceTrackingSource;
  variant?: "conversation" | "fortune";
} = {}) {
  const [mainIssue, setMainIssue] = useState<IssueState>({ status: "idle" });
  const [manualIssue, setManualIssue] = useState<IssueState>({ status: "idle" });
  const cardRef = useRef<HTMLElement | null>(null);
  const viewTrackedRef = useRef(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || viewTrackedRef.current) return;

    const recordView = () => {
      if (viewTrackedRef.current) return;
      viewTrackedRef.current = true;
      trackLineAliceEvent("line_alice_card_viewed", {
        source: trackingSource,
        variant,
      });
    };

    if (!("IntersectionObserver" in window)) {
      recordView();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.35) return;
        recordView();
        observer.disconnect();
      },
      { threshold: [0.35] },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [trackingSource, variant]);

  const issueCode = async (kind: "liff" | "manual") => {
    const setIssue = kind === "liff" ? setMainIssue : setManualIssue;
    setIssue({ status: "loading" });
    trackLineAliceEvent("line_alice_link_code_requested", {
      source: trackingSource,
      variant,
      kind,
    });
    try {
      const res = await fetch("/api/line/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        kind?: "liff" | "manual";
        error?: string;
      };
      if (
        !res.ok ||
        body.kind !== kind ||
        typeof body.code !== "string" ||
        (kind === "liff"
          ? !/^[A-Za-z0-9_-]{32}$/.test(body.code)
          : !/^\d{6}$/.test(body.code))
      ) {
        trackLineAliceEvent("line_alice_link_code_failed", {
          source: trackingSource,
          variant,
          kind,
          http_status: res.status,
          error_code: body.error ?? "invalid_response",
        });
        setIssue({ status: "error", message: errorMessage(body.error, res.status) });
        return;
      }
      trackLineAliceEvent("line_alice_link_code_issued", {
        source: trackingSource,
        variant,
        kind,
      });
      if (kind === "liff") {
        if (!LIFF_ID) {
          trackLineAliceEvent("line_alice_link_code_failed", {
            source: trackingSource,
            variant,
            kind,
            http_status: 0,
            error_code: "liff_not_configured",
          });
          setIssue({ status: "error", message: "LINE連携は現在準備中です。" });
          return;
        }
        trackLineAliceEvent("line_alice_add_friend_clicked", {
          source: trackingSource,
          variant,
          flow: "liff",
        });
        window.location.assign(
          `https://liff.line.me/${encodeURIComponent(LIFF_ID)}?code=${encodeURIComponent(body.code)}`,
        );
        return;
      }
      setIssue({ status: "issued", code: body.code, kind: "manual" });
    } catch {
      trackLineAliceEvent("line_alice_link_code_failed", {
        source: trackingSource,
        variant,
        kind,
        http_status: 0,
        error_code: "network_error",
      });
      setIssue({
        status: "error",
        message: "通信がうまくいきませんでした。電波の良いところでもう一度どうぞ。",
      });
    }
  };

  return (
    <section
      ref={cardRef}
      className="rounded-2xl border border-[#5B5BEF]/15 bg-white p-6 shadow-[0_12px_34px_rgba(46,46,92,0.08)] md:p-8"
    >
      <p className="text-[11px] font-black tracking-[0.14em] text-[#06C755]">
        LINE
      </p>
      <h2 className="mt-1 text-[20px] font-black text-[#2E2E5C] md:text-[24px]">
        LINEでもAliceと話せます
      </h2>
      <p className="mt-3 text-[14px] font-medium leading-[1.9] text-[#2E2E5C]/65 md:text-[15px]">
        診断結果を知っているAliceと、LINEでいつでもおしゃべり。今日の占いも毎日引けます。1日3通まで無料です。
      </p>
      <div className="mt-5 flex flex-col gap-3 md:max-w-[420px]">
        <button
          type="button"
          onClick={() => void issueCode("liff")}
          disabled={mainIssue.status === "loading"}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#06C755] px-6 text-[15px] font-black text-white transition-transform active:scale-95"
        >
          {mainIssue.status === "loading" ? "LINEを開いています…" : "LINEで連携する"}
        </button>
        {mainIssue.status === "error" ? (
          <p className="text-[13px] font-bold leading-relaxed text-[#C2410C]">
            {mainIssue.message}
          </p>
        ) : null}
        {manualIssue.status === "issued" ? (
          <div className="rounded-xl border border-[#5B5BEF]/15 bg-[#F3F0FF] px-5 py-4 text-center">
            <p className="text-[11px] font-black text-[#2E2E5C]/55">
              連携コード (10分間有効)
            </p>
            <p className="my-1 text-[32px] font-black tracking-[0.3em] text-[#2E2E5C]">
              {manualIssue.code}
            </p>
            <p className="text-[12px] font-medium leading-relaxed text-[#2E2E5C]/65">
              Aliceとのトークに、この6桁をそのまま送ると連携完了です。
            </p>
            <a
              href={LINE_ADD_FRIEND_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackLineAliceEvent("line_alice_add_friend_clicked", {
                  source: trackingSource,
                  variant,
                  flow: "manual",
                })
              }
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#06C755] px-5 text-[13px] font-black text-white"
            >
              Aliceを友だち追加
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void issueCode("manual")}
            disabled={manualIssue.status === "loading"}
            className="text-[12px] font-bold text-[#5B5BEF] underline underline-offset-4 disabled:opacity-50"
          >
            {manualIssue.status === "loading" ? "発行中…" : "うまくいかない場合は6桁コードで連携"}
          </button>
        )}
        {manualIssue.status === "error" && (
          <p className="text-[13px] font-bold leading-relaxed text-[#C2410C]">
            {manualIssue.message}
          </p>
        )}
      </div>
    </section>
  );
}
