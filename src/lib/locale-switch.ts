export type SiteLocale = "ja" | "ko";

const LOCALIZED_PATHS: Record<string, Record<SiteLocale, string>> = {
  "/": { ja: "/", ko: "/ko" },
  "/ko": { ja: "/", ko: "/ko" },
  "/about": { ja: "/about", ko: "/ko/about" },
  "/ko/about": { ja: "/about", ko: "/ko/about" },
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
  "/login/confirm": { ja: "/login/confirm", ko: "/ko/login/confirm" },
  "/ko/login/confirm": { ja: "/login/confirm", ko: "/ko/login/confirm" },
  "/auth/error": { ja: "/auth/error", ko: "/ko/auth/error" },
  "/ko/auth/error": { ja: "/auth/error", ko: "/ko/auth/error" },
  "/result": { ja: "/result", ko: "/ko/result" },
  "/ko/result": { ja: "/result", ko: "/ko/result" },
  "/purchase-complete": {
    ja: "/purchase-complete",
    ko: "/ko/purchase-complete",
  },
  "/ko/purchase-complete": {
    ja: "/purchase-complete",
    ko: "/ko/purchase-complete",
  },
  "/tako": { ja: "/tako", ko: "/ko/tako" },
  "/ko/friend": { ja: "/tako", ko: "/ko/tako" },
  "/ko/tako": { ja: "/tako", ko: "/ko/tako" },
  "/aisho": { ja: "/aisho", ko: "/ko/aisho" },
  "/ko/aisho": { ja: "/aisho", ko: "/ko/aisho" },
  "/types": { ja: "/types", ko: "/ko/types" },
  "/ko/types": { ja: "/types", ko: "/ko/types" },
  "/articles": { ja: "/articles", ko: "/ko/articles" },
  "/ko/articles": { ja: "/articles", ko: "/ko/articles" },
  "/unmei": { ja: "/unmei", ko: "/ko/unmei" },
  "/ko/unmei": { ja: "/unmei", ko: "/ko/unmei" },
  "/hoshiyomi": { ja: "/hoshiyomi", ko: "/ko/hoshiyomi" },
  "/ko/hoshiyomi": { ja: "/hoshiyomi", ko: "/ko/hoshiyomi" },
};

function normalizePathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function appendSearch(path: string, currentSearch: string): string {
  if (!currentSearch || currentSearch === "?") return path;
  const search = currentSearch.startsWith("?")
    ? currentSearch
    : `?${currentSearch}`;
  const hashIndex = path.indexOf("#");
  if (hashIndex === -1) return `${path}${search}`;
  return `${path.slice(0, hashIndex)}${search}${path.slice(hashIndex)}`;
}

function resultToken(pathname: string): string | null {
  const match = pathname.match(/^\/(?:ko\/)?me\/([A-Za-z0-9_-]+)\/?$/);
  return match?.[1] ?? null;
}

function takoToken(pathname: string): string | null {
  const match = pathname.match(/^\/(?:ko\/)?tako\/([A-Za-z0-9_-]+)\/?$/);
  return match?.[1] ?? null;
}

function shareCode(pathname: string): string | null {
  const match = pathname.match(/^\/(?:ko\/)?share\/([A-Za-z0-9_-]+)\/?$/);
  return match?.[1] ?? null;
}

function previewTypeId(pathname: string): string | null {
  const match = pathname.match(/^\/(?:ko\/)?preview\/([a-z-]+__[NR])\/?$/);
  return match?.[1] ?? null;
}

function articleSlug(pathname: string): string | null {
  const match = pathname.match(/^\/(?:ko\/)?articles\/([a-z0-9-]+)\/?$/);
  return match?.[1] ?? null;
}

function dynamicRouteValue(
  pathname: string,
  route: "friend" | "evaluate/sent" | "evaluate/result",
): string | null {
  const pattern =
    route === "friend"
      ? /^\/(?:ko\/)?friend\/([A-Za-z0-9_-]+)\/?$/
      : route === "evaluate/sent"
        ? /^\/(?:ko\/)?evaluate\/sent\/([A-Za-z0-9_-]+)\/?$/
        : /^\/(?:ko\/)?evaluate\/result\/([A-Za-z0-9_-]+)\/?$/;
  return pathname.match(pattern)?.[1] ?? null;
}

function friendIndividualRoute(
  pathname: string,
): { token: string; perceptionId: string } | null {
  const match = pathname.match(
    /^\/(?:ko\/)?tako\/([A-Za-z0-9_-]+)\/friend\/([A-Za-z0-9_-]+)\/?$/,
  );
  if (!match) return null;
  return { token: match[1], perceptionId: match[2] };
}

/**
 * 診断結果は言語共通の owner token を使い、表示ルートだけを切り替える。
 * 結果ページではURL上のtokenを最優先し、トップでは端末保存済みtokenを再利用する。
 */
export function localeSwitchPath(
  pathname: string,
  targetLocale: SiteLocale,
  storedOwnerToken: string | null = null,
  currentSearch = "",
): string {
  const normalizedPathname = normalizePathname(pathname);
  const finish = (path: string) => appendSearch(path, currentSearch);
  const token = resultToken(normalizedPathname);
  if (token) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/me/${encodeURIComponent(token)}`,
    );
  }

  const friendIndividual = friendIndividualRoute(normalizedPathname);
  if (friendIndividual) {
    const tokenPath = encodeURIComponent(friendIndividual.token);
    const perceptionPath = encodeURIComponent(friendIndividual.perceptionId);
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/tako/${tokenPath}/friend/${perceptionPath}`,
    );
  }

  const friendResultToken = takoToken(normalizedPathname);
  if (friendResultToken) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/tako/${encodeURIComponent(friendResultToken)}`,
    );
  }

  const characterShareCode = shareCode(normalizedPathname);
  if (characterShareCode) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/share/${encodeURIComponent(characterShareCode)}`,
    );
  }

  const previewId = previewTypeId(normalizedPathname);
  if (previewId) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/preview/${encodeURIComponent(previewId)}`,
    );
  }

  const localizedArticleSlug = articleSlug(normalizedPathname);
  if (localizedArticleSlug) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/articles/${encodeURIComponent(localizedArticleSlug)}`,
    );
  }

  const inviteCode = dynamicRouteValue(normalizedPathname, "friend");
  if (inviteCode) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/friend/${encodeURIComponent(inviteCode)}`,
    );
  }

  const perceptionId = dynamicRouteValue(normalizedPathname, "evaluate/sent");
  if (perceptionId) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/evaluate/sent/${encodeURIComponent(perceptionId)}`,
    );
  }

  const resultPerceptionId = dynamicRouteValue(
    normalizedPathname,
    "evaluate/result",
  );
  if (resultPerceptionId) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/evaluate/result/${encodeURIComponent(resultPerceptionId)}`,
    );
  }

  const localized = LOCALIZED_PATHS[normalizedPathname];
  if (
    localized &&
    normalizedPathname !== "/" &&
    normalizedPathname !== "/ko"
  ) {
    return finish(localized[targetLocale]);
  }

  if (storedOwnerToken && /^[A-Za-z0-9_-]{8,128}$/.test(storedOwnerToken)) {
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/me/${encodeURIComponent(storedOwnerToken)}`,
    );
  }

  return finish(
    localized?.[targetLocale] ?? (targetLocale === "ko" ? "/ko" : "/"),
  );
}
