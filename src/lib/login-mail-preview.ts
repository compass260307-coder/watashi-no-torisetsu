import { newLoginCode } from "./login-code";

type PreviewMail = {
  id: string; email: string; code: string | null; kind: "login" | "welcome";
  token: string; createdAt: number; expiresAt: number; attempts: number; used: boolean;
};
const state = globalThis as typeof globalThis & { loginMailPreview?: Map<string, PreviewMail> };
const inbox = state.loginMailPreview ??= new Map<string, PreviewMail>();
export function isLoginMailPreview(request: Request) {
  const host = new URL(request.url).hostname;
  const incoming = request.headers.get("host")?.split(":")[0];
  return process.env.NODE_ENV === "development" && process.env.LOGIN_MAIL_MODE !== "live"
    && ["localhost", "127.0.0.1"].includes(incoming ?? host);
}
export function previewMails() {
  if (process.env.NODE_ENV !== "development") return [];
  return [...inbox.values()].map(({ id, email, code, kind, createdAt }) => ({ id, email, code, kind, createdAt })).reverse().slice(0, 20);
}
export function issuePreviewMail(email: string) {
  const now = Date.now();
  const old = [...inbox.values()].find(m => m.email === email && now - m.createdAt < 60000);
  if (old) return null;
  for (const [id, mail] of inbox) {
    if (mail.expiresAt <= now) inbox.delete(id);
    else if (mail.email === email) mail.used = true;
  }
  const { challenge, code } = newLoginCode();
  // Reserved .test addresses are demos only, never real accounts.
  const kind = email === "new@example.test" ? "welcome" : "login";
  const mail: PreviewMail = { id: challenge, email, code: kind === "login" ? code : null,
    kind, token: newLoginCode().challenge, createdAt: now, expiresAt: now + 600000, attempts: 0, used: false };
  inbox.set(challenge, mail);
  return mail;
}
export function verifyPreviewCode(challenge: string, code: string) {
  const mail = inbox.get(challenge);
  if (!mail || mail.used || mail.expiresAt <= Date.now() || mail.attempts >= 5) return null;
  mail.attempts++;
  if (mail.code !== code) return null;
  mail.used = true;
  return mail;
}
export function consumePreviewLink(token: string) {
  const mail = [...inbox.values()].find(m => m.token === token && m.kind === "login");
  if (!mail || mail.used || mail.expiresAt <= Date.now()) return false;
  mail.used = true;
  return true;
}
export function getPreviewMail(id: string) { return inbox.get(id); }
export const PREVIEW_RESULT = "/me/preview?previewType=sparkle-dolphin__N&previewProduct=full_access";
