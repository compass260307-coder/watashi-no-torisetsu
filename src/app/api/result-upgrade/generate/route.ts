import { after, NextResponse } from "next/server";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { hasPremiumBundleAccess } from "@/lib/entitlements";
import { checkOrigin } from "@/lib/origin-check";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { ResultUpgradeRow } from "@/lib/result-upgrade";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }
  const session = await getSession(request as never);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPremiumBundleAccess(session.id))) {
    return NextResponse.json({ state: "unpurchased" }, { status: 403 });
  }
  const rateLimit = await consumeRateLimit(request, {
    scope: "result-upgrade-generate",
    identifier: session.id,
    limit: 6,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let force = false;
  if (request.body) {
    const body = await readJsonObject(request, 1_000);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    force = body.value.force === true;
  }
  const { data } = await supabaseAdmin
    .from("result_upgrades")
    .select("state, attempts")
    .eq("user_id", session.id)
    .maybeSingle();
  const existing = data as Pick<ResultUpgradeRow, "state" | "attempts"> | null;
  if (!existing) {
    return NextResponse.json({ state: "no_answers" }, { status: 409 });
  }
  if (existing.state === "ready") {
    return NextResponse.json({ ok: true, state: "ready", skipped: true });
  }
  if (existing.state === "failed" && existing.attempts >= 3 && !force) {
    return NextResponse.json({ ok: true, state: "failed" });
  }

  after(async () => {
    const { generateResultUpgradeForUser } = await import(
      "@/lib/result-upgrade/generate"
    );
    await generateResultUpgradeForUser(session.id, { force });
  });
  return NextResponse.json({ ok: true, state: "pending" });
}
