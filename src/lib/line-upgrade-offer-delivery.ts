import "server-only";
import { pushLineMessages, replyLineMessages, type LineOutgoingMessage } from "@/lib/line";

async function deliver(messages: LineOutgoingMessage[], send: () => Promise<boolean>, kind: "reply" | "push") {
  // Duplicate webhooks return no messages. Never consume a reply token for them.
  if (!messages.length) return true;
  if (messages.length > 5) {
    console.error(`[line/upgrade-offer] ${kind} rejected: too many messages`);
    return false;
  }
  try {
    if (await send()) return true;
  } catch {
    // Do not log tokens, signed purchase URLs, answers or provider response bodies.
  }
  console.error(`[line/upgrade-offer] ${kind} delivery failed; retry via result upgrade command`);
  return false;
}

export function replyLineUpgradeMessages(replyToken: string, _lineUserId: string, messages: LineOutgoingMessage[]) {
  // Send the entire offer immediately, with one use of the webhook's reply token.
  // No background delay, automatic retry or push fallback after an uncertain reply.
  return deliver(messages, () => replyLineMessages(replyToken, messages), "reply");
}
export function pushLineUpgradeMessages(lineUserId: string, messages: LineOutgoingMessage[]) {
  // LIFF linking has no reply token. Keep this path separate from webhook replies.
  return deliver(messages, () => pushLineMessages(lineUserId, messages), "push");
}
