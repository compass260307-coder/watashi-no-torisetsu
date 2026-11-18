import { NextResponse } from "next/server";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { hasFullAccess } from "@/lib/entitlements";
import { getResultUpgradeSession } from "@/lib/line-result-upgrade";
import { checkOrigin } from "@/lib/origin-check";
import { generateResultUpgradeReaction } from "@/lib/result-upgrade/reaction";
import {
  fallbackResultUpgradeReaction,
  normalizeResultUpgradeReactionAnswers,
} from "@/lib/result-upgrade-reaction";

export const runtime = "nodejs";
export const maxDuration = 15;

// 日本語Webの7問チャットで、最新の回答へのAliceの反応を返す。
// 反応は会話の演出で、回答の保存や購入の可否には関わらない。AIを使えないときは定型文を返す。
export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }
  const session = await getResultUpgradeSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasFullAccess(session.id))) {
    return NextResponse.json({ error: "full access required" }, { status: 403 });
  }
  const body = await readJsonObject(request, 12_000);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
  if (body.value.ownerToken !== undefined && body.value.ownerToken !== session.owner_token) {
    return NextResponse.json({ error: "result owner mismatch" }, { status: 403 });
  }
  const answers = normalizeResultUpgradeReactionAnswers(body.value.answers);
  if (!answers) {
    return NextResponse.json({ error: "invalid answers" }, { status: 400 });
  }
  const index = answers.length - 1;

  // 1回の会話は7回の呼び出し。書き直しや再開を見込んでも、これを超える利用はAI費用の保護を優先する。
  const rateLimit = await consumeRateLimit(request, {
    scope: "result-upgrade-reaction",
    identifier: session.id,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({
      reaction: fallbackResultUpgradeReaction(index, answers[index]),
      source: "fallback",
    });
  }

  const result = await generateResultUpgradeReaction({ answers, userId: session.id });
  return NextResponse.json({ reaction: result.reaction, source: result.source });
}
