import { messagingApi } from "@line/bot-sdk";
import { supabase } from "./supabase";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const PUBLIC_BASE_URL = "https://watashi-no-torisetsu.vercel.app";

let cachedClient: messagingApi.MessagingApiClient | null = null;
function getClient(): messagingApi.MessagingApiClient | null {
  if (!channelAccessToken) return null;
  if (!cachedClient) {
    cachedClient = new messagingApi.MessagingApiClient({ channelAccessToken });
  }
  return cachedClient;
}

function buildMessage(friendCount: number): string | null {
  if (friendCount === 1) {
    return [
      "友達があなたのトリセツに回答してくれました🐧",
      "残り2人で、詳細レポートが解放されます！",
    ].join("\n");
  }
  if (friendCount === 2) {
    return [
      "2人目の友達が回答してくれました！",
      "あと1人で詳細レポートが届きます🎁",
    ].join("\n");
  }
  if (friendCount === 3) {
    return [
      "3人の友達からの回答が揃いました!",
      "詳細レポートの準備が整い次第、改めてお知らせします📖",
    ].join("\n");
  }
  return null;
}

export async function sendWelcomeMessage(
  ownerToken: string,
  lineUserId: string,
): Promise<void> {
  try {
    const client = getClient();
    if (!client) {
      console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping welcome");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("invite_code")
      .eq("owner_token", ownerToken)
      .maybeSingle();

    if (error) {
      console.error("users lookup error (welcome):", error);
      return;
    }
    if (!data?.invite_code) {
      console.warn("invite_code not found for owner_token:", ownerToken);
      return;
    }

    const inviteUrl = `${PUBLIC_BASE_URL}/friend/${data.invite_code}`;
    const text = [
      "ご登録ありがとうございます🐧",
      "",
      "「ワタシのトリセツ」は友達と一緒に作る、",
      "あなただけの取扱説明書です✨",
      "",
      "📖 こちらのリンクを友達にシェアしてください！",
      inviteUrl,
      "",
      "3人の友達の回答が集まると、",
      "詳細レポートをお届けします🎁",
    ].join("\n");

    await client.pushMessage({
      to: lineUserId,
      messages: [{ type: "text", text }],
    });
  } catch (err) {
    console.error("LINE welcome failed:", err);
  }
}

export async function notifyFriendAnswered(
  ownerToken: string,
  friendCount: number,
): Promise<void> {
  try {
    const text = buildMessage(friendCount);
    if (!text) return;

    const client = getClient();
    if (!client) {
      console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping notify");
      return;
    }

    const { data, error } = await supabase
      .from("line_users")
      .select("line_user_id")
      .eq("owner_token", ownerToken)
      .maybeSingle();

    if (error) {
      console.error("line_users lookup error:", error);
      return;
    }
    if (!data?.line_user_id) {
      // user has not registered LINE yet — silently skip
      return;
    }

    await client.pushMessage({
      to: data.line_user_id,
      messages: [{ type: "text", text }],
    });
  } catch (err) {
    console.error("LINE notify failed:", err);
    // never throw — notification is fire-and-forget
  }
}
