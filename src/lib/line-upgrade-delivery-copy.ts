import type { LineOutgoingMessage } from "@/lib/line";

export const LINE_UPGRADE_PAID_MESSAGE = "お支払いありがとう🌙 あなた専用のキャラクターと鑑定書をつくるね。完成したら、このLINEに届けるよ。画面を閉じて待っていて大丈夫だよ。";

export function lineUpgradeDeliveryMessages(input: {
  characterUrl: string; previewUrl: string; readingUrl: string;
}): LineOutgoingMessage[] {
  return [
    { type: "text", text: "できたよ✨ あなたのお話から生まれた、世界にひとつのキャラクターを届けるね。" },
    { type: "image", originalContentUrl: input.characterUrl, previewImageUrl: input.previewUrl },
    { type: "text", text: `あなた専用の鑑定書もできあがったよ🌷 下のリンクから、ゆっくり読んでみてね。\n\n${input.readingUrl}` },
  ];
}
