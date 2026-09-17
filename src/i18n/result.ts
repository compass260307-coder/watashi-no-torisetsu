export type ResultLocale = "ja" | "ko";
export type AppResultLocale = ResultLocale | "en" | "id";

export function isKoreanResult(locale: ResultLocale): boolean {
  return locale === "ko";
}
