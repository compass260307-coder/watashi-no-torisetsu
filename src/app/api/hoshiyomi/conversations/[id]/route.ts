import { NextResponse } from "next/server";
import { isSafeOpaqueToken } from "@/lib/api-security";
import {
  deleteHoshiyomiConversation,
  ensureHoshiyomiCreditsFromPurchase,
} from "@/lib/hoshiyomi/store";
import { checkOrigin } from "@/lib/origin-check";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }
  const session = await getSession(request as never);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [credits, fullAccess] = await Promise.all([
    ensureHoshiyomiCreditsFromPurchase(session.id),
    hasFullAccess(session.id),
  ]);
  if (!fullAccess || !credits.available || credits.data.total <= 0) {
    return NextResponse.json({ error: "Chat access required" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isSafeOpaqueToken(id, 8, 64)) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }
  await deleteHoshiyomiConversation(session.id, id);
  return NextResponse.json({ ok: true });
}
