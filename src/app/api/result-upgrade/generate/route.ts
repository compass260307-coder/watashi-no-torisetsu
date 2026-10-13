import { after, NextResponse } from "next/server";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { hasPremiumBundleAccess } from "@/lib/entitlements";
import { checkOrigin } from "@/lib/origin-check";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { ResultUpgradeRow } from "@/lib/result-upgrade";
import { resultUpgradeSpendBlock } from "@/lib/ai-spend-guard";

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
  let force = false;
  if (request.body) {
    const body = await readJsonObject(request, 1_000);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    force = body.value.force === true;
  }
  const { data, error } = await supabaseAdmin
    .from("result_upgrades")
    .select("state, attempts, last_error, updated_at, generation_started_at")
    .eq("user_id", session.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Generation state unavailable" }, { status: 503 });
  const existing = data as Pick<ResultUpgradeRow,
    "state" | "attempts" | "last_error" | "updated_at" | "generation_started_at"
  > | null;
  if (!existing) {
    return NextResponse.json({ state: "no_answers" }, { status: 409 });
  }
  if (existing.state === "ready") {
    return NextResponse.json({ ok: true, state: "ready", skipped: true });
  }
  if (existing.state === "generating" && existing.generation_started_at &&
      Date.now() - Date.parse(existing.generation_started_at) < 5 * 60_000) {
    return NextResponse.json({ ok: true, state: "generating", skipped: true });
  }
  const spendBlock = resultUpgradeSpendBlock(existing);
  if (spendBlock && (!force || !spendBlock.canRetry)) {
    return NextResponse.json({
      ok: true, state: "blocked", skipped: true,
      code: spendBlock.code, retryAt: spendBlock.retryAt, canRetry: spendBlock.canRetry,
    });
  }
  if (existing.state === "failed" && existing.attempts >= 3 && !force) {
    return NextResponse.json({ ok: true, state: "failed" });
  }

  // Only a request that can start generation consumes the recovery allowance.
  const rateLimit = await consumeRateLimit(request, {
    scope: "result-upgrade-generate",
    identifier: session.id,
    limit: 6,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
    });
  }

  after(async () => {
    const { generateResultUpgradeForUser } = await import(
      "@/lib/result-upgrade/generate"
    );
    await generateResultUpgradeForUser(session.id, { force });
  });
  return NextResponse.json({ ok: true, state: "pending" });
}
