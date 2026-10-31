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
