// TikTok広告 (Spark Ads) コンバージョン計測用の広告クリックパラメータ永続化。
//
// 背景: 広告クリックで付与される ttclid が診断完了ページまでの遷移で失われ、
//   TikTok ピクセルの Lead イベントに突合キーが乗らない (EMQ 38点・email 0%)。
//   着地時に localStorage へ保存し、diagnosis_complete の dataLayer push に添付する。
//
// ⚠️ wt_acq_source / wt_acq_campaign (src/lib/acquisition.ts, first-touch・
//    promote系UTM集計) とは別系統。こちらは広告最適化用の last-touch:
//    追跡パラメータを1つでも含む着地は「新しいクリック」とみなし、
//    セット全体を置き換える (別キャンペーンの値が混ざり残らないように)。
//
// 注: 実際の「着地時キャプチャ」は app/layout.tsx のインラインスクリプト
//    (AD_CLICK_CAPTURE_SCRIPT) で同期的に行う。本モジュールは読み出しと
//    メールハッシュ化のみ。保存キーはインラインスクリプトと一致させること。

export const AD_TTCLID_KEY = "wt_ad_ttclid";
export const AD_UTM_KEYS = {
  utm_source: "wt_ad_utm_source",
  utm_medium: "wt_ad_utm_medium",
  utm_campaign: "wt_ad_utm_campaign",
  utm_content: "wt_ad_utm_content",
} as const;

export interface AdAttribution {
  ttclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
}

/** localStorage に保存済みの広告クリックパラメータを読む (無ければ全て null)。 */
export function readAdAttribution(): AdAttribution {
  try {
    return {
      ttclid: localStorage.getItem(AD_TTCLID_KEY),
      utmSource: localStorage.getItem(AD_UTM_KEYS.utm_source),
      utmMedium: localStorage.getItem(AD_UTM_KEYS.utm_medium),
      utmCampaign: localStorage.getItem(AD_UTM_KEYS.utm_campaign),
      utmContent: localStorage.getItem(AD_UTM_KEYS.utm_content),
    };
  } catch {
    return {
      ttclid: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
    };
  }
}

/**
 * メールアドレスの SHA-256 ハッシュ (hex 小文字)。TikTok の Advanced Matching
 * 仕様に合わせ、trim + 小文字化してからハッシュ化する。生のメールを
 * dataLayer に乗せないための前処理。Web Crypto 非対応環境では null。
 */
export async function hashEmailSha256(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalized),
    );
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}
