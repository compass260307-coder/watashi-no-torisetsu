// X (旧 Twitter) の OAuth 1.0a の署名。鍵を受け取って Authorization ヘッダーを作るだけ。
import { createHmac, randomBytes } from "node:crypto";

export interface XAdsCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

/** RFC 3986 の形でエンコードする (OAuth 1.0a の署名はこの形が前提)。 */
function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** OAuth 1.0a の Authorization ヘッダーを作る (テスト用に時刻と nonce を渡せる)。 */
export function oauthHeader(
  url: string,
  query: Record<string, string>,
  credentials: XAdsCredentials,
  nonce = randomBytes(16).toString("hex"),
  timestamp = Math.floor(Date.now() / 1000).toString(),
  method = "GET",
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };
  const parameters = Object.entries({ ...query, ...oauth })
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const base = [method, encode(url), encode(parameters)].join("&");
  const key = `${encode(credentials.consumerSecret)}&${encode(credentials.accessTokenSecret)}`;
  const signature = createHmac("sha1", key).update(base).digest("base64");
  return (
    "OAuth " +
    Object.entries({ ...oauth, oauth_signature: signature })
      .map(([k, v]) => `${encode(k)}="${encode(v)}"`)
      .join(", ")
  );
}
