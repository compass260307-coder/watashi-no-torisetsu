import { NextResponse } from "next/server";
import {
  consumeRateLimit,
  isSafeOpaqueToken,
  readJsonObject,
} from "@/lib/api-security";
import { checkOrigin } from "@/lib/origin-check";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const parsed = await readJsonObject(request, 1024);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }

  const ownerToken = parsed.value.ownerToken;
  const locale = parsed.value.locale;
  if (!isSafeOpaqueToken(ownerToken) || (locale !== "ja" && locale !== "ko")) {
    return NextResponse.json({ error: "Invalid locale preference" }, { status: 400 });
  }

  const limit = await consumeRateLimit(request, {
    scope: "preferred-locale-update",
    identifier: ownerToken,
    limit: 30,
    windowSeconds: 600,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ preferred_locale: locale })
    .eq("owner_token", ownerToken);
  if (error) {
    console.error("[preferred-locale] update failed:", error.message);
    return NextResponse.json({ error: "Unable to save locale" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
