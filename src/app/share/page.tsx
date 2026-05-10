"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

type Status =
  | "loading"
  | "sharing"
  | "success"
  | "cancelled"
  | "error"
  | "invalid"
  | "missing-liff"
  | "needs-self-diagnosis";

const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.watashi-torisetsu.com";

type ShareMode = "evaluate" | "invite";

function buildEvaluateMessages(senderName: string, friendInviteUrl: string) {
  return [
    {
      type: "text" as const,
      text: [
        `${senderName}さんから、ワタシのトリセツの回答リクエストが届きました🐧`,
        "",
        "10問・2分で完了します。",
        `あなたから見た${senderName}さんの印象を教えてください✨`,
        "",
        "▼ こちらから回答できます",
        friendInviteUrl,
      ].join("\n"),
    },
  ];
}

function buildInviteMessages() {
  return [
    {
      type: "text" as const,
      text: [
        "ワタシのトリセツ、やってみない？",
        "意外な自分が見えてくる🐧",
        "",
        "▼ 3分で診断できます",
        PUBLIC_BASE_URL,
      ].join("\n"),
    },
  ];
}

function buildShareMessages(
  mode: ShareMode,
  senderName: string,
  friendInviteUrl: string,
) {
  return mode === "invite"
    ? buildInviteMessages()
    : buildEvaluateMessages(senderName, friendInviteUrl);
}

function ShareContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const sharedOnce = useRef(false);
  const liffRef = useRef<typeof import("@line/liff").default | null>(null);
  const senderNameRef = useRef<string>("友達");
  const friendInviteUrlRef = useRef<string>("");
  const modeRef = useRef<ShareMode>("evaluate");

  const startShare = async () => {
    const liff = liffRef.current;
    if (!liff) return;
    setStatus("sharing");
    try {
      const messages = buildShareMessages(
        modeRef.current,
        senderNameRef.current,
        friendInviteUrlRef.current,
      );
      const result = await liff.shareTargetPicker(messages, {
        isMultiple: true,
      });
      if (result && (result as { status?: string }).status === "success") {
        setStatus("success");
      } else {
        setStatus("cancelled");
      }
    } catch (err) {
      console.error("shareTargetPicker error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (sharedOnce.current) return;
    sharedOnce.current = true;

    const init = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_SHARE;
        if (!liffId) {
          setStatus("missing-liff");
          return;
        }

        // LIFF経由のリダイレクトでは、元のクエリが liff.state にエンコードされて入る
        let inviteCode = searchParams.get("inviteCode");
        let intent = searchParams.get("intent");
        if (!inviteCode && !intent) {
          const liffState = searchParams.get("liff.state");
          if (liffState) {
            try {
              const decoded = decodeURIComponent(liffState);
              const stateParams = new URLSearchParams(
                decoded.startsWith("?") ? decoded.slice(1) : decoded,
              );
              inviteCode = stateParams.get("inviteCode");
              intent = stateParams.get("intent");
            } catch (err) {
              console.error("liff.state parse error:", err);
            }
          }
        }

        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        if (!liff.isApiAvailable("shareTargetPicker")) {
          throw new Error(
            "shareTargetPicker is not available in this environment",
          );
        }

        const profile = await liff.getProfile().catch(() => null);
        let senderName = profile?.displayName?.trim() || "友達";

        let mode: ShareMode;
        if (intent === "invite") {
          mode = "invite";
        } else if (inviteCode) {
          mode = "evaluate";
        } else if (liff.isInClient() && profile?.userId) {
          // パラ無し + LIFF コンテキスト → line_users から自分の owner 情報を解決
          try {
            const idToken = liff.getIDToken();
            if (!idToken) {
              if (!cancelled) setStatus("invalid");
              return;
            }
            const res = await fetch("/api/line-resolve", {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (res.ok) {
              const data: {
                ownerToken: string | null;
                displayName: string | null;
                inviteCode: string | null;
              } = await res.json();
              if (data.inviteCode) {
                inviteCode = data.inviteCode;
                if (data.displayName) senderName = data.displayName;
                mode = "evaluate";
              } else {
                // 紐付けはあるが invite_code 取得失敗、または line_users 未登録
                if (!cancelled) setStatus("needs-self-diagnosis");
                return;
              }
            } else {
              // API エラー → 既存 fallback
              if (!cancelled) setStatus("invalid");
              return;
            }
          } catch (err) {
            console.error("line-resolve fetch error:", err);
            if (!cancelled) setStatus("invalid");
            return;
          }
        } else {
          setStatus("invalid");
          return;
        }

        const friendInviteUrl = inviteCode
          ? `${PUBLIC_BASE_URL}/friend/${inviteCode}`
          : "";

        if (cancelled) return;
        liffRef.current = liff;
        senderNameRef.current = senderName;
        friendInviteUrlRef.current = friendInviteUrl;
        modeRef.current = mode;

        // shareTargetPicker をすぐ起動
        setStatus("sharing");
        const result = await liff.shareTargetPicker(
          buildShareMessages(mode, senderName, friendInviteUrl),
          { isMultiple: true },
        );
        if (cancelled) return;

        if (result && (result as { status?: string }).status === "success") {
          setStatus("success");
        } else {
          setStatus("cancelled");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("share LIFF init error:", err);
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const closeWindow = () => {
    if (liffRef.current?.isInClient()) {
      liffRef.current.closeWindow();
    } else {
      window.close();
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
      <Image
        src="/mascot/step2-ask-friend.png"
        alt=""
        width={224}
        height={224}
        priority
        className="w-56 h-auto object-contain mb-6"
      />

      {(status === "loading" || status === "sharing") && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            シェアの準備中...
          </p>
          <p className="text-sm text-muted text-center">
            少しお待ちください
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <p className="text-xl font-bold text-center mb-2">
            シェアありがとうございます🎉
          </p>
          <p className="text-sm text-muted text-center mb-6 leading-relaxed">
            友達の回答が届くと、
            <br />
            LINEに通知が来ます
          </p>
          <button
            onClick={closeWindow}
            className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white shadow-md"
          >
            閉じる
          </button>
        </>
      )}

      {status === "cancelled" && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            シェアをキャンセルしました
          </p>
          <p className="text-sm text-muted text-center mb-6 leading-relaxed">
            気が向いたらまたシェアしてみてください
          </p>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={startShare}
              className="rounded-full bg-[#06C755] px-8 py-3 text-sm font-bold text-white shadow-md"
            >
              もう一度シェアする
            </button>
            <button
              onClick={closeWindow}
              className="text-xs text-muted hover:text-foreground"
            >
              閉じる
            </button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            エラーが発生しました
          </p>
          <p className="text-sm text-muted text-center mb-6 leading-relaxed break-all">
            {errorMessage || "通信エラー"}
          </p>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={startShare}
              className="rounded-full bg-[#06C755] px-8 py-3 text-sm font-bold text-white shadow-md"
            >
              もう一度試す
            </button>
            <button
              onClick={closeWindow}
              className="text-xs text-muted hover:text-foreground"
            >
              閉じる
            </button>
          </div>
        </>
      )}

      {status === "invalid" && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            このページはシェア用です
          </p>
          <p className="text-sm text-muted text-center">
            LINEから開いてください
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

      {status === "needs-self-diagnosis" && (
        <>
          <p className="text-lg font-bold text-center mb-2">
            まず自己診断を完了してください
          </p>
          <p className="text-sm text-muted text-center mb-6 leading-relaxed">
            他己評価を集めるには、
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
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col flex-1 items-center justify-center">
          <p className="text-sm text-muted">読み込み中...</p>
        </div>
      }
    >
      <ShareContent />
    </Suspense>
  );
}
