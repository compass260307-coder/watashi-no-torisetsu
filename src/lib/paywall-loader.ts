import type { AppResultLocale } from "@/i18n/result";

type PaywallModule = typeof import("@/components/result/PaywallModal");
let pending: Promise<PaywallModule> | undefined;

// Called only after purchase intent or while a completed diagnosis is generating.
// A failed speculative download can be retried by the actual dialog.
export function preloadPaywall(locale: AppResultLocale = "ja"): Promise<PaywallModule> {
  pending ??= import("@/components/result/PaywallModal").then(module => {
    return module;
  }).catch(error => {
    pending = undefined;
    throw error;
  });
  return Promise.all([
    pending,
    import("@/i18n/ui/use-ui-copy").then(module => module.preloadUiCopy(locale)),
  ]).then(([module]) => module);
}
