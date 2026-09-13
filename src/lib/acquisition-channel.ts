// 日報の「自然流入」は明示された非広告medium。媒体・campaign・referrerでは推定しない。
const PAID_MEDIA = new Set([
  "paid_social", "paid_search", "paid_video", "paid_display", "paid",
  "cpc", "ppc", "cpm", "cpv", "cpa", "display", "retargeting", "remarketing",
]);
const ORGANIC_MEDIA = new Set([
  "organic", "organic_search", "organic_social", "organic_video", "organic_referral",
]);

export type AcquisitionChannel = "広告" | "自然流入" | "不明";

export function classifyAcquisitionMedium(medium: string | null | undefined): AcquisitionChannel {
  const normalized = medium?.trim().toLowerCase() ?? "";
  if (PAID_MEDIA.has(normalized)) return "広告";
  if (ORGANIC_MEDIA.has(normalized)) return "自然流入";
  return "不明";
}
