// Alice Plus (LINE) Phase 1: Messaging API クライアント + webhook 署名検証。
//
// 旧LIFF時代のコードは使わず1から作り直し (2026-08-31 方針)。
// env:
//   LINE_CHANNEL_SECRET        - webhook 署名検証用 (Messaging API チャネル)
//   LINE_CHANNEL_ACCESS_TOKEN  - reply / push 送信用 (長期チャネルアクセストークン)

import { createHmac, timingSafeEqual } from "node:crypto";

const LINE_API_BASE = "https://api.line.me";

// クイックリプライ: 応答の下に出るタップチップ。次に送る言葉を提案して
// 「何を打てばいいか分からない」を減らす。labelは20文字まで (LINE仕様)
export interface LineQuickReply {
  items: Array<{
    type: "action";
    action: { type: "message"; label: string; text: string };
  }>;
}

export interface LineTextMessage {
  type: "text";
  text: string;
  quickReply?: LineQuickReply;
}

// Phase 2以降で Flex Message 等を足す拡張点
export type LineOutgoingMessage = LineTextMessage;

/** ラベル=送信テキストのクイックリプライを組み立てる。 */
export function quickReplies(...labels: string[]): LineQuickReply {
  return {
    items: labels.map((label) => ({
      type: "action" as const,
      action: { type: "message" as const, label, text: label },
    })),
  };
}

export interface LineWebhookEvent {
  type: string;
  timestamp?: number;
  replyToken?: string;
  source?: {
    type: string;
    userId?: string;
  };
  message?: {
    id: string;
    type: string;
    text?: string;
  };
}

export interface LineWebhookBody {
  destination?: string;
  events?: LineWebhookEvent[];
}

export function isLineConfigured(): boolean {
  return Boolean(
    process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN,
  );
}

/**
 * webhook 署名検証。x-line-signature は
 * base64(HMAC-SHA256(channel secret, raw request body))。
 * raw body 文字列をそのまま渡すこと (JSON.parse 後の再 stringify は不可)。
 */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

async function callLineApi(path: string, body: unknown): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("[line] LINE_CHANNEL_ACCESS_TOKEN is not configured");
    return false;
  }

  const response = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[line] API call failed", {
      path,
      status: response.status,
      detail: detail.slice(0, 500),
    });
    return false;
  }
  return true;
}

/** replyToken は受信から約1分・1回のみ有効。webhook 処理中に即時使う。 */
export async function replyLineMessages(
  replyToken: string,
  messages: LineOutgoingMessage[],
): Promise<boolean> {
  return callLineApi("/v2/bot/message/reply", { replyToken, messages });
}

/** 能動配信 (Phase 2以降の再訪トリガー通知にも使う)。 */
export async function pushLineMessages(
  lineUserId: string,
  messages: LineOutgoingMessage[],
): Promise<boolean> {
  return callLineApi("/v2/bot/message/push", { to: lineUserId, messages });
}

/**
 * 連携コードのハッシュ。app_transfer_codes (hashAliceTransferSecret) と
 * 同じ secret 系列を使うが、kind プレフィックスを分けて衝突を避ける。
 */
export function hashLineLinkCode(code: string): string {
  const secret =
    process.env.ALICE_TRANSFER_CODE_SECRET ??
    process.env.RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("line link code secret is not configured");
  return createHmac("sha256", secret).update(`line-link\0${code}`).digest("hex");
}
