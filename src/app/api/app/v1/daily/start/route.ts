import { NextRequest, NextResponse } from "next/server";

import {
  appError,
  appRequestId,
  requireAppAccountId,
} from "@/lib/alice-app-api";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = appRequestId(request);
  const auth = await requireAppAccountId(request);
  if (!auth.ok) return auth.response;
  if (process.env.ALICE_DAILY_ENABLED !== "true") {
    return appError({
      status: 503,
      code: "daily_feature_unavailable",
      message: "今日の記録は現在準備中です。",
      retryable: false,
      requestId,
    });
  }

  const { data, error } = await supabaseAdmin.rpc("start_alice_daily", {
    p_account_id: auth.accountId,
  });

  if (error) {
    const knownCode = knownDailyStartError(error.message);
    if (knownCode) {
      return appError({
        status: knownCode === "account_not_linked" ? 404 : 503,
        code: knownCode,
        message:
          knownCode === "account_not_linked"
            ? "診断結果がまだ引き継がれていません。"
            : "今日の質問を準備できませんでした。もう一度お試しください。",
        retryable: knownCode !== "account_not_linked",
        requestId,
      });
    }

    console.error("[alice/daily/start] transaction failed", {
      requestId,
      message: error.message,
    });
    return appError({
      status: 503,
      code: "daily_start_failed",
      message: "今日の質問を準備できませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }

  if (!isDailyStartResponse(data)) {
    return appError({
      status: 503,
      code: "daily_start_failed",
      message: "今日の質問を準備できませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

function knownDailyStartError(message: string) {
  const known = [
    "account_not_linked",
    "daily_question_bank_incomplete",
  ] as const;
  return known.find((code) => message.includes(code)) ?? null;
}

function isDailyStartResponse(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const questions = candidate.questions;
  const questionIds = Array.isArray(questions)
    ? questions.map((question) => {
        if (!question || typeof question !== "object" || Array.isArray(question)) {
          return null;
        }
        const id = (question as Record<string, unknown>).question_id;
        return typeof id === "number" && Number.isInteger(id) ? id : null;
      })
    : [];
  return (
    candidate.checkin !== null &&
    typeof candidate.checkin === "object" &&
    candidate.cycle !== null &&
    typeof candidate.cycle === "object" &&
    questionIds.length === 10 &&
    questionIds.every((id) => id !== null) &&
    new Set(questionIds).size === 10
  );
}
