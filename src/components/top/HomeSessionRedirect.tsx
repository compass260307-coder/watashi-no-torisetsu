"use client";

import { useEffect } from "react";

import { SESSION_MARKER_COOKIE_NAME } from "@/lib/session-constants";

const OWNER_TOKEN_KEY = "torisetsu_owner_token";
const SAFE_TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

function hasSessionMarker(): boolean {
  return document.cookie
    .split(";")
    .some(
      (part) =>
        part.trim() === `${SESSION_MARKER_COOKIE_NAME}=1`,
    );
}

function clearSessionMarker() {
  document.cookie = `${SESSION_MARKER_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function resultPath(localePrefix: string, ownerToken: string): string {
  return `${localePrefix}/me/${encodeURIComponent(ownerToken)}`;
}

export default function HomeSessionRedirect({
  localePrefix = "",
}: {
  localePrefix?: "" | "/ko" | "/en";
}) {
  useEffect(() => {
    // 診断済みユーザーがトップを明示的に見たい場合の既存挙動を維持する。
    if (new URLSearchParams(window.location.search).get("stay") === "1") {
      return;
    }

    let storedToken: string | null = null;
    try {
      storedToken = localStorage.getItem(OWNER_TOKEN_KEY);
    } catch {
      // localStorage が無効でも、下の session marker 経由で復元を試せる。
    }

    const redirectStoredToken = () => {
      if (!storedToken || !SAFE_TOKEN.test(storedToken)) return false;
      window.location.replace(resultPath(localePrefix, storedToken));
      return true;
    };

    // marker が無い既存端末は localStorage だけで完結する。新規訪問者もここで
    // 終了するため、匿名アクセスでは session API / DB を呼ばない。
    if (!hasSessionMarker()) {
      redirectStoredToken();
      return;
    }

    // marker がある端末は HttpOnly cookie の session を正本にする。
    // マジックリンクで別アカウントへ切り替えた直後でも古い localStorage を使わない。
    const controller = new AbortController();
    void fetch("/api/session/owner", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Session lookup failed");
        return response.json();
      })
      .then((data: { ownerToken?: unknown } | null) => {
        if (controller.signal.aborted) return;
        const ownerToken = data?.ownerToken;
        if (typeof ownerToken !== "string" || !SAFE_TOKEN.test(ownerToken)) {
          clearSessionMarker();
          try {
            localStorage.removeItem(OWNER_TOKEN_KEY);
          } catch {
            // Storage may be disabled.
          }
          return;
        }
        try {
          localStorage.setItem(OWNER_TOKEN_KEY, ownerToken);
        } catch {
          // 保存不可でも今回の遷移には ownerToken を利用できる。
        }
        window.location.replace(resultPath(localePrefix, ownerToken));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // 一時的な通信失敗時だけ、従来どおり保存済みトークンへフォールバックする。
        redirectStoredToken();
      });

    return () => controller.abort();
  }, [localePrefix]);

  return null;
}
