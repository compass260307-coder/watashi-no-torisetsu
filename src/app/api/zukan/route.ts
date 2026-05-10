import { supabaseAdmin } from "@/lib/supabase-server";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type { TorisetsuTypeId } from "@/lib/types";
import type { ZukanData, ZukanTypeEntry } from "@/lib/zukan-data";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const { data: owner, error: ownerErr } = await supabaseAdmin
    .from("users")
    .select("id, type_id")
    .eq("owner_token", token)
    .maybeSingle();

  if (ownerErr) {
    console.error("zukan owner lookup error:", ownerErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!owner) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const selfTypeId = owner.type_id as TorisetsuTypeId;

  // owner から派生した friend (source_user_id = owner.id) のタイプ集計
  const { data: descendants, error: descErr } = await supabaseAdmin
    .from("users")
    .select("type_id")
    .eq("source_user_id", owner.id);

  if (descErr) {
    console.error("zukan descendants lookup error:", descErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const counts = new Map<TorisetsuTypeId, number>();
  for (const row of descendants ?? []) {
    if (!row.type_id) continue;
    const t = row.type_id as TorisetsuTypeId;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  const entries: ZukanTypeEntry[] = (
    Object.keys(torisetsuTypes) as TorisetsuTypeId[]
  ).map((typeId) => {
    const meta = torisetsuTypes[typeId];
    const count = counts.get(typeId) ?? 0;
    const isSelf = typeId === selfTypeId;
    const unlocked = isSelf || count > 0;
    return {
      typeId,
      name: meta.name,
      emoji: meta.emoji,
      imageUrl: meta.imageUrl ?? null,
      color: meta.color,
      subtitle: meta.subtitle,
      count,
      isSelf,
      unlocked,
    };
  });

  const unlockedCount = entries.filter((e) => e.unlocked).length;

  const data: ZukanData = {
    ownerToken: token,
    selfTypeId,
    totalTypes: entries.length,
    unlockedCount,
    entries,
  };

  return NextResponse.json(data);
}
