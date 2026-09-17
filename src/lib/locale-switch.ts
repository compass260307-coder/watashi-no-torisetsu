export type SiteLocale = "ja" | "ko";
export type SwitchLocale = SiteLocale | "en";

const LOCALIZED_PATHS: Record<string, Partial<Record<SwitchLocale, string>>> = {
  "/": { ja: "/", ko: "/ko", en: "/en" },
  "/ko": { ja: "/", ko: "/ko", en: "/en" },
  "/en": { ja: "/", ko: "/ko", en: "/en" },
  "/about": { ja: "/about", ko: "/ko/about", en: "/en/about" },
  "/ko/about": { ja: "/about", ko: "/ko/about", en: "/en/about" },
  "/en/about": { ja: "/about", ko: "/ko/about", en: "/en/about" },
  "/diagnosis": { ja: "/diagnosis", ko: "/ko/diagnosis", en: "/en/diagnosis" },
  "/ko/diagnosis": {
    ja: "/diagnosis",
    ko: "/ko/diagnosis",
    en: "/en/diagnosis",
  },
  "/en/diagnosis": {
    ja: "/diagnosis",
    ko: "/ko/diagnosis",
    en: "/en/diagnosis",
  },
  "/terms": { ja: "/terms", ko: "/ko/terms", en: "/en/terms" },
  "/ko/terms": { ja: "/terms", ko: "/ko/terms", en: "/en/terms" },
  "/en/terms": { ja: "/terms", ko: "/ko/terms", en: "/en/terms" },
  "/privacy": { ja: "/privacy", ko: "/ko/privacy", en: "/en/privacy" },
  "/ko/privacy": { ja: "/privacy", ko: "/ko/privacy", en: "/en/privacy" },
  "/en/privacy": { ja: "/privacy", ko: "/ko/privacy", en: "/en/privacy" },
  "/legal/commerce": { ja: "/legal/commerce", ko: "/ko/legal/commerce", en: "/en/legal/commerce" },
  "/ko/legal/commerce": { ja: "/legal/commerce", ko: "/ko/legal/commerce", en: "/en/legal/commerce" },
  "/en/legal/commerce": { ja: "/legal/commerce", ko: "/ko/legal/commerce", en: "/en/legal/commerce" },
  "/login": { ja: "/login", ko: "/ko/login", en: "/en/login" },
  "/ko/login": { ja: "/login", ko: "/ko/login", en: "/en/login" },
  "/en/login": { ja: "/login", ko: "/ko/login", en: "/en/login" },
  "/login/confirm": {
    ja: "/login/confirm",
    ko: "/ko/login/confirm",
    en: "/en/login/confirm",
  },
  "/ko/login/confirm": {
    ja: "/login/confirm",
    ko: "/ko/login/confirm",
    en: "/en/login/confirm",
  },
  "/en/login/confirm": {
    ja: "/login/confirm",
    ko: "/ko/login/confirm",
    en: "/en/login/confirm",
  },
  "/auth/error": {
    ja: "/auth/error",
    ko: "/ko/auth/error",
    en: "/en/auth/error",
  },
  "/ko/auth/error": {
    ja: "/auth/error",
    ko: "/ko/auth/error",
    en: "/en/auth/error",
  },
  "/en/auth/error": {
    ja: "/auth/error",
    ko: "/ko/auth/error",
    en: "/en/auth/error",
  },
  "/result": { ja: "/result", ko: "/ko/result", en: "/en/result" },
  "/ko/result": { ja: "/result", ko: "/ko/result", en: "/en/result" },
  "/en/result": { ja: "/result", ko: "/ko/result", en: "/en/result" },
  "/purchase-complete": {
    ja: "/purchase-complete",
    ko: "/ko/purchase-complete",
    en: "/en/purchase-complete",
  },
  "/ko/purchase-complete": {
    ja: "/purchase-complete",
    ko: "/ko/purchase-complete",
    en: "/en/purchase-complete",
  },
  "/en/purchase-complete": {
    ja: "/purchase-complete",
    ko: "/ko/purchase-complete",
    en: "/en/purchase-complete",
  },
  "/tako": { ja: "/tako", ko: "/ko/tako", en: "/en/tako" },
  "/ko/friend": { ja: "/tako", ko: "/ko/tako", en: "/en/tako" },
  "/en/friend": { ja: "/tako", ko: "/ko/tako", en: "/en/tako" },
  "/ko/tako": { ja: "/tako", ko: "/ko/tako", en: "/en/tako" },
  "/en/tako": { ja: "/tako", ko: "/ko/tako", en: "/en/tako" },
  "/aisho": { ja: "/aisho", ko: "/ko/aisho", en: "/en/aisho" },
  "/ko/aisho": { ja: "/aisho", ko: "/ko/aisho", en: "/en/aisho" },
  "/en/aisho": { ja: "/aisho", ko: "/ko/aisho", en: "/en/aisho" },
  "/types": { ja: "/types", ko: "/ko/types", en: "/en/types" },
  "/ko/types": { ja: "/types", ko: "/ko/types", en: "/en/types" },
  "/en/types": { ja: "/types", ko: "/ko/types", en: "/en/types" },
  "/articles": { ja: "/articles", ko: "/ko/articles", en: "/en/articles" },
  "/ko/articles": { ja: "/articles", ko: "/ko/articles", en: "/en/articles" },
  "/en/articles": { ja: "/articles", ko: "/ko/articles", en: "/en/articles" },
  "/unmei": { ja: "/unmei", ko: "/ko/unmei", en: "/en/unmei" },
  "/ko/unmei": { ja: "/unmei", ko: "/ko/unmei", en: "/en/unmei" },
  "/en/unmei": { ja: "/unmei", ko: "/ko/unmei", en: "/en/unmei" },
  "/hoshiyomi": { ja: "/hoshiyomi", ko: "/ko/hoshiyomi", en: "/en/hoshiyomi" },
  "/ko/hoshiyomi": { ja: "/hoshiyomi", ko: "/ko/hoshiyomi", en: "/en/hoshiyomi" },
  "/en/hoshiyomi": { ja: "/hoshiyomi", ko: "/ko/hoshiyomi", en: "/en/hoshiyomi" },
  "/tarot": { ja: "/tarot", ko: "/ko/tarot", en: "/en/tarot" },
  "/ko/tarot": { ja: "/tarot", ko: "/ko/tarot", en: "/en/tarot" },
  "/en/tarot": { ja: "/tarot", ko: "/ko/tarot", en: "/en/tarot" },
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

function localePrefix(locale: SwitchLocale): string {
  return locale === "ja" ? "" : `/${locale}`;
}

function resultToken(pathname: string): string | null {
  const match = pathname.match(/^\/(?:(?:ko|en)\/)?me\/([A-Za-z0-9_-]+)\/?$/);
  return match?.[1] ?? null;
}

function takoToken(pathname: string): string | null {
  const match = pathname.match(/^\/(?:(?:ko|en)\/)?tako\/([A-Za-z0-9_-]+)\/?$/);
  return match?.[1] ?? null;
}

function shareCode(pathname: string): string | null {
  const match = pathname.match(
    /^\/(?:(?:ko|en)\/)?share\/([A-Za-z0-9_-]+)\/?$/,
  );
  return match?.[1] ?? null;
}

function previewTypeId(pathname: string): string | null {
  const match = pathname.match(
    /^\/(?:(?:ko|en)\/)?preview\/([a-z-]+__[NR])\/?$/,
  );
  return match?.[1] ?? null;
}

function articleSlug(pathname: string): string | null {
  const match = pathname.match(/^\/(?:(?:ko|en)\/)?articles\/([a-z0-9-]+)\/?$/);
  return match?.[1] ?? null;
}

function tarotMode(pathname: string): string | null {
  const match = pathname.match(/^\/(?:(?:ko|en)\/)?tarot\/(one|three|yes-no)\/?$/);
  return match?.[1] ?? null;
}

function dynamicRouteValue(
  pathname: string,
  route: "friend" | "evaluate/sent" | "evaluate/result",
): string | null {
  const pattern =
    route === "friend"
      ? /^\/(?:(?:ko|en)\/)?friend\/([A-Za-z0-9_-]+)\/?$/
      : route === "evaluate/sent"
        ? /^\/(?:(?:ko|en)\/)?evaluate\/sent\/([A-Za-z0-9_-]+)\/?$/
        : /^\/(?:(?:ko|en)\/)?evaluate\/result\/([A-Za-z0-9_-]+)\/?$/;
  return pathname.match(pattern)?.[1] ?? null;
}

function friendIndividualRoute(
  pathname: string,
): { token: string; perceptionId: string } | null {
  const match = pathname.match(
    /^\/(?:(?:ko|en)\/)?tako\/([A-Za-z0-9_-]+)\/friend\/([A-Za-z0-9_-]+)\/?$/,
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
  targetLocale: SwitchLocale,
  storedOwnerToken: string | null = null,
  currentSearch = "",
): string {
  const normalizedPathname = normalizePathname(pathname);
  const finish = (path: string) => appendSearch(path, currentSearch);
  const token = resultToken(normalizedPathname);
  if (token) {
    return finish(
      `${localePrefix(targetLocale)}/me/${encodeURIComponent(token)}`,
    );
  }

  const friendIndividual = friendIndividualRoute(normalizedPathname);
  if (friendIndividual) {
    const tokenPath = encodeURIComponent(friendIndividual.token);
    const perceptionPath = encodeURIComponent(friendIndividual.perceptionId);
    if (targetLocale === "en") {
      return finish(`/en/tako/${tokenPath}/friend/${perceptionPath}`);
    }
    return finish(
      `${targetLocale === "ko" ? "/ko" : ""}/tako/${tokenPath}/friend/${perceptionPath}`,
    );
  }

  const friendResultToken = takoToken(normalizedPathname);
  if (friendResultToken) {
    return finish(
      `${localePrefix(targetLocale)}/tako/${encodeURIComponent(friendResultToken)}`,
    );
  }

  const characterShareCode = shareCode(normalizedPathname);
  if (characterShareCode) {
    return finish(
      `${localePrefix(targetLocale)}/share/${encodeURIComponent(characterShareCode)}`,
    );
  }

  const previewId = previewTypeId(normalizedPathname);
  if (previewId) {
    return finish(
      `${localePrefix(targetLocale)}/preview/${encodeURIComponent(previewId)}`,
    );
  }

  const localizedArticleSlug = articleSlug(normalizedPathname);
  if (localizedArticleSlug) {
    return finish(
      `${localePrefix(targetLocale)}/articles/${encodeURIComponent(localizedArticleSlug)}`,
    );
  }

  const localizedTarotMode = tarotMode(normalizedPathname);
  if (localizedTarotMode) {
    return finish(`${localePrefix(targetLocale)}/tarot/${localizedTarotMode}`);
  }

  const inviteCode = dynamicRouteValue(normalizedPathname, "friend");
  if (inviteCode) {
    return finish(
      `${localePrefix(targetLocale)}/friend/${encodeURIComponent(inviteCode)}`,
    );
  }

  const perceptionId = dynamicRouteValue(normalizedPathname, "evaluate/sent");
  if (perceptionId) {
    return finish(
      `${localePrefix(targetLocale)}/evaluate/sent/${encodeURIComponent(perceptionId)}`,
    );
  }

  const resultPerceptionId = dynamicRouteValue(
    normalizedPathname,
    "evaluate/result",
  );
  if (resultPerceptionId) {
    return finish(
      `${localePrefix(targetLocale)}/evaluate/result/${encodeURIComponent(resultPerceptionId)}`,
    );
  }

  const localized = LOCALIZED_PATHS[normalizedPathname];
  if (
    localized &&
    normalizedPathname !== "/" &&
    normalizedPathname !== "/ko" &&
    normalizedPathname !== "/en"
  ) {
    return finish(
      localized[targetLocale] ??
        (targetLocale === "en" ? "/en" : (localized[targetLocale] ?? "/")),
    );
  }

  if (storedOwnerToken && /^[A-Za-z0-9_-]{8,128}$/.test(storedOwnerToken)) {
    return finish(
      `${localePrefix(targetLocale)}/me/${encodeURIComponent(storedOwnerToken)}`,
    );
  }

  return finish(
    localized?.[targetLocale] ?? (localePrefix(targetLocale) || "/"),
  );
}
