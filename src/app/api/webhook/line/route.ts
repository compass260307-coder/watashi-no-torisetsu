import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWelcomeMessage, sendGenericWelcome } from "@/lib/line-notify";

export const runtime = "nodejs";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

function verifySignature(rawBody: string, signature: string): boolean {
  if (!CHANNEL_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  // タイミング攻撃対策で timingSafeEqual を使用
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type LineEvent = {
  type: string;
  source?: { userId?: string };
  [key: string]: unknown;
};

async function handleFollowEvent(lineUserId: string): Promise<void> {
  // line_users で紐付けレコードを検索
  const { data, error } = await supabase
    .from("line_users")
    .select("owner_token, welcome_sent_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (error) {
    console.error("[webhook follow] line_users lookup error:", error);
    return;
  }

  if (!data) {
    // 紐付けなし: LIFF 経由せず直接 bot 追加したユーザー → 汎用 welcome
    await sendGenericWelcome(lineUserId);
    return;
  }

  if (data.welcome_sent_at) {
    // 既に送信済み (再 follow 等) → 重複送信スキップ
    console.log(
      "[webhook follow] welcome already sent, skipping for",
      lineUserId.slice(0, 8),
    );
    return;
  }

  // 紐付けあり + welcome 未送信 → 個人化 welcome 送信
  // sendWelcomeMessage は内部で welcome_sent_at を更新する
  const result = await sendWelcomeMessage(
    data.owner_token as string,
    lineUserId,
  );
  if (!result.success) {
    console.error(
      "[webhook follow] sendWelcomeMessage failed:",
      result.statusCode,
      result.error,
    );
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature || !verifySignature(rawBody, signature)) {
    console.warn("[webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[webhook] JSON parse error:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = payload.events ?? [];

  // LINE は at-least-once 配信。各イベントのエラーは個別に握り潰し、200 を返す
  for (const event of events) {
    try {
      if (event.type === "follow") {
        const userId = event.source?.userId;
        if (userId) {
          await handleFollowEvent(userId);
        }
      }
      // unfollow / message 等は将来必要になったら追加
    } catch (err) {
      console.error("[webhook] event handling error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
