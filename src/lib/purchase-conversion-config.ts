import "server-only";

export type PurchaseProvider = "meta" | "tiktok";

// Keep durable jobs for the site's three pixels even before tokens are entered.
export const SITE_TIKTOK_PIXEL_CODES = [
  "D9V8IIBC77UFF28NGHK0",
  "DAUFBCRC77U5PB60GLP0",
  "DAV7P7RC77UA36CC79E0",
] as const;

const PIXEL_CODE = /^[A-Z0-9]{20}$/;
const DAY_MS = 86_400_000;
export const PURCHASE_EVENT_MAX_AGE_MS: Record<PurchaseProvider, number> = {
  meta: 7 * DAY_MS,
  // Conservative replay policy: TikTok's current web reference does not
  // explicitly state an upload age limit. Do not confuse CTA with upload age.
  tiktok: 7 * DAY_MS,
};

export function purchaseEventExpiryReason(
  provider: PurchaseProvider,
  paidAt: string,
  now = Date.now(),
): string | null {
  const timestamp = Date.parse(paidAt);
  if (!Number.isFinite(timestamp))
    return "invalid_paid_at: event time is invalid";
  if (timestamp > now) return "invalid_paid_at: event time is in the future";
  if (timestamp <= now - PURCHASE_EVENT_MAX_AGE_MS[provider]) {
    return provider === "meta"
      ? "event_expired: Meta web event exceeds the 7-day upload window"
      : "event_expired: TikTok web event exceeds the local 7-day replay policy";
  }
  return null;
}

type Pixel = { pixelCode: string; accessToken: string };
type TikTokSettings = {
  pixelCodes: string[];
  pixels: Map<string, Pixel>;
  errors: Map<string, string>;
  error: string | null;
};

export function readTikTokSettings(
  env: NodeJS.ProcessEnv = process.env,
): TikTokSettings {
  const pixelCodes = new Set<string>(SITE_TIKTOK_PIXEL_CODES);
  const pixels = new Map<string, Pixel>();
  const errors = new Map<string, string>();
  const result = (error: string | null = null): TikTokSettings => ({
    pixelCodes: [...pixelCodes],
    pixels,
    errors,
    error,
  });

  const raw = env.TIKTOK_PIXELS?.trim();
  if (raw) {
    let entries: unknown;
    try {
      entries = JSON.parse(raw);
    } catch {
      // Never include JSON.parse's message: it can quote the access token.
      return result("TIKTOK_PIXELS must be a JSON array");
    }
    if (
      !Array.isArray(entries) ||
      entries.length === 0 ||
      entries.length > 20
    ) {
      return result("TIKTOK_PIXELS must contain 1 to 20 pixel objects");
    }
    const seen = new Set<string>();
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.pixelCode !== "string" ||
        !PIXEL_CODE.test(entry.pixelCode.trim())
      ) {
        // Valid entries still deliver independently of an invalid sibling.
        continue;
      }
      const pixelCode = entry.pixelCode.trim();
      pixelCodes.add(pixelCode);
      if (seen.has(pixelCode)) {
        pixels.delete(pixelCode);
        errors.set(pixelCode, "TIKTOK_PIXELS contains a duplicate pixelCode");
        continue;
      }
      seen.add(pixelCode);
      if (
        typeof entry.accessToken !== "string" ||
        !entry.accessToken.trim() ||
        /\s/.test(entry.accessToken.trim())
      ) {
        errors.set(
          pixelCode,
          "TikTok accessToken is missing or invalid for this pixel",
        );
        continue;
      }
      pixels.set(pixelCode, {
        pixelCode,
        accessToken: entry.accessToken.trim(),
      });
    }
    return result();
  }

  // Existing single-pixel configuration remains a fallback only when JSON is absent.
  const pixelCode = env.TIKTOK_PIXEL_CODE?.trim();
  const accessToken = env.TIKTOK_EVENTS_API_TOKEN?.trim();
  if (pixelCode && PIXEL_CODE.test(pixelCode)) {
    pixelCodes.add(pixelCode);
    if (accessToken && !/\s/.test(accessToken))
      pixels.set(pixelCode, { pixelCode, accessToken });
  }
  return result();
}

export function tikTokConfigForPixel(pixelCode: string): Pixel {
  const settings = readTikTokSettings();
  const error = settings.error ?? settings.errors.get(pixelCode);
  if (error) throw new Error(`[purchase-conversion] ${error}`);
  const pixel = settings.pixels.get(pixelCode);
  if (!pixel) {
    throw new Error(
      "[purchase-conversion] TikTok server tracking configuration is incomplete for this pixel",
    );
  }
  return pixel;
}
