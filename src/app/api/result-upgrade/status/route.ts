import { NextResponse } from "next/server";
import { hasFullAccess, hasPremiumBundleAccess } from "@/lib/entitlements";
import { getResultUpgradeSession } from "@/lib/line-result-upgrade";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";
import { isResultUpgradeReady } from "@/lib/result-upgrade";
import { resultUpgradeSpendBlock } from "@/lib/ai-spend-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getResultUpgradeSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [fullAccess, premium, row] = await Promise.all([
    hasFullAccess(session.id),
    hasPremiumBundleAccess(session.id),
    loadResultUpgradeForUser(session.id),
  ]);
  if (!fullAccess) return NextResponse.json({ state: "locked" }, { status: 403 });
  if (new URL(request.url).searchParams.get("channel") === "line" && row && row.locale !== "ja") {
    return NextResponse.json({ error: "upgrade locale mismatch" }, { status: 403 });
  }
  if (!row) return NextResponse.json({ ok: true, state: "no_answers", premium });
  if (!premium) {
    return NextResponse.json({ ok: true, state: "unpurchased", premium: false });
  }
  if (isResultUpgradeReady(row)) {
    return NextResponse.json({ ok: true, state: "ready", premium });
  }
  const spendBlock = resultUpgradeSpendBlock(row);
  if (spendBlock) {
    return NextResponse.json({
      ok: true, state: "blocked", premium, attempts: row.attempts,
      code: spendBlock.code, retryAt: spendBlock.retryAt, canRetry: spendBlock.canRetry,
    });
  }
  return NextResponse.json({
    ok: true,
    state: row.state,
    premium,
    attempts: row.attempts,
  });
}
