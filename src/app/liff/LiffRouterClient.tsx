"use client";

// LIFF共通入口。codeがあれば診断結果を連携し、なければ従来どおり
// リッチメニューから本人専用ページへルーティングする。

import { useEffect, useState, type ReactNode } from "react";

const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "";
const LINE_TALK_URL = "https://line.me/R/ti/p/%40867domoo";

interface LiffLike {
  init(config: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(): void;
  getAccessToken(): string | null;
  getIDToken(): string | null;
}

declare global {
  interface Window {
    liff?: LiffLike;
  }
}

type CurrentLink = {
  diagnosedAt: string | null;
  typeName: string | null;
};

type ViewState =
  | { kind: "loading"; message: string }
  | { kind: "unlinked" }
  | { kind: "conflict"; code: string; idToken: string; current: CurrentLink | null }
  | { kind: "switching" }
  | { kind: "linked"; switched: boolean }
  | { kind: "error"; message: string };

async function loadLiffSdk(): Promise<LiffLike> {
  if (window.liff) return window.liff;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://static.line-scdn.net/liff/edge/2/sdk.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("liff sdk load failed")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("liff sdk load failed"));
    document.head.appendChild(script);
  });
  if (!window.liff) throw new Error("liff sdk unavailable after load");
  return window.liff;
}

// liff.line.me/<id>?code=... はendpointへ liff.state として運ばれる場合がある。
// LINE公式の案内どおり liff.init 完了後に呼び出す。
function resolveLiffParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  const direct = params.get(name);
  if (direct) return direct;

  const state = params.get("liff.state");
  if (!state) return null;
  try {
    return new URL(state, window.location.origin).searchParams.get(name);
  } catch {
    return new URLSearchParams(state.replace(/^\?/, "")).get(name);
  }
}

async function linkDiagnosis(input: {
  code: string;
  idToken: string;
  force: boolean;
}): Promise<
  | { kind: "linked"; switched: boolean }
  | { kind: "conflict"; current: CurrentLink | null }
  | { kind: "error"; message: string }
> {
  try {
    const response = await fetch("/api/line/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await response.json().catch(() => ({}))) as {
      linked?: boolean;
      switched?: boolean;
      error?: string;
      message?: string;
      currentLink?: CurrentLink | null;
    };
    if (response.status === 409 && body.error === "already_linked_to_another_user") {
      return { kind: "conflict", current: body.currentLink ?? null };
    }
    if (!response.ok || !body.linked) {
      return {
        kind: "error",
        message:
          body.message ??
          "連携がうまくいきませんでした。結果ページからもう一度お試しください。",
      };
    }
    return { kind: "linked", switched: body.switched === true };
  } catch {
    return {
      kind: "error",
      message:
        "通信がうまくいきませんでした。電波の良いところで、結果ページからもう一度お試しください。",
    };
  }
}

function formatDiagnosisDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function PageCard({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F6F3FF] px-6 py-10">
      <div className="w-full max-w-sm rounded-[24px] border border-[#DDD7F8] bg-white p-7 text-center shadow-[0_18px_50px_rgba(46,46,92,0.10)]">
        <p className="text-xs font-black tracking-[0.2em] text-[#5B5BEF]/55">
          ALICE
        </p>
        {children}
      </div>
    </main>
  );
}

export default function LiffRouterClient() {
  const [state, setState] = useState<ViewState>({
    kind: "loading",
    message: "LINEと診断結果をつないでいます…",
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!LIFF_ID) throw new Error("LIFF ID is not configured");
        const liff = await loadLiffSdk();
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const code = resolveLiffParam("code");
        if (code) {
          const idToken = liff.getIDToken();
          if (!idToken) {
            if (!cancelled) {
              setState({
                kind: "error",
                message:
                  "LINEの本人確認情報を取得できませんでした。LIFFのopenid権限を確認してください。",
              });
            }
            return;
          }
          const result = await linkDiagnosis({ code, idToken, force: false });
          if (cancelled) return;
          if (result.kind === "conflict") {
            setState({
              kind: "conflict",
              code,
              idToken,
              current: result.current,
            });
          } else {
            setState(result);
          }
          return;
        }

        // codeがない場合は従来のリッチメニュー経路。
        const accessToken = liff.getAccessToken();
        if (!accessToken) throw new Error("no access token");
        const response = await fetch("/api/line/liff-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dest: resolveLiffParam("dest") ?? "me",
            accessToken,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (response.status === 404 && body.error === "not_linked") {
          if (!cancelled) setState({ kind: "unlinked" });
          return;
        }
        if (!response.ok || !body.url) {
          throw new Error(body.error ?? `route failed: ${response.status}`);
        }
        window.location.replace(body.url);
      } catch (caught) {
        console.error("[liff] failed", caught);
        if (!cancelled) {
          setState({
            kind: "error",
            message: "うまく開けませんでした。少し時間をおいてもう一度お試しください。",
          });
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmSwitch = async () => {
    if (state.kind !== "conflict") return;
    const { code, idToken } = state;
    setState({ kind: "switching" });
    const result = await linkDiagnosis({ code, idToken, force: true });
    if (result.kind === "linked") {
      setState({ kind: "linked", switched: true });
    } else if (result.kind === "conflict") {
      setState({ kind: "conflict", code, idToken, current: result.current });
    } else {
      setState(result);
    }
  };

  if (state.kind === "linked") {
    return (
      <PageCard>
        <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#06C755]/12 text-3xl text-[#06A847]">
          ✓
        </div>
        <h1 className="mt-4 text-[22px] font-black leading-relaxed text-[#2E2E5C]">
          {state.switched ? "連携先を切り替えました" : "連携できました"}
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-[#2E2E5C]/65">
          Aliceに話しかけてみてください。
          <br />
          あなたの診断結果をもとにお話しできます。
        </p>
        <a
          href={LINE_TALK_URL}
          className="mt-7 block w-full rounded-2xl bg-[#06C755] px-6 py-3.5 text-sm font-black text-white shadow-[0_5px_0_#04933F] active:translate-y-1 active:shadow-none"
        >
          Aliceとのトークを開く
        </a>
      </PageCard>
    );
  }

  if (state.kind === "conflict") {
    const diagnosedAt = formatDiagnosisDate(state.current?.diagnosedAt ?? null);
    return (
      <PageCard>
        <h1 className="mt-4 text-[21px] font-black leading-relaxed text-[#2E2E5C]">
          連携する診断結果を
          <br />
          切り替えますか？
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-[#2E2E5C]/65">
          このLINEは、現在こちらの診断結果と連携されています。
        </p>
        <div className="mt-5 rounded-2xl bg-[#F6F3FF] px-5 py-4 text-left">
          {state.current?.typeName ? (
            <p className="text-sm font-black text-[#2E2E5C]">
              タイプ：{state.current.typeName}
            </p>
          ) : null}
          {diagnosedAt ? (
            <p className="mt-1 text-xs font-bold text-[#2E2E5C]/55">
              診断日：{diagnosedAt}
            </p>
          ) : null}
          {!state.current?.typeName && !diagnosedAt ? (
            <p className="text-xs font-bold text-[#2E2E5C]/55">
              連携済みの診断結果があります
            </p>
          ) : null}
        </div>
        <p className="mt-4 text-xs font-medium leading-relaxed text-[#2E2E5C]/55">
          切り替えると、Aliceが参照する診断結果が今回のものに変わります。
        </p>
        <button
          type="button"
          onClick={() => void confirmSwitch()}
          className="mt-6 w-full rounded-2xl bg-[#5B5BEF] px-6 py-3.5 text-sm font-black text-white shadow-[0_5px_0_#3E3EC8] active:translate-y-1 active:shadow-none"
        >
          新しい診断結果に切り替える
        </button>
        <a
          href={LINE_TALK_URL}
          className="mt-3 block w-full rounded-2xl border border-[#D9D5EF] px-6 py-3 text-sm font-bold text-[#2E2E5C]/65"
        >
          切り替えずトークに戻る
        </a>
      </PageCard>
    );
  }

  if (state.kind === "unlinked") {
    return (
      <PageCard>
        <h1 className="mt-3 text-lg font-black text-[#2E2E5C]">
          まだ連携が済んでいないみたいです
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#2E2E5C]/65">
          診断結果ページから「LINEでAliceと話す」を押すと、友だち追加と連携をまとめて進められます。
        </p>
        <a
          href="https://www.watashi-torisetsu.com/"
          className="mt-7 block w-full rounded-2xl bg-[#5B5BEF] px-6 py-3.5 text-sm font-black text-white"
        >
          無料診断をはじめる
        </a>
        <a
          href={LINE_TALK_URL}
          className="mt-3 block w-full rounded-2xl bg-[#06C755] px-6 py-3.5 text-sm font-black text-white"
        >
          LINEに戻る
        </a>
      </PageCard>
    );
  }

  if (state.kind === "error") {
    return (
      <PageCard>
        <h1 className="mt-3 text-lg font-black text-[#2E2E5C]">
          うまく連携できませんでした
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#2E2E5C]/65">
          {state.message}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-[#2E2E5C]/45">
          LIFFが開けない場合は、結果ページの「うまくいかない場合はこちら」から6桁コードでも連携できます。
        </p>
        <a
          href={LINE_TALK_URL}
          className="mt-7 block w-full rounded-2xl bg-[#06C755] px-6 py-3.5 text-sm font-black text-white"
        >
          LINEに戻る
        </a>
      </PageCard>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F6F3FF] px-6">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#5B5BEF]/20 border-t-[#5B5BEF]" />
        </div>
        <p className="mt-4 text-sm font-bold text-[#2E2E5C]/60">
          {state.kind === "switching"
            ? "連携先を切り替えています…"
            : state.message}
        </p>
      </div>
    </main>
  );
}
