"use client";

import { useEffect, useRef, useState } from "react";
import { LoginCard } from "@/components/LoginCard";
import { RESULT_UPGRADE_SESSION_COPY } from "@/i18n/result-upgrade-session";

type Props = {
  ownerToken: string;
  locale?: Extract<Parameters<typeof LoginCard>[0]["locale"], "ja" | "ko">;
  onVerified: () => void;
};

/** Keep the chat's answers in memory while the user restores their session. */
export function ResultUpgradeSessionCheck({ ownerToken, locale = "ja", onVerified }: Props) {
  const copy = RESULT_UPGRADE_SESSION_COPY[locale];
  const [state, setState] = useState<"checking" | "login" | "mismatch" | "error">("checking");
  const [retry, setRetry] = useState(0);
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => { onVerifiedRef.current = onVerified; }, [onVerified]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    let active = true;
    async function check() {
      try {
        const response = await fetch("/api/session/owner", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Session check failed");
        const data = await response.json() as { ownerToken?: unknown };
        if (!active) return;
        if (!data.ownerToken) setState("login");
        else if (data.ownerToken !== ownerToken) setState("mismatch");
        else onVerifiedRef.current();
      } catch {
        if (active) setState("error");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void check();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [ownerToken, retry]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-[28px] bg-[#F5F4FB] p-5 text-[#2E2E5C]">
      <p className="text-[18px] font-black">Alice</p>
      <p role="status" className="mt-3 text-[14px] font-bold leading-[1.8]">
        {state === "checking" ? copy.checking : state === "error" ? copy.checkError : state === "mismatch" ? copy.mismatch : copy.loginRequired}
      </p>
      {(state === "login" || state === "mismatch") && (
        <>
          <p className="mt-2 text-[13px] leading-[1.8]">{copy.keepAnswers}</p>
          <div className="mx-auto mt-4 w-full max-w-[440px]"><LoginCard locale={locale} /></div>
        </>
      )}
      {state !== "checking" && (
        <button type="button" onClick={() => { setState("checking"); setRetry(value => value + 1); }}
          className="mx-auto mt-5 rounded-full bg-[#5B5BEF] px-5 py-3 text-[14px] font-bold text-white">
          {state === "error" ? copy.retry : copy.resume}
        </button>
      )}
    </div>
  );
}
