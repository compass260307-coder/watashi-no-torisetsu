// 友達診断 完全版レポート PDF の「ダウンロード中」をページ側で知るための共有定義。
//
// PDF は添付ファイルとして返るため、ボタンを押してもページは遷移せず、生成に
// 10〜20秒かかる間は何も起きていないように見える。その間に連打されると同じ PDF の
// 生成が重なり、一部が失敗していた (2026-11-21 本番で確認)。
//
// /tako-report/[token]/pdf は応答に短命 Cookie を付ける。ボタン側は押した時点で
// Cookie を消し、再び現れたら「応答が届いた」と判断して表示を戻す。値に意味はない。
// サーバー (route.ts) とクライアント (MeStickyHeader) の両方から読むので、
// サーバー専用・クライアント専用の API はここに置かない。

export const REPORT_PDF_DOWNLOAD_COOKIE = "wt_pdf_dl";

/** Cookie で完了を知らせる PDF ルート (/tako-report/[token]/pdf と各ロケール版) か。 */
export function isTakoReportPdfHref(href: string | undefined): boolean {
  return Boolean(href && /\/tako-report\/[^/?#]+\/pdf(?:[?#]|$)/.test(href));
}

export function hasReportPdfDownloadCookie(): boolean {
  return document.cookie
    .split("; ")
    .some((entry) => entry.startsWith(`${REPORT_PDF_DOWNLOAD_COOKIE}=`));
}

export function clearReportPdfDownloadCookie(): void {
  document.cookie = `${REPORT_PDF_DOWNLOAD_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
