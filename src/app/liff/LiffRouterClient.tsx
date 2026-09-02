"use client";

// LIFF SDK (CDN) を読み込み → liff.init → アクセストークンを /api/line/liff-route に
// 渡して本人専用URLをもらい、その場でリダイレクトする。
// SDKはCDN読み込みにして npm 依存を増やさない (@line/liff は入れない方針)。

import { useEffect, useState } from "react";

const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "";
const LINE_TALK_URL = "https://line.me/R/ti/p/%40867domoo";

interface LiffLike {
  init(config: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(): void;
  getAccessToken(): string | null;
}

declare global {
  interface Window {
    liff?: LiffLike;
  }
}

async function loadLiffSdk(): Promise<LiffLike> {
  if (window.liff) return window.liff;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("liff sdk load failed"));
    document.head.appendChild(script);
  });
  if (!window.liff) throw new Error("liff sdk unavailable after load");
  return window.liff;
}

// liff.line.me/<id>?dest=me は endpoint に liff.state として運ばれることがあるので両方見る
function resolveDest(): string {
  const params = new URLSearchParams(window.location.search);
  const direct = params.get("dest");
  if (direct) return direct;
  const liffState = params.get("liff.state");
  if (liffState) {
    const nested = new URLSearchParams(liffState.replace(/^\?/, "")).get("dest");
    if (nested) return nested;
  }
  return "me";
}

type ViewState = "loading" | "unlinked" | "error";

export default function LiffRouterClient() {
  const [state, setState] = useState<ViewState>("loading");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const liff = await loadLiffSdk();
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          // LINEアプリ内なら通常ここには来ない (自動ログイン)。外部ブラウザ向けの保険
          liff.login();
          return;
        }
        const accessToken = liff.getAccessToken();
        if (!accessToken) throw new Error("no access token");
        const res = await fetch("/api/line/liff-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dest: resolveDest(), accessToken }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (res.status === 404 && body.error === "not_linked") {
          if (!cancelled) setState("unlinked");
          return;
        }
        if (!res.ok || !body.url) {
          throw new Error(body.error ?? `route failed: ${res.status}`);
        }
        window.location.replace(body.url);
      } catch (caught) {
        console.error("[liff] routing failed", caught);
        if (!cancelled) setState("error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "unlinked") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#faf7f2] px-6">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold tracking-widest text-stone-400">
            ALICE
          </p>
          <h1 className="mt-3 text-lg font-bold text-stone-800">
            まだ連携が済んでいないみたいです
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-600">
            診断結果とLINEを連携すると、ここからあなたのページを開けるようになります。診断が済んでいる人は、トークに6桁の連携コードを送ってくださいね。
          </p>
          <a
            href="https://www.watashi-torisetsu.com/"
            className="mt-8 block w-full rounded-full bg-[#5B5BEF] px-6 py-3 text-sm font-bold text-white"
          >
            無料診断をはじめる
          </a>
          <a
            href={LINE_TALK_URL}
            className="mt-3 block w-full rounded-full bg-[#06C755] px-6 py-3 text-sm font-bold text-white"
          >
            LINEに戻る
          </a>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#faf7f2] px-6">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold tracking-widest text-stone-400">
            ALICE
          </p>
          <h1 className="mt-3 text-lg font-bold text-stone-800">
            うまく開けませんでした
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-600">
            少し時間をおいて、もう一度メニューから開いてみてください。
          </p>
          <a
            href={LINE_TALK_URL}
            className="mt-8 block w-full rounded-full bg-[#06C755] px-6 py-3 text-sm font-bold text-white"
          >
            LINEに戻る
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#faf7f2] px-6">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#5B5BEF]/20 border-t-[#5B5BEF]" />
        </div>
        <p className="mt-4 text-sm font-bold text-[#2E2E5C]/60">
          あなたのページをひらいています…
        </p>
      </div>
    </main>
  );
}
