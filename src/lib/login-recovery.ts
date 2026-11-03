export type LoginLocale = "ja" | "en" | "ko" | "id";
export type LoginParams = Record<string, string | string[] | undefined>;

const NOTICES: Record<LoginLocale, Record<string, string>> = {
  ja: {
    unavailable: "Googleログインは現在準備中です。メールアドレスからログインしてください。",
    cancelled: "Googleログインをキャンセルしました。もう一度お試しください。",
    failed: "ログインを完了できませんでした。もう一度お試しください。",
    email_link: "このGoogleアカウントではメールでの確認が必要です。登録したメールアドレスからログインリンクを送ってください。",
    no_account: "登録したメールアドレスからログインするか、Googleログインをもう一度お試しください。",
    missing_token: "ログインリンクが不完全です。新しいリンクを送ってください。",
    invalid_or_expired: "ログインリンクの期限が切れているか、既に使用されています。新しいリンクを送ってください。",
    server_error: "ログインを完了できませんでした。少し時間をおいてもう一度お試しください。",
  },
  en: { retry: "Sign-in could not be completed. Please try again or request a new email link." },
  ko: { retry: "로그인을 완료하지 못했어요. 다시 시도하거나 새 로그인 링크를 받아 주세요." },
  id: { retry: "Proses masuk belum selesai. Coba lagi atau minta tautan masuk baru melalui email." },
};

export function loginNotice(locale: LoginLocale, reason: string | null) {
  if (!reason || !Object.hasOwn(NOTICES.ja, reason)) return undefined;
  return locale === "ja" ? NOTICES.ja[reason] : NOTICES[locale].retry;
}

export function loginRecoveryPath(locale: LoginLocale, destination: string, params: LoginParams) {
  const url = new URL(destination, "https://local.invalid");
  url.searchParams.set("login", "1");
  const reason = typeof params.google_error === "string" ? params.google_error
    : typeof params.login_error === "string" ? params.login_error : null;
  if (loginNotice(locale, reason)) url.searchParams.set("login_error", reason!);
  return url.pathname + url.search;
}
