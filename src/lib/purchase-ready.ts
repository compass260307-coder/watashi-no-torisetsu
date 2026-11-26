// 完全版 (日本語 Web) を /me 以外のページから買った人の中継ページ (/purchase-ready) 用。
//
// 2026-11-26 の数時間だけ、友達診断ページ・相性診断・星読み・タロット・運命の設計図から買った人を
// Stripe からいったん /purchase-ready に戻し、準備画面のあとで元の戻り先へ送っていた。
// 同日の本人指示で、どのページから買っても自己診断結果ページ (/me) に直接戻すことにしたので、
// 新しい決済ページはこの中継を通らない。切り替え前に作られた決済ページから戻る人のために、
// 戻り先の確かめだけを残す (確かめられないときの送り先に使う)。

// 中継してよい戻り先 (日本語版の、/me 以外の完全版の戻り先)。外のサイトや別のページへは送らない。
const NEXT_PATH_PATTERN =
  /^\/(?:aisho|hoshiyomi|unmei|tarot|tako\/[A-Za-z0-9_-]+)\?[A-Za-z0-9_\-=&%.]*$/;

/** 中継ページ用: ?next= を確かめ、session_id を付けた元の戻り先を返す。不正なら null。 */
export function purchaseReadyDestination(next: unknown, sessionId: string): string | null {
  if (typeof next !== "string" || !NEXT_PATH_PATTERN.test(next)) return null;
  const joiner = next.endsWith("?") || next.endsWith("&") ? "" : "&";
  return `${next}${joiner}session_id=${encodeURIComponent(sessionId)}`;
}
