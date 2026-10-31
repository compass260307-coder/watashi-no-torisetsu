import { RESULT_UPGRADE_COPY } from "@/i18n/result-upgrade";
import { LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH, RESULT_UPGRADE_QUESTIONS } from "@/lib/result-upgrade";
import { LINE_RESULT_UPGRADE_LIST_PRICE_JPY, LINE_RESULT_UPGRADE_COUPON_JPY, RESULT_UPGRADE_PRICE_JPY } from "@/lib/access-products";
import type { messagingApi } from "@line/bot-sdk";
import type { LineFlexMessage } from "@/lib/line";

export const LINE_UPGRADE_TALK_URL = "https://line.me/R/oaMessage/%40867domoo/?" + encodeURIComponent("結果アップグレード");
export const LINE_UPGRADE_CANCEL = "アップグレードを中止";

export const LINE_UPGRADE_INTRO = "来てくれてありがとう🌙 あなたのことをもう少し知りたいから、5つだけ聞かせてね。短い答えでも、ゆっくり話してくれても大丈夫だよ。";
export const LINE_UPGRADE_RESUME = "おかえりなさい🌷 これまでに話してくれたことは保存してあるから、続きから聞かせてね。";
export const LINE_UPGRADE_CANCELLED = "うん、ここで中止しておくね🌿 また話したくなったら「結果アップグレード」と送ってね。続きから再開できるよ。";
export const LINE_UPGRADE_OFFER_MESSAGE = "5つのお話を聞かせてくれてありがとう🌷 あなた専用のキャラクターと鑑定書を作れるよ。";
export const LINE_UPGRADE_PRICE_MESSAGE = `結果のアップグレードは通常価格¥${LINE_RESULT_UPGRADE_LIST_PRICE_JPY}のところ、¥${LINE_RESULT_UPGRADE_COUPON_JPY}のクーポンを使えるから、お支払いは¥${RESULT_UPGRADE_PRICE_JPY}の買い切りだよ！30日間の返金保証があるから、満足しなかったら連絡してね！`;

export const LINE_UPGRADE_CARD_COPY = {
  title: "Alice - 結果のアップグレード",
  guarantee: "30日間の返金保証付き",
  payment: `お支払い ¥${RESULT_UPGRADE_PRICE_JPY}（税込・買い切り）`,
  button: "購入手続きへ",
} as const;

/** Pricing is sent separately; the compact card identifies Alice and the guarantee. */
export function lineUpgradePurchaseCard(checkoutUrl: string): LineFlexMessage {
  return {
    type: "flex",
    altText: `結果のアップグレード：${LINE_UPGRADE_CARD_COPY.button}（¥${RESULT_UPGRADE_PRICE_JPY}・買い切り）`,
    contents: {
      type: "bubble", size: "mega",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#06C755", paddingAll: "20px", spacing: "sm",
        contents: [
          { type: "text", text: LINE_UPGRADE_CARD_COPY.title, color: "#FFFFFF", size: "md", weight: "bold", wrap: true },
          { type: "text", text: LINE_UPGRADE_CARD_COPY.guarantee, color: "#FFFFFF", size: "sm", wrap: true },
        ],
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "20px",
        contents: [{ type: "button", style: "primary", color: "#06C755", action: { type: "uri", label: LINE_UPGRADE_CARD_COPY.button, uri: checkoutUrl } }],
      },
    } satisfies messagingApi.FlexBubble,
  };
}

export function lineUpgradeQuestion(index: number): string {
  return `質問 ${index + 1}/${RESULT_UPGRADE_QUESTIONS.length}\n${RESULT_UPGRADE_COPY.ja.questionMessages[index]} ${["🌿", "✨", "🌷", "💗", "🌙"][index]}\n\nあなたの言葉で教えてね。ひとことでも大丈夫だよ（${LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH}文字以内）。`;
}

export function lineUpgradePurchaseMessage(paid = false): string {
  return paid
    ? "5つのお話、聞かせてくれてありがとう✨ 追加のお支払いはいらないよ。下のリンクから、あなた専用の結果づくりを続けよう。"
    : `5つのお話、聞かせてくれてありがとう✨ あなたの答えをもとに、専用キャラクター・専用タイプ名・自己診断結果・5章の鑑定書をつくるよ。\n\n結果のアップグレードは通常価格¥${LINE_RESULT_UPGRADE_LIST_PRICE_JPY.toLocaleString("ja-JP")}のところ、¥${LINE_RESULT_UPGRADE_COUPON_JPY}のクーポンが使えるから、お支払いは¥${RESULT_UPGRADE_PRICE_JPY}の買い切りだよ！30日間の返金保証があるから、満足しなかったら連絡してね！`;
}
