import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { readJsonObject, consumeRateLimit } from "@/lib/api-security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const url = new URL(request.url);
  const ownerToken = url.searchParams.get("ownerToken");
  if (!ownerToken) return NextResponse.json({ shown: false });

  const ipLimit = await consumeRateLimit(request, { scope: "uranai-interstitial-status-ip", limit: 180, windowSeconds: 60 });
  if (!ipLimit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  try {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("event_name", "uranai_interstitial_shown")
      .eq("owner_token", ownerToken)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[api/uranai-interstitial] status lookup error:", error.message);
      return NextResponse.json({ shown: false });
    }
    return NextResponse.json({ shown: !!data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ shown: false });
  }
}

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const ipLimit = await consumeRateLimit(request, { scope: "uranai-interstitial-mark-ip", limit: 60, windowSeconds: 60 });
  if (!ipLimit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const parsed = await readJsonObject(request, 2 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value as { ownerToken?: string };
  const ownerToken = typeof body.ownerToken === "string" ? body.ownerToken : null;
  if (!ownerToken) return NextResponse.json({ error: "missing ownerToken" }, { status: 400 });

  try {
    const { error } = await supabaseAdmin.from("events").insert({
      event_name: "uranai_interstitial_shown",
      owner_token: ownerToken,
      metadata: { recorded_at: new Date().toISOString() },
    });
    if (error) {
      console.error("[api/uranai-interstitial] insert error:", error.message);
      return NextResponse.json({ error: "unable to record" }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
