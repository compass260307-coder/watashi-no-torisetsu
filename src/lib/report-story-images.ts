const REPORT_CHARACTER_SLUGS = [
  "angel_N",
  "bear_R",
  "cheetah_N",
  "clownfish_N",
  "crow_N",
  "dog_R",
  "dolphin_R",
  "dragon_R",
  "eagle_R",
  "elephant_N",
  "fox_N",
  "ghost_N",
  "golem_R",
  "hawk_R",
  "jellyfish_N",
  "octopus_N",
  "orca_R",
  "parakeet_N",
  "pegasus_N",
  "pelican_R",
  "penguin_N",
  "phoenix_R",
  "rabbit_N",
  "seal_R",
  "shark_R",
  "skeleton_R",
  "squirrel_R",
  "swallow_N",
  "swan_R",
  "swordfish_N",
  "tiger_R",
  "unicorn_N",
] as const;

const REPORT_CHARACTER_SLUG_SET = new Set<string>(REPORT_CHARACTER_SLUGS);

// 課金カードの「チラ見」画像の言語。日本語は配布している小説PDFの表紙・本文、
// 韓国語は韓国語PDF (/report/[token]/print?locale=ko と /tako-report/…) の表紙・本文1ページ目を
// キャラ別に書き出したもの (public/paywall-peek/ko-*-{slug}-2026.webp、560×793)。
type PeekLocale = "ja" | "ko";
const peekPrefix = (locale?: PeekLocale) => (locale === "ko" ? "ko-" : "");

function characterSlugFromImageSrc(imageSrc?: string | null): string | null {
  if (!imageSrc) return null;

  const pathWithoutSuffix = imageSrc.split(/[?#]/, 1)[0];
  const filename = pathWithoutSuffix.split("/").at(-1) ?? "";
  const slug = filename.replace(/\.(?:avif|jpe?g|png|webp)$/i, "");

  return REPORT_CHARACTER_SLUG_SET.has(slug) ? slug : null;
}

/** 自己診断PDFのキャラ別・全面表紙画像。 */
export function selfReportStoryImagePath(
  characterImageSrc?: string | null,
): string | null {
  const slug = characterSlugFromImageSrc(characterImageSrc);
  if (!slug) return null;

  return slug === "jellyfish_N"
    ? "/report/story/jellyfish_N-integrated.webp"
    : `/report/story/${slug}-self-story.webp`;
}

/** 課金カードの「チラ見」で使う、タイトル合成済みの自己診断表紙。 */
export function selfReportPeekImagePath(
  characterImageSrc?: string | null,
  locale?: PeekLocale,
): string | null {
  const slug = characterSlugFromImageSrc(characterImageSrc);
  return slug ? `/paywall-peek/${peekPrefix(locale)}self-cover-${slug}-2026.webp` : null;
}

/** 課金カードの「チラ見」で使う、実配布小説PDFのタイプ別本文ページ。 */
export function selfReportStoryPreviewPagePath(
  characterImageSrc?: string | null,
  locale?: PeekLocale,
): string | null {
  const slug = characterSlugFromImageSrc(characterImageSrc);
  return slug
    ? `/paywall-peek/${peekPrefix(locale)}self-story-page-${slug}-2026.webp`
    : null;
}

/** 友達診断PDFのキャラ別・全面表紙画像。 */
export function friendReportStoryImagePath(
  characterImageSrc?: string | null,
): string | null {
  const slug = characterSlugFromImageSrc(characterImageSrc);
  if (!slug) return null;

  return slug === "jellyfish_N"
    ? "/report/story/jellyfish_N-friends-sky-v2.webp"
    : `/report/story/${slug}-friends-story.webp`;
}

/** 課金カードの「チラ見」で使う、タイトル合成済みのキャラ別表紙。 */
export function friendReportPeekImagePath(
  characterImageSrc?: string | null,
  locale?: PeekLocale,
): string | null {
  const slug = characterSlugFromImageSrc(characterImageSrc);
  return slug ? `/paywall-peek/${peekPrefix(locale)}friends-cover-${slug}-2026.webp` : null;
}
