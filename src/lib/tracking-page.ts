/**
 * 計測用のページ名をURLの先頭ロケールに左右されない形へ正規化する。
 * 例: /me/abc と /ko/me/abc はどちらも "me"。
 */
export function trackingPageFromPathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const pageIndex = segments[0] === "ko" ? 1 : 0;
  return segments[pageIndex] ?? "top";
}
