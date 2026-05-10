import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

// 我々が発行している LIFF アプリの LINE Login Channel ID 一覧
// (LIFF ID `XXXXXX-YYYY` の prefix が channel ID)
// すべて同一 channel (2009978315) の前提だが、安全のため env から動的に集めて
// dedupe + filter している。新 LIFF を追加した場合はここに env 名を増やす。
const LIFF_CHANNEL_IDS = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_LIFF_ID,
      process.env.NEXT_PUBLIC_LIFF_ID_SHARE,
      process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT,
    ]
      .filter((id): id is string => Boolean(id))
      .map((id) => id.split("-")[0]),
  ),
);

// LIFF が発行する ID トークンを LINE Verify API で検証して LINE userId (sub) を取り出す。
// 我々が知っている channel ID のいずれかで検証 OK を返したものだけ受理する。
async function verifyLiffIdToken(
  idToken: string,
): Promise<{ sub: string } | null> {
  if (LIFF_CHANNEL_IDS.length === 0) {
    console.error("[line-resolve] no LIFF channel IDs configured");
    return null;
  }
  for (const channelId of LIFF_CHANNEL_IDS) {
    try {
      const res = await fetch(LINE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          id_token: idToken,
          client_id: channelId,
        }).toString(),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { sub?: unknown };
      if (typeof data.sub === "string" && data.sub.length > 0) {
        return { sub: data.sub };
      }
    } catch (err) {
      console.warn(
        "[line-resolve] verify error for channel",
        channelId,
        String(err),
      );
    }
  }
  return null;
}

// LIFF クライアントから Authorization: Bearer <id_token> で呼び出す。
// 検証された LINE userId に紐付く owner_token / display_name / invite_code を返す。
// id_token 検証なしの旧来クエリパラメータ (lineUserId) は完全に廃止 (PR-FIX-1)。
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verified = await verifyLiffIdToken(idToken);
  if (!verified) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const lineUserId = verified.sub;

  const { data: lineUserRow, error: lineUserErr } = await supabaseAdmin
    .from("line_users")
    .select("owner_token")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (lineUserErr) {
    console.error("line-resolve line_users lookup error:", lineUserErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!lineUserRow?.owner_token) {
    return NextResponse.json({
      ownerToken: null,
      displayName: null,
      inviteCode: null,
    });
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("display_name, invite_code")
    .eq("owner_token", lineUserRow.owner_token)
    .maybeSingle();

  if (userErr) {
    console.error("line-resolve users lookup error:", userErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({
    ownerToken: lineUserRow.owner_token,
    displayName: userRow?.display_name ?? null,
    inviteCode: userRow?.invite_code ?? null,
  });
}
