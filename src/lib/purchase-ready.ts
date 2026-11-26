// 完全版 (日本語 Web) を買ったあと、/me 以外のページへ戻る購入にも準備画面を出すための中継。
//
// 背景 (2026-11-26 本人指示): 準備画面 (PurchaseLoadingScreen) は /me に戻る購入にしか出なかった。
//   友達診断ページ・相性診断・星読み・タロット・運命の設計図から買った人は元のページへ戻るので、
//   Stripe からいったん /purchase-ready に戻し、準備画面を20秒見せてから元の戻り先へ送る。
//   戻り先には今までと同じ ?paid=1&session_id= (運命の設計図は ?checkout=success) を付けるので、
//   戻り先のページの反映待ち・購入計測は今までどおり動く。
//
// /me に戻る購入はこの中継を通さない (MeResultPage が準備画面を直接出す)。

const SESSION_ID_PLACEHOLDER = "session_id={CHECKOUT_SESSION_ID}";

// 中継してよい戻り先 (日本語版の、/me 以外の完全版の戻り先)。外のサイトや別のページへは送らない。
const NEXT_PATH_PATTERN =
  /^\/(?:aisho|hoshiyomi|unmei|tarot|tako\/[A-Za-z0-9_-]+)\?[A-Za-z0-9_\-=&%.]*$/;

/**
 * Stripe の success_url 用: 元の戻り先 (末尾が session_id={CHECKOUT_SESSION_ID}) を、
 * 準備画面の中継ページ経由にしたパスへ書き換える。書き換えられない形なら null。
 */
export function purchaseReadySuccessPath(successPath: string): string | null {
  if (!successPath.endsWith(SESSION_ID_PLACEHOLDER)) return null;
  // 例: "/tako/abc?paid=1&" / "/unmei?checkout=success&"
  const next = successPath.slice(0, -SESSION_ID_PLACEHOLDER.length);
  if (!NEXT_PATH_PATTERN.test(next)) return null;
  return `/purchase-ready?next=${encodeURIComponent(next)}&${SESSION_ID_PLACEHOLDER}`;
}

/** 中継ページ用: ?next= を確かめ、session_id を付けた元の戻り先を返す。不正なら null。 */
export function purchaseReadyDestination(next: unknown, sessionId: string): string | null {
  if (typeof next !== "string" || !NEXT_PATH_PATTERN.test(next)) return null;
  const joiner = next.endsWith("?") || next.endsWith("&") ? "" : "&";
  return `${next}${joiner}session_id=${encodeURIComponent(sessionId)}`;
}
