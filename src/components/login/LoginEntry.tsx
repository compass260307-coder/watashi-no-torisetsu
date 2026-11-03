import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isUndiagnosedPlaceholderUser } from "@/lib/placeholder-user";
import type { LoginLocale, LoginParams } from "@/lib/login-recovery";
import LoginEntryRedirect from "./LoginEntryRedirect";

export default async function LoginEntry({ locale, params }: { locale: LoginLocale; params: LoginParams }) {
  const session = await getSession();
  const prefix = locale === "ja" ? "" : `/${locale}`;
  let destination: string | null = null;
  if (session) {
    const { data, error } = await supabaseAdmin.from("users")
      .select("owner_token, scores, diagnosis_completed_at").eq("id", session.id).maybeSingle();
    if (!error && data) {
      destination = !isUndiagnosedPlaceholderUser(data) && data.owner_token
        ? `${prefix}/me/${encodeURIComponent(data.owner_token)}` : `${prefix}/diagnosis`;
    } else if (session.owner_token && session.diagnosis_completed_at) {
      destination = `${prefix}/me/${encodeURIComponent(session.owner_token)}`;
    }
  }
  return <LoginEntryRedirect locale={locale} destination={destination} params={params} />;
}
