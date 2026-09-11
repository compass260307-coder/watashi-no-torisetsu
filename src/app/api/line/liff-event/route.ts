// LIFF内の連携フローを段階別に記録する。
// ID/アクセストークン/連携コードは受け取らず、試行IDと結果だけを保存する。

import { NextResponse } from "next/server";

import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { recordLineEvent } from "@/lib/line-events";
import { checkOrigin } from "@/lib/origin-check";

export const runtime = "nodejs";

const LIFF_STAGES = new Set([
  "opened",
  "sdk_loaded",
  "initialized",
  "authenticated",
  "login_started",
  "id_token_ready",
  "link_requested",
  "link_conflict",
  "link_completed",
  "route_requested",
  "route_completed",
  "retry_clicked",
  "failed",
]);

const LIFF_FLOWS = new Set(["link", "route", "unknown"]);

export async function POST(request: Request) {
  const origin = checkOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: 403 });
  }

  const parsed = await readJsonObject(request, 4 * 1024);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }

  const stage = parsed.value.stage;
  const flow = parsed.value.flow;
  const attemptId = parsed.value.attemptId;
  const errorCode = parsed.value.errorCode;
  const httpStatus = parsed.value.httpStatus;

  if (
    typeof stage !== "string" ||
    !LIFF_STAGES.has(stage) ||
    typeof flow !== "string" ||
    !LIFF_FLOWS.has(flow) ||
    typeof attemptId !== "string" ||
    !/^[A-Za-z0-9_-]{8,64}$/.test(attemptId) ||
    (errorCode !== undefined &&
      (typeof errorCode !== "string" ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(errorCode))) ||
    (httpStatus !== undefined &&
      (typeof httpStatus !== "number" ||
        !Number.isInteger(httpStatus) ||
        httpStatus < 100 ||
        httpStatus > 599))
  ) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  const rateLimit = await consumeRateLimit(request, {
    scope: "line-liff-event-ip",
    limit: 120,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
        },
      },
    );
  }

  await recordLineEvent({
    eventName: "line_liff_progress",
    metadata: {
      stage,
      flow,
      attempt_id: attemptId,
      ...(errorCode ? { error_code: errorCode } : {}),
      ...(typeof httpStatus === "number" ? { http_status: httpStatus } : {}),
    },
  });

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
