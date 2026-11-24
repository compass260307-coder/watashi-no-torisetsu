// 広告・解析タグ (GTM 経由の GA4 / Meta / TikTok / X) と、サーバーからの
// 広告媒体 CV 送信 (Meta CAPI / TikTok Events API) を許可してよい環境かを判定する。
//
// 本番 (Vercel の next build / 実行時は NODE_ENV=production) では、新しい環境変数を
// 設定しなくても従来どおり true を返す。次のいずれかに当たる場合だけ false:
//   1. NODE_ENV が production 以外 (next dev)
//   2. NEXT_PUBLIC_DISABLE_THIRD_PARTY_MEASUREMENT=1 (ローカルの next build / next start 用)
//   3. 開発用 Supabase (watashi-dev) に接続している
//      (ローカル production ビルドで 2 を設定し忘れた場合の最終防御)
//
// クライアントでもビルド時に値が埋め込まれるよう、process.env.X を直接参照すること。

// 開発用 Supabase のプロジェクト ref。公開 URL の一部であり秘密情報ではない。
const DEV_SUPABASE_PROJECT_REFS = ["umhgnunxeupvxnrvatde"];

export function isThirdPartyMeasurementEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.NEXT_PUBLIC_DISABLE_THIRD_PARTY_MEASUREMENT === "1") {
    return false;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (
    DEV_SUPABASE_PROJECT_REFS.some((ref) =>
      supabaseUrl.includes(`${ref}.supabase.co`),
    )
  ) {
    return false;
  }
  return true;
}

// 社内向けページ (/internal/ 以下) では、広告・解析タグを読み込まない。社内の閲覧が
// 広告媒体や GA の計測に混ざらないようにし、数値画面を軽くするため (2026-11-24)。
// 静的に描画するページの共通レイアウトから使うので、判定はブラウザ側で行う
// (サーバーで URL を読むと、全ページが動的な描画になってしまう)。
export const MEASUREMENT_EXCLUDED_PATH = /^\/internal(\/|$)/;

/** ブラウザで実行するスクリプトに埋め込む判定式 (今の URL が社内向けページなら true)。 */
export const MEASUREMENT_EXCLUDED_PATH_JS = `${MEASUREMENT_EXCLUDED_PATH.toString()}.test(window.location.pathname)`;

export function isMeasurementExcludedPath(pathname: string): boolean {
  return MEASUREMENT_EXCLUDED_PATH.test(pathname);
}
