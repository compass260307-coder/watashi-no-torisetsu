import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api-security";
import { checkOrigin } from "@/lib/origin-check";
import { generateResultUpgradeReaction } from "@/lib/result-upgrade/reaction";
import { normalizeResultUpgradeReactionAnswers } from "@/lib/result-upgrade-reaction";

export const runtime = "nodejs";
export const maxDuration = 15;

// ローカルプレビュー専用。ログインなしでAliceの反応を試し、トークン数と費用の概算を確認する。
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const body = await readJsonObject(request, 12_000);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const answers = normalizeResultUpgradeReactionAnswers(body.value.answers);
  if (!answers) return NextResponse.json({ error: "invalid answers" }, { status: 400 });

  const result = await generateResultUpgradeReaction({ answers, userId: null });
  return NextResponse.json(result);
}
