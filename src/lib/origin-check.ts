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

  // 環境ごとに運営側が明示した正規URLも許可する。Previewの固定 alias など、
  // VERCEL_URL / VERCEL_BRANCH_URL には入らないプロジェクト所有ホストを対象にする。
  // 値は完全一致で比較し、任意の *.vercel.app は許可しない。
  try {
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (configuredSiteUrl && new URL(configuredSiteUrl).origin === origin) {
      return true;
    }
  } catch {
    // 不正な環境変数は許可せず、既存のVercelホスト判定へ進む。
  }

  // 現在のVercelデプロイに割り当てられたホストだけを許可する。
  // 任意の *.vercel.app を許可すると、攻撃者自身のVercelサイトも通ってしまう。
  try {
    const url = new URL(origin);
    if (url.protocol === "https:") {
      const vercelHosts = [
        process.env.VERCEL_URL,
        process.env.VERCEL_BRANCH_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
      ].filter((host): host is string => Boolean(host));
      if (vercelHosts.includes(url.hostname)) return true;
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
