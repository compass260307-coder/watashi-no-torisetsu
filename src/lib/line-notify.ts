import { messagingApi } from "@line/bot-sdk";
import { supabase } from "./supabase";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://watashi-no-torisetsu.vercel.app";

let cachedClient: messagingApi.MessagingApiClient | null = null;
function getClient(): messagingApi.MessagingApiClient | null {
  if (!channelAccessToken) return null;
  if (!cachedClient) {
    cachedClient = new messagingApi.MessagingApiClient({ channelAccessToken });
  }
  return cachedClient;
}

function buildMessage(friendCount: number, ownerToken: string): string | null {
  if (friendCount === 1) {
    return [
      "1人目の友達が回答してくれました🐧",
      "あと2人で詳細レポートが届きます",
    ].join("\n");
  }
  if (friendCount === 2) {
    return [
      "2人目の友達が回答してくれました🎉",
      "あと1人で詳細レポートが届きます🎁",
    ].join("\n");
  }
  if (friendCount === 3) {
    const reportUrl = `${PUBLIC_BASE_URL}/report/${ownerToken}`;
    return [
      "3人の友達からの回答が揃いました🎉",
      "あなたの詳細レポートが完成しました📖",
      "",
      "▼ こちらから確認できます",
      reportUrl,
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
      "完全版を解放する3ステップ：",
      "",
      "1. このリンクを友達3人にシェア",
      "2. 友達が答えると順次通知が届きます",
      "3. 3人揃ったら詳細レポートをお届け🎁",
      "",
      "▼ シェア用リンク",
      inviteUrl,
      "",
      "（友達は2分・10問で完了します）",
      "",
      "完全版に追加：",
      "深掘り解説の続き・友達評価レーダー・相性診断・自他ギャップなど",
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
    const text = buildMessage(friendCount, ownerToken);
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
