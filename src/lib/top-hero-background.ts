import type { CSSProperties } from "react";
import desktopBackground from "../../public/characters/keyvisual.webp";
import mobileBackground from "../../public/characters/keyvisual-mobile.webp";

// Static imports produce content-hashed URLs with Next.js's immutable cache
// headers. Replacing an image changes its URL without a manual version bump.
// Share these URLs between preload and CSS so each viewport downloads one image.
export const TOP_HERO_BACKGROUNDS = {
  desktop: desktopBackground.src,
  mobile: mobileBackground.src,
};

export const TOP_HERO_BACKGROUND_STYLE: CSSProperties &
  Record<"--top-hero-desktop" | "--top-hero-mobile", string> = {
  "--top-hero-desktop": `url("${TOP_HERO_BACKGROUNDS.desktop}")`,
  "--top-hero-mobile": `url("${TOP_HERO_BACKGROUNDS.mobile}")`,
};
