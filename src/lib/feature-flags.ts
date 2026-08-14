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

// 韓国語「運命の設計図」の公開フラグ。
//
// - ローカル `next dev`: 未設定なら確認しやすいよう公開
// - Production / Preview build: 未設定なら非公開
// - 再公開: Vercel に NEXT_PUBLIC_KO_UNMEI_ENABLED=true を設定して再デプロイ
//
// クライアントの料金UIとサーバーのページ・Checkoutで同じ値を使い、
// ページだけ閉じたままプレミアム商品を販売する不整合を防ぐ。
export const KO_UNMEI_ENABLED =
  process.env.NEXT_PUBLIC_KO_UNMEI_ENABLED === "true" ||
  (process.env.NEXT_PUBLIC_KO_UNMEI_ENABLED === undefined &&
    process.env.NODE_ENV === "development");
