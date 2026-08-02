import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { resolveSiteUrl } from "@/lib/site-url";
import { ConfirmSwitchView } from "./ConfirmSwitchView";

type LoginConfirmLocale = "ja" | "ko";

export type LoginConfirmSearchParams = {
  [key: string]: string | string[] | undefined;
};

// 宛先メールをマスク表示 (どのアカウントか本人が識別できる程度に)。
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "****";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

export async function LoginConfirmPageContent({
  searchParams,
  localeOverride,
}: {
  searchParams: Promise<LoginConfirmSearchParams>;
  localeOverride?: LoginConfirmLocale;
}) {
  const sp = await searchParams;
  const locale: LoginConfirmLocale =
    localeOverride ?? (sp.locale === "ko" ? "ko" : "ja");
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token) notFound();

  // リンク先アカウント B (token -> magic_links -> email)。未消費のまま参照のみ。
  const nowIso = new Date().toISOString();
  const { data: link } = await supabaseAdmin
    .from("magic_links")
    .select("user_id, email, expires_at, used_at")
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (!link) {
    return <ExpiredNotice locale={locale} />;
  }

  const bUserId = link.user_id as string;
  const bEmail = ((link.email as string | null) ?? "").trim();

  // 現デバイスのアカウント A。
  const current = await getSession();
  const aOwnerToken = current?.owner_token ?? null;
  const aName =
    (current?.display_name ?? "").trim() ||
    (locale === "ko" ? "회원" : "あなた");
  const localePrefix = locale === "ko" ? "/ko" : "";
  const recoveryUrl = aOwnerToken
    ? `${resolveSiteUrl()}${localePrefix}/me/${aOwnerToken}`
    : null;

  const continueHref = `/api/auth/verify-magic-link?token=${encodeURIComponent(
    token,
  )}&confirm=1${locale === "ko" ? "&locale=ko" : ""}`;
  // キャンセルは「いまのデータのまま」= A の /me に戻す (無ければトップ)。
  const cancelHref = aOwnerToken
    ? `${localePrefix}/me/${aOwnerToken}`
    : localePrefix || "/";
  // A が無い / A.id === B の場合は本来ここに来ない (verify 側で素通し) が、
  // 直リンク等で来たら切替警告は不要なので、そのまま続行導線だけ見せる。
  const isConflict = !!current && current.id !== bUserId;

  return (
    <ConfirmSwitchView
      aName={aName}
      maskedEmail={maskEmail(bEmail)}
      recoveryUrl={recoveryUrl}
      continueHref={continueHref}
      cancelHref={cancelHref}
      isConflict={isConflict}
      locale={locale}
    />
  );
}

function ExpiredNotice({ locale }: { locale: LoginConfirmLocale }) {
  const ko = locale === "ko";
  return (
    <main className="min-h-dvh bg-white px-4 py-12">
      <div className="mx-auto max-w-[420px] text-center">
        <h1 className="text-[#2E2E5C] font-black text-2xl leading-tight mb-3">
          {ko ? "링크가 만료되었어요" : "リンクが失効しました"}
        </h1>
        <p className="text-[#2E2E5C]/75 font-bold text-sm leading-relaxed mb-8">
          {ko ? (
            <>
              로그인 링크가 만료되었거나 이미 사용되었어요.
              <br />
              새 링크를 다시 받아 주세요.
            </>
          ) : (
            <>
              ログインリンクは1時間で失効、または既に使用されています。
              <br />
              もう一度お試しください。
            </>
          )}
        </p>
        <Link
          href={ko ? "/ko/login" : "/login"}
          className="inline-flex items-center justify-center rounded-full bg-[#2E2E5C] px-8 py-3.5 text-base font-black text-white shadow-[0_4px_0_#1b1b3e] hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-none transition-all"
        >
          {ko ? "로그인 링크 다시 받기" : "ログインをやり直す"}
        </Link>
      </div>
    </main>
  );
}
