"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { track } from "@/lib/track";

type Status =
  | "init"
  | "registering"
  | "needs-friend-add"
  | "already-friend"
  | "missing-owner"
  | "missing-liff"
  | "error";

const FRIEND_ADD_URL = "https://lin.ee/VbAOXrV";

const LINE_ICON_PATH =
  "M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314";

function LineRegisterContent() {
  const searchParams = useSearchParams();

  // LIFF経由のリダイレクトでは、元のクエリが liff.state にエンコードされて入る
  let ownerToken = searchParams.get("owner_token");
  if (!ownerToken) {
    const liffState = searchParams.get("liff.state");
    if (liffState) {
      try {
        const decoded = decodeURIComponent(liffState);
        const queryString = decoded.startsWith("?") ? decoded.slice(1) : decoded;
        const params = new URLSearchParams(queryString);
        ownerToken = params.get("owner_token");
      } catch (e) {
        console.error("Failed to parse liff.state:", e);
      }
    }
  }

  const [status, setStatus] = useState<Status>("init");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setStatus("missing-liff");
      return;
    }
    if (!ownerToken) {
      setStatus("missing-owner");
      return;
    }

    setStatus("registering");

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        const lineUserId = profile.userId;
        const displayName = profile.displayName?.trim() || null;

        // 紐付け保存 (welcome は webhook 経由で送られる)
        const res = await fetch("/api/line-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerToken, lineUserId, displayName }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMessage(data?.error ?? "登録に失敗しました");
          return;
        }

        track("line_register_completed", {
          ownerToken: ownerToken ?? undefined,
          metadata: { lineUserId },
        });

        // 友だち状態を取得して UI 分岐
        try {
          const friendship = await liff.getFriendship();
          if (friendship.friendFlag) {
            setStatus("already-friend");
          } else {
            setStatus("needs-friend-add");
          }
        } catch (err) {
          console.error("liff.getFriendship failed:", err);
          // friendship 取得失敗時は念のため「友だち追加」案内
          setStatus("needs-friend-add");
        }
      } catch (err) {
        console.error("LIFF flow failed:", err);
        setStatus("error");
        setErrorMessage(
          "LIFFの初期化または通信に失敗しました。LINEアプリ内で開いてください。",
        );
      }
    })();
  }, [ownerToken]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
      <Image
        src="/mascot/step3-complete.png"
        alt=""
        width={224}
        height={224}
        priority
        className="w-56 h-auto object-contain mb-6"
      />

      {(status === "init" || status === "registering") && (
        <>
          <p className="text-lg font-bold text-center mb-2">準備中...</p>
          <p className="text-sm text-muted text-center">少しお待ちください</p>
        </>
      )}

      {status === "needs-friend-add" && (
        <>
          <p className="text-xl font-bold text-center mb-2">
            あと一歩！公式アカウントを
            <br />
            友だち追加してください
          </p>
          <p className="text-sm text-muted text-center mb-6 leading-relaxed">
            友だち追加すると、welcome メッセージと
            <br />
            完成までのお知らせがLINEで届きます
          </p>
          <a
            href={FRIEND_ADD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full max-w-xs rounded-full bg-[#06C755] px-8 py-4 text-base font-bold text-white shadow-md shadow-[#06C755]/25 transition-all hover:bg-[#05b34a] active:scale-[0.98]"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="white"
              aria-hidden="true"
            >
              <path d={LINE_ICON_PATH} />
            </svg>
            LINE で友だち追加
          </a>
          <p className="text-[11px] text-muted text-center mt-4 leading-relaxed">
            追加後、LINEのトーク画面で
            <br />
            welcome メッセージをご確認ください
          </p>
        </>
      )}

      {status === "already-friend" && (
        <>
          <p className="text-xl font-bold text-center mb-2">
            LINE 連携が完了しました
          </p>
          <p className="text-sm text-muted text-center mb-2 leading-relaxed">
            すでに公式アカウントを友だち追加済みです
          </p>
          <p className="text-xs text-muted/70 text-center leading-relaxed">
            ※ welcome が届いていない場合は、
            <br />
            お手数ですがサポートまでご連絡ください
          </p>
        </>
      )}

      {status === "missing-owner" && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            診断結果が見つかりません
          </p>
          <p className="text-sm text-muted text-center">
            診断ページからやり直してください
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
            登録に失敗しました
          </p>
          <p className="text-sm text-muted text-center mb-6 leading-relaxed">
            {errorMessage ?? "通信エラーが発生しました"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white shadow-md"
          >
            もう一度試す
          </button>
        </>
      )}
    </div>
  );
}

export default function LineRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col flex-1 items-center justify-center">
          <p className="text-sm text-muted">読み込み中...</p>
        </div>
      }
    >
      <LineRegisterContent />
    </Suspense>
  );
}
