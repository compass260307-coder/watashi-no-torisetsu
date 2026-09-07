"use client";

// AliceのLINE連携カード。メイン導線はLIFFによる1タップ連携。
// 手入力用6桁コードは「うまくいかない場合」のフォールバックにだけ表示する。

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { LineAliceTrackingSource } from "@/lib/line-alice-analytics";
import { trackLineAliceEvent } from "@/lib/track";

const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "";
const LINE_ADD_FRIEND_URL = "https://line.me/R/ti/p/%40867domoo";

type CodeKind = "liff" | "manual";
type IssuedCode = { code: string; expiresAt: string; kind: CodeKind };
type LinkStatus = "checking" | "linked" | "unlinked";
type MainState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };
type ManualState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "issued"; value: IssuedCode }
  | { status: "error"; message: string };

export type { LineAliceTrackingSource } from "@/lib/line-alice-analytics";

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

function cacheKey(ownerToken: string | undefined, kind: CodeKind): string {
  return `line-link-code:${ownerToken ?? "current"}:${kind}`;
}

function isValidIssuedCode(value: unknown, kind: CodeKind): value is IssuedCode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<IssuedCode>;
  const codeMatches =
    kind === "liff"
      ? typeof candidate.code === "string" && /^[A-Za-z0-9_-]{32}$/.test(candidate.code)
      : typeof candidate.code === "string" && /^\d{6}$/.test(candidate.code);
  return (
    codeMatches &&
    candidate.kind === kind &&
    typeof candidate.expiresAt === "string" &&
    Date.parse(candidate.expiresAt) > Date.now() + 5_000
  );
}

function readCachedCode(ownerToken: string | undefined, kind: CodeKind): IssuedCode | null {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(ownerToken, kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (isValidIssuedCode(parsed, kind)) return parsed;
    window.sessionStorage.removeItem(cacheKey(ownerToken, kind));
  } catch {
    // sessionStorageが利用できない環境ではサーバー再発行へフォールバックする。
  }
  return null;
}

function writeCachedCode(ownerToken: string | undefined, value: IssuedCode) {
  try {
    window.sessionStorage.setItem(cacheKey(ownerToken, value.kind), JSON.stringify(value));
  } catch {
    // 保存不可でも今回の導線は継続できる。
  }
}

export default function LineAliceLinkCard({
  onClose,
  variant = "conversation",
  ownerToken,
  trackingSource,
}: {
  onClose?: () => void;
  variant?: "conversation" | "fortune";
  ownerToken?: string;
  trackingSource: LineAliceTrackingSource;
}) {
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [main, setMain] = useState<MainState>({ status: "idle" });
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [manual, setManual] = useState<ManualState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const viewTrackedRef = useRef(false);
  const promotesFortune = variant === "fortune";

  useEffect(() => {
    let cancelled = false;
    const checkLinked = async () => {
      try {
        const response = await fetch("/api/line/link-code", { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as {
          linked?: boolean;
        };
        if (!cancelled) setLinkStatus(body.linked ? "linked" : "unlinked");
      } catch {
        if (!cancelled) setLinkStatus("unlinked");
      }
    };
    void checkLinked();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const issueCode = async (kind: CodeKind): Promise<IssuedCode> => {
    const cached = readCachedCode(ownerToken, kind);
    if (cached) return cached;

    trackLineAliceEvent("line_alice_link_code_requested", {
      source: trackingSource,
      variant,
      kind,
    });
    let response: Response;
    let body: { code?: string; expires_at?: string; kind?: CodeKind; error?: string };
    try {
      response = await fetch("/api/line/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      body = (await response.json().catch(() => ({}))) as typeof body;
    } catch {
      trackLineAliceEvent("line_alice_link_code_failed", {
        source: trackingSource,
        variant,
        kind,
        http_status: 0,
        error_code: "network_error",
      });
      throw new Error("通信がうまくいきませんでした。電波の良いところでもう一度どうぞ。");
    }

    const candidate = {
      code: body.code,
      expiresAt: body.expires_at,
      kind: body.kind,
    };
    if (!response.ok || !isValidIssuedCode(candidate, kind)) {
      trackLineAliceEvent("line_alice_link_code_failed", {
        source: trackingSource,
        variant,
        kind,
        http_status: response.status,
        error_code: body.error ?? "unknown",
      });
      throw new Error(errorMessage(body.error, response.status));
    }

    writeCachedCode(ownerToken, candidate);
    trackLineAliceEvent("line_alice_link_code_issued", {
      source: trackingSource,
      variant,
      kind,
    });
    return candidate;
  };

  const showFallback = async () => {
    setFallbackOpen(true);
    if (manual.status === "loading" || manual.status === "issued") return;
    setManual({ status: "loading" });
    try {
      const value = await issueCode("manual");
      setManual({ status: "issued", value });
    } catch (error) {
      setManual({
        status: "error",
        message: error instanceof Error ? error.message : errorMessage(undefined, 0),
      });
    }
  };

  const startLiffLink = async () => {
    if (main.status === "loading" || linkStatus !== "unlinked") return;
    setMain({ status: "loading" });
    try {
      if (!LIFF_ID) {
        trackLineAliceEvent("line_alice_link_code_failed", {
          source: trackingSource,
          variant,
          kind: "liff",
          http_status: 0,
          error_code: "liff_not_configured",
        });
        throw new Error("LINE連携は現在準備中です。");
      }
      const issued = await issueCode("liff");
      trackLineAliceEvent("line_alice_add_friend_clicked", {
        source: trackingSource,
        variant,
        flow: "liff",
      });
      window.location.assign(
        `https://liff.line.me/${encodeURIComponent(LIFF_ID)}?code=${encodeURIComponent(issued.code)}`,
      );
    } catch (error) {
      setMain({
        status: "error",
        message: error instanceof Error ? error.message : errorMessage(undefined, 0),
      });
      await showFallback();
    }
  };

  const copyManualCode = async () => {
    if (manual.status !== "issued") return;
    try {
      await navigator.clipboard.writeText(manual.value.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      ref={cardRef}
      className="relative mt-14 rounded-[20px] bg-[#5AA5BD] px-6 pb-9 pt-20 text-white shadow-[0_18px_50px_rgba(46,46,92,0.12)] md:mt-16 md:rounded-[22px] md:px-12 md:pb-12 md:pt-24"
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#5B5BEF] text-white shadow-[0_5px_16px_rgba(46,46,92,0.28)] transition hover:scale-105 active:scale-95 md:right-3 md:top-3 md:h-10 md:w-10"
        >
          <svg
            className="h-3.5 w-3.5 md:h-[18px] md:w-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[150px] w-[178px] -translate-x-1/2 -translate-y-[58%] md:h-[178px] md:w-[210px]"
      >
        <span className="absolute inset-x-0 bottom-0 h-[92px] bg-[#386F82] [clip-path:polygon(7%_18%,40%_0,91%_18%,100%_62%,63%_100%,17%_82%,0_38%)] md:h-[108px]" />
        <span className="absolute bottom-[19px] right-[10px] h-[58px] w-[72px] bg-[#2D829B] [clip-path:polygon(18%_0,100%_25%,82%_100%,0_72%)] md:bottom-[22px] md:right-[12px] md:h-[68px] md:w-[84px]" />
        <Image
          src="/characters/face/angel_N.webp"
          alt=""
          width={512}
          height={512}
          sizes="(max-width: 767px) 120px, 144px"
          className="absolute bottom-[8px] left-1/2 h-auto w-[120px] -translate-x-1/2 drop-shadow-[0_8px_12px_rgba(46,46,92,0.16)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_82%,transparent_100%)] md:bottom-[10px] md:w-[144px]"
        />
      </div>

      <div aria-hidden="true" className="absolute -right-12 top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden="true" className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-[#5B5BEF]/12 blur-3xl" />

      <div className="relative">
        <h2 className="text-[24px] font-black leading-[1.5] md:text-[32px]">
          LINEでも
          <br />
          {promotesFortune ? "Aliceが占います" : "Aliceと話せます"}
        </h2>
        <p className="mt-3 max-w-[600px] text-[14px] font-bold leading-[1.85] text-white/90 md:text-[16px]">
          {promotesFortune
            ? "診断結果を知っているAliceに、LINEでいつでも占ってもらえます。"
            : "診断結果を知っているAliceと、LINEでいつでもおしゃべり。"}
          <br className="hidden md:block" />
          今日の占いも毎日引けて、無料で会話ができます。
        </p>
      </div>

      <div className="relative mt-6 md:mt-8 md:max-w-[560px]">
        {linkStatus === "linked" ? (
          <div className="rounded-2xl border border-white/50 bg-white/95 px-5 py-5 text-center shadow-[0_10px_28px_rgba(43,99,119,0.18)]">
            <p className="text-[17px] font-black text-[#2E2E5C]">連携済み ✓</p>
            <p className="mt-1 text-[12px] font-bold text-[#2E2E5C]/55">
              Aliceはあなたの診断結果を覚えています
            </p>
            <a
              href={LINE_ADD_FRIEND_URL}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#06C755] px-6 text-[14px] font-black text-white shadow-[0_5px_0_#04933F] active:translate-y-1 active:shadow-none"
            >
              Aliceとのトークを開く
            </a>
          </div>
        ) : (
          <>
            <p className="mb-3 text-center text-[12px] font-bold leading-relaxed text-white/90 md:text-[13px]">
              友だち追加と診断結果の連携が同時に完了します
            </p>
            <button
              type="button"
              onClick={() => void startLiffLink()}
              disabled={linkStatus === "checking" || main.status === "loading"}
              className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#06C755] px-6 text-[15px] font-black text-white shadow-[0_6px_0_#04933F] transition duration-150 hover:-translate-y-0.5 hover:bg-[#10D55F] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 md:text-[16px]"
            >
              {linkStatus === "checking"
                ? "連携状態を確認中…"
                : main.status === "loading"
                  ? "連携コードを発行中…"
                  : "LINEでAliceと話す"}
            </button>
            {main.status === "error" ? (
              <p className="mt-4 rounded-xl bg-white/90 px-4 py-3 text-[13px] font-bold leading-relaxed text-[#B33A12]">
                {main.message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (fallbackOpen) {
                  setFallbackOpen(false);
                } else {
                  void showFallback();
                }
              }}
              aria-expanded={fallbackOpen}
              className="mx-auto mt-4 block text-[11px] font-bold text-white/75 underline decoration-white/35 underline-offset-4 hover:text-white"
            >
              うまくいかない場合はこちら
            </button>

            {fallbackOpen ? (
              <div className="mt-4 rounded-2xl border border-white/50 bg-white/95 px-5 py-5 text-center text-[#2E2E5C] shadow-[0_10px_28px_rgba(43,99,119,0.18)]">
                <p className="text-[12px] font-black">6桁の連携コード</p>
                {manual.status === "loading" || manual.status === "idle" ? (
                  <p className="my-5 text-[13px] font-bold text-[#2E2E5C]/50">
                    コードを発行中…
                  </p>
                ) : manual.status === "issued" ? (
                  <>
                    <p className="my-2 font-mono text-[32px] font-black tracking-[0.22em] text-[#2E2E5C]">
                      {manual.value.code}
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyManualCode()}
                      className="rounded-full border border-[#5B5BEF]/25 bg-[#F4F1FF] px-5 py-2 text-[12px] font-black text-[#5B5BEF]"
                    >
                      {copied ? "コピーしました ✓" : "コードをコピー"}
                    </button>
                  </>
                ) : (
                  <div className="my-4">
                    <p className="text-[12px] font-bold leading-relaxed text-[#B33A12]">
                      {manual.message}
                    </p>
                    <button
                      type="button"
                      onClick={() => void showFallback()}
                      className="mt-3 text-[12px] font-black text-[#5B5BEF] underline"
                    >
                      もう一度発行する
                    </button>
                  </div>
                )}
                <p className="mt-4 text-[12px] font-medium leading-relaxed text-[#2E2E5C]/65">
                  LINEで公式アカウントを追加し、このコードをそのまま送ってください。
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
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#06C755] px-6 text-[14px] font-black text-white"
                >
                  LINEで友だち追加
                </a>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
