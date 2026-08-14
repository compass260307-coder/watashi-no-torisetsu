// feature flag utilities
//
// 厳格 string 比較 ("true" のみ true、それ以外は false) で、
// 想定外の値 ("True" / "TRUE" / "1" 等) はすべて OFF 扱いとする (fail-safe)。

/**
 * 32 タイプ本文 (N 軸差分) が有効か。
 *
 * off (未設定/false): 従来 16 タイプ表示のまま。
 * on (true): /me の自己診断本文を 32 タイプで出し分ける。
 */
export function isThirtyTwoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_THIRTYTWO_ENABLED === "true";
}
