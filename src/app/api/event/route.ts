import {
  consumeRateLimit,
  readJsonObject,
  sanitizeFlatMetadata,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CLIENT_EVENT_NAMES = new Set([
  "diagnosis_started",
  "diagnosis_question_answered",
  "diagnosis_completed",
  "friend_landing_viewed",
  "friend_answer_started",
  "friend_answer_scale_completed",
  "friend_answer_completed",
  "friend_to_diagnosis_clicked",
  "friend_invite_clicked",
  "share_clicked",
  "result_viewed",
  "result_revisited",
  "three_friends_unlocked",
  "paywall_viewed",
  "paywall_scroll_clicked",
  "purchase_cta_clicked",
]);

type OptionalIdentifierResult =
  | { ok: true; value: string | null }
  | { ok: false };

function optionalIdentifier(
  value: unknown,
  maxLength = 128,
): OptionalIdentifierResult {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return { ok: false };
  }
  return { ok: true, value };
}

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const ipLimit = await consumeRateLimit(request, {
    scope: "event-write-ip",
    limit: 180,
    windowSeconds: 60,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many events" },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const parsedBody = await readJsonObject(request, 8 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;
  const { eventName, sessionId, inviteCode, ownerToken, metadata } = body;

  if (typeof eventName !== "string" || !CLIENT_EVENT_NAMES.has(eventName)) {
    return NextResponse.json({ error: "Invalid eventName" }, { status: 400 });
  }

  const parsedSessionId = optionalIdentifier(sessionId);
  const parsedInviteCode = optionalIdentifier(inviteCode);
  const parsedOwnerToken = optionalIdentifier(ownerToken);
  const parsedMetadata = sanitizeFlatMetadata(metadata);
  if (
    !parsedSessionId.ok ||
    !parsedInviteCode.ok ||
    !parsedOwnerToken.ok ||
    parsedMetadata === null
  ) {
    return NextResponse.json({ error: "Invalid event data" }, { status: 400 });
  }

  if (parsedSessionId.value) {
    const sessionLimit = await consumeRateLimit(request, {
      scope: "event-write-session",
      identifier: parsedSessionId.value,
      limit: 120,
      windowSeconds: 60,
    });
    if (!sessionLimit.allowed) {
      return NextResponse.json(
        { error: "Too many events" },
        {
          status: 429,
          headers: {
            "Retry-After": String(sessionLimit.retryAfterSeconds ?? 60),
          },
        },
      );
    }
  }

  const { error } = await supabaseAdmin.from("events").insert({
    event_name: eventName,
    session_id: parsedSessionId.value,
    invite_code: parsedInviteCode.value,
    owner_token: parsedOwnerToken.value,
    metadata: parsedMetadata,
  });
  if (error) {
    console.error("[api/event] insert error:", error.message);
    return NextResponse.json(
      { error: "Unable to record event" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
