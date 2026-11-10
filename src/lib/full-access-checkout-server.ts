import "server-only";

import type { NextRequest } from "next/server";
import { fullAccessMarketForCountry } from "@/lib/full-access-pricing";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export type FullAccessBuyer = { id: string; email: string | null; owner_token: string | null };

export function fullAccessMarketForRequest(request: NextRequest) {
  return fullAccessMarketForCountry(
    process.env.VERCEL === "1" ? request.headers.get("x-vercel-ip-country") : null,
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
