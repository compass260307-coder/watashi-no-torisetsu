import { NextResponse } from "next/server";
import { isSafeOpaqueToken } from "@/lib/api-security";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isResultUpgradeReady, type ResultUpgradeRow } from "@/lib/result-upgrade";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isSafeOpaqueToken(token)) return new NextResponse(null, { status: 404 });
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("owner_token", token)
    .maybeSingle();
  if (!user) return new NextResponse(null, { status: 404 });
  const session = await getSession(request as never);
  if (!session || session.id !== user.id) {
    return new NextResponse(null, { status: 404 });
  }
  const { data } = await supabaseAdmin
    .from("result_upgrades")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const row = data as ResultUpgradeRow | null;
  if (!isResultUpgradeReady(row)) return new NextResponse(null, { status: 404 });

  const { data: image, error } = await supabaseAdmin.storage
    .from("result-upgrade-characters")
    .download(row.character_storage_path);
  if (error || !image) return new NextResponse(null, { status: 404 });
  return new NextResponse(await image.arrayBuffer(), {
    headers: {
      "Content-Type": image.type || "image/png",
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
