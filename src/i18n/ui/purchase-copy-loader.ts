import type { UiCopy } from "./types";

const loaders = {
  en: () => import("./messages/en").then(module => module.default),
  ko: () => import("./messages/ko").then(module => module.default),
  id: () => import("./messages/id").then(module => module.default),
};
const pending: Partial<Record<keyof typeof loaders, Promise<UiCopy>>> = {};

export function preloadLocalizedPurchaseCopy(locale: keyof typeof loaders): Promise<UiCopy> {
  return pending[locale] ??= loaders[locale]();
}
