import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export const GOOGLE_FLOW_COOKIE = "torisetsu_google_login";
export const GOOGLE_FLOW_SECONDS = 600;
const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

// Keep the callback on the incoming host, matching the session completion route.
export function googleRequestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  return url.origin;
}

export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function newGoogleFlow() {
  return {
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    expires: Date.now() + GOOGLE_FLOW_SECONDS * 1000,
  };
}

export function readGoogleFlow(cookie: string | undefined, state: string | null) {
  try {
    const flow = JSON.parse(cookie ?? "");
    if (typeof flow.state !== "string" || typeof flow.nonce !== "string" ||
        typeof flow.verifier !== "string" || typeof flow.expires !== "number" ||
        flow.expires <= Date.now() || !state) return null;
    const expected = Buffer.from(flow.state);
    const actual = Buffer.from(state);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    return flow as ReturnType<typeof newGoogleFlow>;
  } catch {
    return null;
  }
}

export function googleAuthorizationUrl(clientId: string, redirectUri: string, flow: ReturnType<typeof newGoogleFlow>) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url;
}

// Email matching is only safe when Google is authoritative for that address.
// Third-party addresses must continue through the existing email-link flow.
export function googleVerifiedEmail(payload: JWTPayload, nonce: string): string | null {
  if (payload.nonce !== nonce || !payload.sub || payload.email_verified !== true ||
      typeof payload.email !== "string") return null;
  const email = payload.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
  return email.endsWith("@gmail.com") || (typeof payload.hd === "string" && payload.hd.length > 0)
    ? email : null;
}

export async function verifyGoogleIdentity(idToken: string, clientId: string, nonce: string) {
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "nonce"],
  });
  return googleVerifiedEmail(payload, nonce);
}
