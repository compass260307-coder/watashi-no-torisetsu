import { NextResponse } from "next/server";
import { hasPremiumBundleAccess } from "@/lib/entitlements";
import { renderLineUpgradeJpeg } from "@/lib/line-upgrade-image-render";
import { verifyLineUpgradeImage } from "@/lib/line-upgrade-image-token";
import { isResultUpgradeReady } from "@/lib/result-upgrade";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const identity = verifyLineUpgradeImage(url.searchParams.get("token") ?? "");
  if (!identity) return new NextResponse(null,{status:404});
  const {data: account,error} = await supabaseAdmin.from("line_accounts").select("user_id")
    .eq("line_user_id",identity.lineUserId).maybeSingle();
  if (error || account?.user_id !== identity.userId || !(await hasPremiumBundleAccess(identity.userId))) return new NextResponse(null,{status:404});
  const row = await loadResultUpgradeForUser(identity.userId);
  if (row?.locale !== "ja" || !isResultUpgradeReady(row) || row.generated_at !== identity.generatedAt ||
    !row.character_storage_path.startsWith(`${identity.userId}/`)) return new NextResponse(null,{status:404});
  const {data: image,error: downloadError} = await supabaseAdmin.storage.from("result-upgrade-characters").download(row.character_storage_path);
  if (downloadError || !image || image.size > 10*1024*1024) return new NextResponse(null,{status:404});
  try {
    const preview = url.searchParams.get("size") === "preview";
    const output = await renderLineUpgradeJpeg(await image.arrayBuffer(), preview);
    if (output.length > (preview?1:10)*1024*1024) return new NextResponse(null,{status:413});
    return new NextResponse(new Uint8Array(output),{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
  } catch { return new NextResponse(null,{status:404}); }
}
