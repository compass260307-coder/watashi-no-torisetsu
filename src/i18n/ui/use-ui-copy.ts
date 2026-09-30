"use client";

import type { AppResultLocale } from "@/i18n/result";
import { use } from "react";
import ja from "./messages/ja";
import type { UiCopy } from "./types";

// Japanese is available synchronously, including all payment copy. Do not
// eagerly create the other promises: that would download every language again.
const loaders = {
  en: () => import("./messages/en").then((module) => module.default),
  ko: () => import("./messages/ko").then((module) => module.default),
  id: () => import("./messages/id").then((module) => module.default),
};
const pending: Partial<Record<keyof typeof loaders, Promise<UiCopy>>> = {};

export function useUiCopy(locale: AppResultLocale): UiCopy {
  if (locale === "ja") return ja;
  const promise = pending[locale] ??= loaders[locale]();
  return use(promise);
}

export function useUiText(locale: AppResultLocale, section: string) {
  const labels = useUiCopy(locale).labels[section];
  return (key: string, values: Record<string, string | number> = {}): string =>
    Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      labels[key],
    );
}
