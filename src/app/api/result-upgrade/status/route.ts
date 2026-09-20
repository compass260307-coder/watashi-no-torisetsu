import { NextResponse } from "next/server";
import { hasFullAccess, hasPremiumBundleAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";
import { isResultUpgradeReady } from "@/lib/result-upgrade";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession(request as never);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [fullAccess, premium, row] = await Promise.all([
    hasFullAccess(session.id),
    hasPremiumBundleAccess(session.id),
    loadResultUpgradeForUser(session.id),
  ]);
  if (!fullAccess) return NextResponse.json({ state: "locked" }, { status: 403 });
  if (!row) return NextResponse.json({ ok: true, state: "no_answers", premium });
  if (isResultUpgradeReady(row)) {
    return NextResponse.json({ ok: true, state: "ready", premium: true });
  }
  return NextResponse.json({
    ok: true,
    state: row.state,
    premium,
    attempts: row.attempts,
  });
}
