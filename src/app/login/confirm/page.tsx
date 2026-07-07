// マジックリンク・ログイン確認 (v1 衝突検知インタースティシャル) の container。
//
// verify-magic-link が「現デバイスに別アカウント A の Cookie があり、リンク先 B と
// 別 user_id」を検知したとき、サイレント切替を避けてここへ誘導する。
// この時点で token は未消費。「続ける」で ?confirm=1 付き verify に戻り、初めて消費+rotate。
//
// 目的は事故防止: いま見ているデータ (A) に後から戻れる復帰URL (/me/[A-owner_token]) を
// 必ず目立つ形で提示し、ユーザーが保存できるようにする (表示は ConfirmSwitchView)。

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { resolveSiteUrl } from "@/lib/site-url";
import { ConfirmSwitchView } from "./ConfirmSwitchView";

export const metadata: Metadata = {
  title: "ログインの確認",
  robots: { index: false, follow: false },
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

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LoginConfirmPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token) notFound();

  // リンク先アカウント B (token → magic_links → email)。未消費のまま参照のみ。
  const nowIso = new Date().toISOString();
  const { data: link } = await supabaseAdmin
    .from("magic_links")
    .select("user_id, email, expires_at, used_at")
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (!link) {
    return <ExpiredNotice />;
  }

  const bUserId = link.user_id as string;
  const bEmail = ((link.email as string | null) ?? "").trim();

  // 現デバイスのアカウント A。
  const current = await getSession();
  const aOwnerToken = current?.owner_token ?? null;
  const aName = (current?.display_name ?? "").trim() || "あなた";
  const recoveryUrl = aOwnerToken
    ? `${resolveSiteUrl()}/me/${aOwnerToken}`
    : null;

  const continueHref = `/api/auth/verify-magic-link?token=${encodeURIComponent(
    token,
  )}&confirm=1`;
  // キャンセルは「いまのデータのまま」= A の /me に戻す (無ければトップ)。
  const cancelHref = aOwnerToken ? `/me/${aOwnerToken}` : "/";
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
    />
  );
}

function ExpiredNotice() {
  return (
    <main className="min-h-dvh bg-white px-4 py-12">
      <div className="mx-auto max-w-[420px] text-center">
        <h1 className="text-[#2E2E5C] font-black text-2xl leading-tight mb-3">
          リンクが失効しました
        </h1>
        <p className="text-[#2E2E5C]/75 font-bold text-sm leading-relaxed mb-8">
          ログインリンクは1時間で失効、または既に使用されています。
          <br />
          もう一度お試しください。
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-full bg-[#2E2E5C] px-8 py-3.5 text-base font-black text-white shadow-[0_4px_0_#1b1b3e] hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-none transition-all"
        >
          ログインをやり直す
        </Link>
      </div>
    </main>
  );
}
