import "server-only";
import { after } from "next/server";
import { setTimeout as wait } from "node:timers/promises";
import { pushLineMessages, replyLineMessages, startLineLoadingAnimation, type LineOutgoingMessage } from "@/lib/line";
import { LINE_UPGRADE_PREPARATION_DELAY_MS, LINE_UPGRADE_PREPARING_MESSAGE, LINE_UPGRADE_OFFER_MESSAGE_DELAY_MS, LINE_UPGRADE_CARD_DELAY_MS } from "@/lib/line-upgrade-dialogue";

async function deliver(lineUserId: string, messages: LineOutgoingMessage[], replyToken?: string) {
  const send = (outgoing: LineOutgoingMessage[]) => replyToken
    ? replyLineMessages(replyToken, outgoing) : pushLineMessages(lineUserId, outgoing);
  // Questions and existing purchasers retain their immediate response.
  if (!messages.some(message => message.type === "flex")) return send(messages);
  if (!(await send([{ type: "text", text: LINE_UPGRADE_PREPARING_MESSAGE }]))) return false;
  after(async () => {
    try {
      // A cosmetic indicator must never block delivery when LINE cannot display it.
      await startLineLoadingAnimation(lineUserId, 10).catch(() => {});
      await wait(LINE_UPGRADE_PREPARATION_DELAY_MS);
      for (const [index, message] of messages.entries()) {
        if (index > 0) await wait(message.type === "flex" ? LINE_UPGRADE_CARD_DELAY_MS : LINE_UPGRADE_OFFER_MESSAGE_DELAY_MS);
        if (!(await pushLineMessages(lineUserId, [message]))) {
          console.error("[line/upgrade-offer] purchase card delivery failed");
          return;
        }
      }
    } catch {
      console.error("[line/upgrade-offer] purchase card delivery interrupted");
    }
  });
  return true;
}

export function replyLineUpgradeMessages(replyToken: string, lineUserId: string, messages: LineOutgoingMessage[]) {
  return deliver(lineUserId, messages, replyToken);
}
export function pushLineUpgradeMessages(lineUserId: string, messages: LineOutgoingMessage[]) {
  return deliver(lineUserId, messages);
}
