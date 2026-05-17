"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";

const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.watashi-torisetsu.com";

type Status =
  | "loading"
  | "redirecting"
  | "needs-self-diagnosis"
  | "missing-liff"
  | "out-of-line"
  | "error";

function RedirectContent() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const init = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
        if (!liffId) {
          setStatus("missing-liff");
          return;
        }
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        if (!liff.isInClient()) {
          setStatus("out-of-line");
          return;
        }
        const idToken = liff.getIDToken();
        if (!idToken) {
          setStatus("error");
          setErrorMessage("LIFF ID token not available (openid scope 必須)");
          return;
        }
        const res = await fetch("/api/line-resolve", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(`line-resolve ${res.status}`);
          return;
        }
        const data: { ownerToken: string | null } = await res.json();

        // dest クエリで遷移先を切り替え:
        //   既定         → /report/{ownerToken}
        //   "zukan"      → /zukan/{ownerToken} (cell 2)
        //   "perceptions"→ /perceptions/{ownerToken} (cell 4)
        //   "zukan-mine" → /zukan-mine (Phase 3-β B-4、ownerToken 不要)
        // LIFF 経由の場合 liff.state にクエリが URL エンコードされて入ることがある
        const search = new URLSearchParams(window.location.search);
        let dest = search.get("dest");
        if (!dest) {
          const liffState = search.get("liff.state");
          if (liffState) {
            try {
              const decoded = decodeURIComponent(liffState);
              const stateParams = new URLSearchParams(
                decoded.startsWith("?") ? decoded.slice(1) : decoded,
              );
              dest = stateParams.get("dest");
            } catch (err) {
              console.warn("liff.state parse error:", err);
            }
          }
        }

        // dest=zukan-mine は ownerToken に依存しない (LIFF 内で id_token から再解決)
        if (dest === "zukan-mine") {
          setStatus("redirecting");
          window.location.replace("/zukan-mine");
          return;
        }

        // Phase 3-β D-10/D-11/D-12: dest=settings → /settings (LIFF 内で id_token 認可)
        if (dest === "settings") {
          setStatus("redirecting");
          window.location.replace("/settings");
          return;
        }

        // Phase 3-β D-1/C-3 連動: dest=integrated-new → /integrated/new
        if (dest === "integrated-new") {
          setStatus("redirecting");
          window.location.replace("/integrated/new");
          return;
        }

        if (data.ownerToken) {
          const target =
            dest === "zukan"
              ? `/zukan/${data.ownerToken}`
              : dest === "perceptions"
                ? `/perceptions/${data.ownerToken}`
                : `/report/${data.ownerToken}`;
          setStatus("redirecting");
          window.location.replace(target);
          return;
        }
        setStatus("needs-self-diagnosis");
      } catch (err) {
        console.error("torisetsu/redirect init error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    };
    init();
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
      <Image
        src="/mascot/analyzing-penguin.png"
        alt=""
        width={224}
        height={224}
        priority
        className="w-56 h-auto object-contain mb-6"
      />
      {(status === "loading" || status === "redirecting") && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            あなたのトリセツを開いています...
          </p>
          <p className="text-sm text-muted text-center">少しお待ちください</p>
        </>
      )}
      {status === "needs-self-diagnosis" && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            まず自己診断を完了してください
          </p>
          <p className="text-sm text-muted text-center mb-6 leading-relaxed">
            トリセツを開くには、
            <br />
            先にあなた自身の診断が必要です
          </p>
          <a
            href={`${PUBLIC_BASE_URL}/diagnosis`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-md"
          >
            自己診断を始める
          </a>
        </>
      )}
      {status === "out-of-line" && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            このページは LINE 内で開いてください
          </p>
          <p className="text-sm text-muted text-center">
            公式 LINE のメニューから開けます
          </p>
        </>
      )}
      {status === "missing-liff" && (
        <>
          <p className="text-lg font-bold text-center mb-2">設定エラー</p>
          <p className="text-sm text-muted text-center">
            LIFF設定が見つかりません
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            エラーが発生しました
          </p>
          <p className="text-sm text-muted text-center mb-6 break-all">
            {errorMessage || "通信エラー"}
          </p>
          <a
            href={`${PUBLIC_BASE_URL}/diagnosis`}
            className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white"
          >
            診断ページへ
          </a>
        </>
      )}
    </div>
  );
}

export default function TorisetsuRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col flex-1 items-center justify-center">
          <p className="text-sm text-muted">読み込み中...</p>
        </div>
      }
    >
      <RedirectContent />
    </Suspense>
  );
}
