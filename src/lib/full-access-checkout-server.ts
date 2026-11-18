import "server-only";

import type { NextRequest } from "next/server";
import { fullAccessMarketForCountry } from "@/lib/full-access-pricing";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export type FullAccessBuyer = { id: string; email: string | null; owner_token: string | null };

export function fullAccessMarketForRequest(request: NextRequest) {
  // ローカル開発だけ、DEV_IP_COUNTRY（例: JP）で接続元の国を指定できる。本番ビルドでは無視する。
  const devCountry =
    process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1"
      ? process.env.DEV_IP_COUNTRY?.trim().toUpperCase() || null
      : null;
  return fullAccessMarketForCountry(
    process.env.VERCEL === "1" ? request.headers.get("x-vercel-ip-country") : devCountry,
  );
}

export async function resolveFullAccessBuyer(
  request: NextRequest,
  ownerToken: string,
): Promise<FullAccessBuyer | null> {
  if (ownerToken) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, email, owner_token")
      .eq("owner_token", ownerToken)
      .maybeSingle();
    if (data) return data as FullAccessBuyer;
  }
  const session = await getSession(request);
  return session
    ? { id: session.id, email: session.email, owner_token: session.owner_token }
    : null;
}
