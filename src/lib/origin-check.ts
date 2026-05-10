// 状態変更系 API ルート (POST/PUT/PATCH/DELETE) で CSRF を弾く Origin チェック。
// LINE webhook (/api/webhook/line) は LINE サーバから来て Origin が無いので
// 適用しない (署名検証で代替)。

const ALLOWED_ORIGINS = new Set<string>([
  "https://www.watashi-torisetsu.com",
  "https://watashi-torisetsu.com",
  "https://liff.line.me",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;

  // Vercel preview URL (https://*-vercel.app or https://*.vercel.app)
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) {
      return true;
    }
    if (
      process.env.NODE_ENV === "development" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export type OriginCheckResult = { ok: true } | { ok: false; error: string };

export function checkOrigin(request: Request): OriginCheckResult {
  // 読み取り系は CSRF リスク無し
  if (request.method === "GET" || request.method === "HEAD") {
    return { ok: true };
  }
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return { ok: false, error: "Forbidden origin" };
  }
  return { ok: true };
}
