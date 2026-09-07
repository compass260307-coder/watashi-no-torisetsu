import { NextRequest, NextResponse } from "next/server";

import {
  appError,
  appRequestId,
  requireAppAccountId,
} from "@/lib/alice-app-api";
import { readJsonObject } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const MOODS = new Set(["clear", "calm", "mixed", "hard"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DailyAnswer = {
  question_id: number;
  value: number;
};

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

  const parsed = await readJsonObject(request, 32 * 1024);
  if (!parsed.ok) return invalidRequest(requestId);

  const checkinId = parsed.value.checkin_id;
  const mood = parsed.value.mood;
  const journal = parsed.value.journal;
  const answers = normalizeAnswers(parsed.value.answers);

  if (
    typeof checkinId !== "string" ||
    !UUID_PATTERN.test(checkinId) ||
    typeof mood !== "string" ||
    !MOODS.has(mood) ||
    answers === null ||
    (journal !== undefined && journal !== null && typeof journal !== "string") ||
    (typeof journal === "string" && journal.trim().length > 5000)
  ) {
    return invalidRequest(requestId);
  }

  const { data, error } = await supabaseAdmin.rpc("complete_alice_daily", {
    p_account_id: auth.accountId,
    p_checkin_id: checkinId,
    p_mood: mood,
    p_answers: answers,
    p_journal_body: typeof journal === "string" ? journal : null,
  });

  if (error) {
    const knownCode = knownDailyCompleteError(error.message);
    if (knownCode) {
      return appError({
        status: knownCode === "daily_checkin_not_found" ? 404 : 409,
        code: knownCode,
        message:
          knownCode === "daily_checkin_not_found"
            ? "今日の記録が見つかりませんでした。最初からやり直してください。"
            : "回答を確認できませんでした。10問すべてに答えてください。",
        requestId,
      });
    }

    console.error("[alice/daily/complete] transaction failed", {
      requestId,
      message: error.message,
    });
    return appError({
      status: 503,
      code: "daily_complete_failed",
      message: "今日の記録を保存できませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return appError({
      status: 503,
      code: "daily_complete_failed",
      message: "今日の記録を保存できませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

function normalizeAnswers(value: unknown): DailyAnswer[] | null {
  if (!Array.isArray(value) || value.length !== 10) return null;

  const answers: DailyAnswer[] = [];
  const questionIds = new Set<number>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const candidate = item as Record<string, unknown>;
    const questionId = candidate.question_id;
    const answer = candidate.value;
    if (
      typeof questionId !== "number" ||
      !Number.isInteger(questionId) ||
      typeof answer !== "number" ||
      !Number.isInteger(answer) ||
      answer < 1 ||
      answer > 7 ||
      questionIds.has(questionId)
    ) {
      return null;
    }
    questionIds.add(questionId);
    answers.push({ question_id: questionId, value: answer });
  }
  return answers;
}

function knownDailyCompleteError(message: string) {
  const known = [
    "account_not_linked",
    "daily_mood_invalid",
    "daily_answers_incomplete",
    "daily_checkin_not_found",
    "daily_answers_invalid",
    "daily_scoring_incomplete",
    "journal_too_long",
  ] as const;
  return known.find((code) => message.includes(code)) ?? null;
}

function invalidRequest(requestId: string) {
  return appError({
    status: 400,
    code: "invalid_daily_request",
    message: "回答内容を確認してください。",
    requestId,
  });
}
