export type ResultLocale = "ja" | "ko";

export function isKoreanResult(locale: ResultLocale): boolean {
  return locale === "ko";
}
