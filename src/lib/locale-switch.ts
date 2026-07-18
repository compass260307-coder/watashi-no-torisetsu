export type SiteLocale = "ja" | "ko";

const LOCALIZED_PATHS: Record<string, Record<SiteLocale, string>> = {
  "/": { ja: "/", ko: "/ko" },
  "/ko": { ja: "/", ko: "/ko" },
  "/diagnosis": { ja: "/diagnosis", ko: "/ko/diagnosis" },
  "/ko/diagnosis": { ja: "/diagnosis", ko: "/ko/diagnosis" },
  "/terms": { ja: "/terms", ko: "/ko/terms" },
  "/ko/terms": { ja: "/terms", ko: "/ko/terms" },
  "/privacy": { ja: "/privacy", ko: "/ko/privacy" },
  "/ko/privacy": { ja: "/privacy", ko: "/ko/privacy" },
  "/legal/commerce": { ja: "/legal/commerce", ko: "/ko/legal/commerce" },
  "/ko/legal/commerce": { ja: "/legal/commerce", ko: "/ko/legal/commerce" },
  "/login": { ja: "/login", ko: "/ko/login" },
  "/ko/login": { ja: "/login", ko: "/ko/login" },
};

function resultToken(pathname: string): string | null {
  const match = pathname.match(/^\/(?:ko\/)?me\/([A-Za-z0-9_-]+)\/?$/);
  return match?.[1] ?? null;
}

/**
 * 診断結果は言語共通の owner token を使い、表示ルートだけを切り替える。
 * 結果ページではURL上のtokenを最優先し、トップでは端末保存済みtokenを再利用する。
 */
export function localeSwitchPath(
  pathname: string,
  targetLocale: SiteLocale,
  storedOwnerToken: string | null = null,
): string {
  const token = resultToken(pathname);
  if (token) {
    return `${targetLocale === "ko" ? "/ko" : ""}/me/${encodeURIComponent(token)}`;
  }

  const localized = LOCALIZED_PATHS[pathname];
  if (localized && pathname !== "/" && pathname !== "/ko") {
    return localized[targetLocale];
  }

  if (storedOwnerToken && /^[A-Za-z0-9_-]{8,128}$/.test(storedOwnerToken)) {
    return `${targetLocale === "ko" ? "/ko" : ""}/me/${encodeURIComponent(storedOwnerToken)}`;
  }

  return localized?.[targetLocale] ?? (targetLocale === "ko" ? "/ko" : "/");
}
