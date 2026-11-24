// 友達診断ページ (/tako/[token]) へ「どの入口から来たか」を残すための印。
//
// 入口のリンクに ?from=<入口> を付け、ページ側の TakoViewTracker が
// tako_viewed の metadata.entry に載せる。どの入口が到達を生んでいるかを
// 見分けるための計測で、見た目と遷移先は変えない (2026-11-24)。
// 印が無い到達 (ブックマーク・再読み込み・未対応のリンク) は "none" になる。

export const TAKO_ENTRY_PARAM = "from";

export const TAKO_ENTRIES = [
  "me_pill", // 自己診断結果 ①の横の「友達と答え合わせ」
  "me_friend_section", // 自己診断結果 ⑥注意点のあとの「友達に診断してもらう」
  "me_sticky_header", // 自己診断結果 上部の固定ヘッダーの丸ボタン
  "nav", // 下のメニューの「友達診断」 (赤い印の有無は attentionPending で分かる)
  "top_header", // トップなどの上部メニュー
  "top_footer", // トップなどのフッター
  "line", // LINE のメッセージ内リンク
] as const;

export type TakoEntry = (typeof TAKO_ENTRIES)[number];

/** 友達診断ページへのリンクに入口の印を付ける。 */
export function withTakoEntry(href: string, entry: TakoEntry): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${TAKO_ENTRY_PARAM}=${entry}`;
}

/** 到達したURLの検索文字列から入口を読む。知らない値は記録しない ("other")。 */
export function readTakoEntry(search: string): string {
  const params = new URLSearchParams(search);
  const from = params.get(TAKO_ENTRY_PARAM);
  if (from) {
    return (TAKO_ENTRIES as readonly string[]).includes(from) ? from : "other";
  }
  // 決済画面から戻ってきたとき (create-full-access-session の success_url)。
  if (params.get("paid") === "1") return "checkout_return";
  return "none";
}
