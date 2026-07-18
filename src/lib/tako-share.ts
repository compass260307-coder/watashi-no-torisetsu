// /tako ロック中ゲートの招待シェア文面 & LINE 送信URL。
//   送信シート (TakoSendSheet) と、CTA の JS 無しフォールバック href の両方で使うため、
//   重いコンポーネントに依存せずここに切り出す(TakoSendSheet を dynamic import しても
//   この定数/ヘルパは軽量ライブラリ側から参照できる)。

import { withRef } from "./acquisition-link";

export const SHARE_TEXT =
  "友達から見たわたしを教えて！「ワタシのトリセツ」で友達診断テストができるよ";

/** LINE トークに文面+招待URLを流し込む送信URL (a要素の href で JS 無しでも起動できる)。 */
export function lineShareUrl(
  inviteUrl: string,
  shareText: string = SHARE_TEXT,
): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(
    `${shareText} ${withRef(inviteUrl, "line")}`,
  )}`;
}
