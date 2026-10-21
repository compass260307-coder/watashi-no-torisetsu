import { RESULT_UPGRADE_COPY } from "@/i18n/result-upgrade";
import { LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH, RESULT_UPGRADE_QUESTIONS } from "@/lib/result-upgrade";
import { LINE_RESULT_UPGRADE_LIST_PRICE_JPY, LINE_RESULT_UPGRADE_COUPON_JPY, RESULT_UPGRADE_PRICE_JPY } from "@/lib/access-products";

export const LINE_UPGRADE_TALK_URL = "https://line.me/R/oaMessage/%40867domoo/?" + encodeURIComponent("結果アップグレード");
export const LINE_UPGRADE_CANCEL = "アップグレードを中止";

export const LINE_UPGRADE_INTRO = "来てくれてありがとう🌙 あなたのことをもう少し知りたいから、5つだけ聞かせてね。短い答えでも、ゆっくり話してくれても大丈夫だよ。";
export const LINE_UPGRADE_RESUME = "おかえりなさい🌷 これまでに話してくれたことは保存してあるから、続きから聞かせてね。";
export const LINE_UPGRADE_CANCELLED = "うん、ここで中止しておくね🌿 また話したくなったら「結果アップグレード」と送ってね。続きから再開できるよ。";

export function lineUpgradeQuestion(index: number): string {
  return `質問 ${index + 1}/${RESULT_UPGRADE_QUESTIONS.length}\n${RESULT_UPGRADE_COPY.ja.questionMessages[index]} ${["🌿", "✨", "🌷", "💗", "🌙"][index]}\n\nあなたの言葉で教えてね。ひとことでも大丈夫だよ（${LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH}文字以内）。`;
}

export function lineUpgradePurchaseMessage(paid = false): string {
  return paid
    ? "5つのお話、聞かせてくれてありがとう✨ 追加のお支払いはいらないよ。下のリンクから、あなた専用の結果づくりを続けよう。"
    : `5つのお話、聞かせてくれてありがとう✨ あなたの答えをもとに、専用キャラクター・専用タイプ名・自己診断結果・5章の鑑定書をつくるよ。\n\n結果のアップグレードは通常価格¥${LINE_RESULT_UPGRADE_LIST_PRICE_JPY.toLocaleString("ja-JP")}のところ、¥${LINE_RESULT_UPGRADE_COUPON_JPY}のクーポンが使えるから、お支払いは¥${RESULT_UPGRADE_PRICE_JPY}の買い切りだよ！30日間の返金保証があるから、満足しなかったら連絡してね！`;
}
