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
export const LINE_UPGRADE_PREPARATION_DELAY_MS = 6000;
export const LINE_UPGRADE_PREPARING_MESSAGE = "5つのお話、聞かせてくれてありがとう🌷 あなたの回答をまとめて、専用の結果づくりの準備を整えているよ。少し待っていてね🌙";
export const LINE_UPGRADE_OFFER_MESSAGE = "準備が整ったよ✨ あなた専用のキャラクターと鑑定書をつくれるよ。内容を確認してみてね🌙";

export const LINE_UPGRADE_CARD_COPY = {
  title: "世界に一体だけのキャラクターと、あなた専用の鑑定書を作成するよ✨",
  body: "元の診断キャラクターを受け継ぎながら、今のあなたに似合う表情・服装・小物・背景へ。タイプ名と自己診断結果、5章の鑑定書も、あなた専用になるよ。",
  listPrice: `通常価格 ¥${LINE_RESULT_UPGRADE_LIST_PRICE_JPY.toLocaleString("ja-JP")}`,
  coupon: `クーポン適用 −¥${LINE_RESULT_UPGRADE_COUPON_JPY}`,
  payment: `お支払い ¥${RESULT_UPGRADE_PRICE_JPY}（税込・買い切り）`,
  guarantee: "30日間の返金保証つき。満足しなかったら連絡してね🌿",
  delivery: "購入後は自動で生成して、LINEにキャラクターと鑑定書のリンクを届けるよ。",
  button: "購入手続きへ",
} as const;

/** The same card is used for a new fifth answer and a returning completed conversation. */
export function lineUpgradePurchaseCard(checkoutUrl: string): LineFlexMessage {
  const copy = LINE_UPGRADE_CARD_COPY;
  return {
    type: "flex",
    altText: `あなた専用のキャラクターと鑑定書 🌙 ${copy.payment}`,
    contents: {
      type: "bubble", size: "mega",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#06C755", paddingAll: "20px", spacing: "sm",
        contents: [
          { type: "text", text: "Alice", weight: "bold", color: "#FFFFFF", size: "xl" },
          { type: "text", text: "アップグレード内容の確認", color: "#FFFFFF", size: "sm", wrap: true },
        ],
      },
      body: {
        type: "box", layout: "vertical", paddingAll: "20px", spacing: "md",
        contents: [
          { type: "text", text: "回答の保存ができたよ🌷", size: "xs", color: "#9A6A24", weight: "bold", wrap: true },
          { type: "text", text: copy.title, size: "lg", weight: "bold", color: "#2E2E5C", wrap: true },
          { type: "text", text: copy.body, size: "sm", color: "#66657B", wrap: true },
          { type: "separator", margin: "lg" },
          { type: "text", text: copy.listPrice, decoration: "line-through", size: "sm", color: "#66657B" },
          { type: "text", text: copy.coupon, size: "sm", color: "#66657B" },
          { type: "text", text: copy.payment, size: "lg", color: "#2E2E5C", weight: "bold", wrap: true },
          { type: "text", text: copy.guarantee, size: "xs", color: "#66657B", wrap: true },
          { type: "text", text: copy.delivery, size: "xs", color: "#66657B", wrap: true },
        ],
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "20px", paddingTop: "0px",
        contents: [{ type: "button", style: "primary", color: "#A87322", action: { type: "uri", label: copy.button, uri: checkoutUrl } }],
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
