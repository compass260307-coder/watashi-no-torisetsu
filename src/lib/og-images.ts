import type { Locale } from "@/i18n/config";

export const KO_DEFAULT_OG_IMAGE_PATH = "/ogp-ko-v1.jpg";

/** Keep localized cards separate so existing Japanese shares retain their artwork. */
export function characterShareOgImagePath(
  characterSlug: string,
  locale: Locale,
): string {
  return locale === "ko"
    ? `/og-characters/ko/${characterSlug}.jpg?v=20260924`
    : `/og-characters/${characterSlug}.jpg?v=20260825`;
}
