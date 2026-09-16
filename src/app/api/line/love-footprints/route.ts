import { NextRequest, NextResponse } from "next/server";

import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { recordLineEvent } from "@/lib/line-events";
import {
  isLineLoveFootprintKind,
  isLineLoveFootprintMood,
  lineLoveFootprintFromRow,
} from "@/lib/line-love-footprints";
import {
  buildLinePlusPageUrl,
  hasActiveLinePlus,
  verifyLinePlusToken,
} from "@/lib/line-plus";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function shortString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1901 &&
    year <= 2100 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getTime() <= Date.now()
  );
}

async function authenticate(body: Record<string, unknown>) {
  const lineUserId = shortString(body.u, 64);
  const expiresAtMs = Number(body.e);
  const signature = shortString(body.s, 256);
  if (!verifyLinePlusToken({ lineUserId, expiresAtMs, signature })) {
    return { error: "invalid_token" as const, lineUserId };
  }
  const { data: account } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!account?.user_id) {
    return { error: "not_linked" as const, lineUserId };
  }
  if (!(await hasActiveLinePlus(account.user_id))) {
    return {
      error: "plus_required" as const,
      lineUserId,
      plusUrl: buildLinePlusPageUrl(lineUserId),
    };
  }
  return { lineUserId, userId: account.user_id };
}

export async function POST(request: NextRequest) {
  const bodyResult = await readJsonObject(request, 8_192);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { error: bodyResult.error },
      { status: bodyResult.status },
    );
  }
  const body = bodyResult.value;
  const auth = await authenticate(body);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, plusUrl: auth.plusUrl },
      { status: 403 },
    );
  }
  const rateLimit = await consumeRateLimit(request, {
    scope: "line-love-footprints-create",
    identifier: auth.lineUserId,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const happenedOn = shortString(body.happenedOn, 10);
  const partnerName = shortString(body.partnerName, 40) || null;
  const kind = body.kind;
  const mood = body.mood;
  const title = shortString(body.title, 80);
  const note = shortString(body.note, 1_200) || null;
  if (
    !validDate(happenedOn) ||
    !isLineLoveFootprintKind(kind) ||
    !isLineLoveFootprintMood(mood) ||
    !title
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("line_love_footprints")
    .insert({
      user_id: auth.userId,
      happened_on: happenedOn,
      partner_name: partnerName,
      kind,
      mood,
      title,
      note,
    })
    .select(
      "id, happened_on, partner_name, kind, mood, title, note, created_at",
    )
    .single();
  if (error || !data) {
    console.error("[line-love-footprints] insert failed", {
      message: error?.message ?? "missing_row",
    });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  const entry = lineLoveFootprintFromRow(data);
  if (!entry) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  await recordLineEvent({
    eventName: "line_love_footprint_created",
    metadata: {
      user_id: auth.userId,
      line_user_id: auth.lineUserId,
      kind,
      mood,
    },
  });
  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const bodyResult = await readJsonObject(request, 2_048);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { error: bodyResult.error },
      { status: bodyResult.status },
    );
  }
  const body = bodyResult.value;
  const auth = await authenticate(body);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, plusUrl: auth.plusUrl },
      { status: 403 },
    );
  }
  const rateLimit = await consumeRateLimit(request, {
    scope: "line-love-footprints-delete",
    identifier: auth.lineUserId,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const id = shortString(body.id, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("line_love_footprints")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);
  if (error) {
    console.error("[line-love-footprints] delete failed", {
      message: error.message,
    });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  await recordLineEvent({
    eventName: "line_love_footprint_deleted",
    metadata: {
      user_id: auth.userId,
      line_user_id: auth.lineUserId,
    },
  });
  return NextResponse.json({ ok: true });
}
