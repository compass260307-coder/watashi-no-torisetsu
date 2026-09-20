import { NextResponse } from "next/server";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { hasFullAccess } from "@/lib/entitlements";
import { checkOrigin } from "@/lib/origin-check";
import {
  normalizeResultUpgradeAnswers,
  type ResultUpgradeRow,
} from "@/lib/result-upgrade";
import {
  isMissingResultUpgradeTable,
  resolveResultUpgradeBase,
} from "@/lib/result-upgrade-server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }
  const session = await getSession(request as never);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasFullAccess(session.id))) {
    return NextResponse.json({ error: "full access required" }, { status: 403 });
  }
  const rateLimit = await consumeRateLimit(request, {
    scope: "result-upgrade-answers",
    identifier: session.id,
    limit: 20,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }
  const body = await readJsonObject(request, 12_000);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
  const answers = normalizeResultUpgradeAnswers(body.value.answers);
  if (!answers) {
    return NextResponse.json({ error: "invalid answers" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("result_upgrades")
    .select("state")
    .eq("user_id", session.id)
    .maybeSingle();
  if (isMissingResultUpgradeTable(existingError)) {
    return NextResponse.json(
      { error: "result upgrade database is not ready" },
      { status: 503 },
    );
  }
  if (existingError) {
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
  if ((existing as Pick<ResultUpgradeRow, "state"> | null)?.state === "ready") {
    return NextResponse.json({ error: "already generated" }, { status: 409 });
  }

  const base = await resolveResultUpgradeBase(session.id);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("result_upgrades").upsert(
    {
      user_id: session.id,
      answers,
      source_type_id: base.sourceTypeId,
      source_character_path: base.sourceCharacterPath,
      state: "answers_ready",
      personalized_type_name: null,
      personalized_intro: null,
      reading: null,
      character_storage_path: null,
      text_model: null,
      image_model: null,
      attempts: 0,
      generation_started_at: null,
      generated_at: null,
      last_error: null,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[/api/result-upgrade/answers] save failed:", error);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, state: "answers_ready" });
}
