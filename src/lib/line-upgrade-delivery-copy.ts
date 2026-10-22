import type { LineOutgoingMessage } from "@/lib/line";

export const LINE_UPGRADE_PAID_MESSAGE = "お支払いを確認したよ🌙 あなた専用のキャラクターと鑑定書を作成中だよ。完成したら、このLINEに届けるね。画面を閉じて待っていて大丈夫だよ🌿";

export function lineUpgradeDeliveryMessages(input: {
  characterUrl: string; previewUrl: string; readingUrl: string;
}): LineOutgoingMessage[] {
  return [
    { type: "text", text: "ありがとう！できあがったよ✨ あなたのお話から生まれた、世界にひとつのキャラクターと鑑定書をお届けするね🌷" },
    { type: "image", originalContentUrl: input.characterUrl, previewImageUrl: input.previewUrl },
    { type: "text", text: `あなた専用の鑑定書もできあがったよ🌷 下のリンクから、ゆっくり読んでみてね。\n\n${input.readingUrl}` },
  ];
}
