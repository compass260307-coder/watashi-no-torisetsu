// feature flag utilities
//
// 厳格 string 比較 ("true" のみ true、それ以外は false) で、
// 想定外の値 ("True" / "TRUE" / "1" 等) はすべて OFF 扱いとする (fail-safe)。

/**
 * 32 タイプ本文 (N 軸差分) が有効か。
 *
 * off (未設定/false): 従来 16 タイプ表示のまま (本番現状)。
 * on (true): /me の ① 自己診断本文を 32 タイプ (O/C/E/A + N) で出し分ける。
 *   ※ 型名・キャラ画像は 16 のまま据え置き (本文のみ 32 化)。
 *
 * NEXT_PUBLIC_ プレフィックスでビルド時にインライン化され、
 * サーバ / クライアント両方から参照できる。
 */
export function isThirtyTwoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_THIRTYTWO_ENABLED === "true";
}
