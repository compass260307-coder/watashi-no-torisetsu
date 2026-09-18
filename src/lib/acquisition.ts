// Day 12-C3: SNS媒体別＋キャンペーン別の「新規ユーザー流入元」first-touch 計測。
//
// ⚠️ users.source_user_id / generation (人単位のバイラル招待ツリー) とは別物。
//    あちらは「誰の招待で来たか」、こちらは「どの媒体/投稿で来たか」。
//
// 取得ルール:
//   - source   : utm_source を優先、なければ ref
//   - campaign : utm_campaign を優先、なければ camp
//   - medium   : utm_medium。TikTok広告と確定できる場合だけ paid_social を補完。
//   - first-touch: source/campaign/mediumを一組として固定。
//   - 保存キー: wt_acq_source / wt_acq_campaign / wt_acq_medium。
//
// 注: 実際の「着地時キャプチャ」は app/layout.tsx 先頭のインラインスクリプトで
//     同期的に行う (描画最上流 / モーダル・リダイレクトより前)。本モジュールは
//     その読み出し (readAcquisition) と、送客リンク用の encode/decode を担う。
//     ロジックはインラインスクリプトと同義 (二重管理だが、最上流同期実行のため
//     インライン版が必要)。

import { readAdAttribution } from "@/lib/ad-attribution";

export const ACQ_SOURCE_KEY = "wt_acq_source";
export const ACQ_CAMPAIGN_KEY = "wt_acq_campaign";
export const ACQ_MEDIUM_KEY = "wt_acq_medium";
export const ACQ_TOUCH_KEY = "wt_acq_touch_v2";
export const ACQ_SESSION_KEY = "wt_acq_session_v2";

export interface Acquisition {
  source: string | null;
  campaign: string | null;
  medium?: string | null;
}

/** TikTokのcampaign/ttclid付き流入は広告と確定できるため、medium欠損を補完する。 */
export function normalizeAcquisitionMedium(
  acq: Acquisition,
  hasTikTokClickId = false,
): Acquisition {
  const source = acq.source?.trim() || null;
  const campaign = acq.campaign?.trim() || null;
  const medium = acq.medium?.trim() || null;
  return {
    source,
    campaign,
    medium:
      medium ||
      (source?.toLowerCase() === "tiktok" &&
      (campaign !== null || hasTikTokClickId)
        ? "paid_social"
        : null),
  };
}

/** utm_source 優先 / なければ ref、utm_campaign 優先 / なければ camp。 */
export function pickAcquisition(params: URLSearchParams): Acquisition {
  return normalizeAcquisitionMedium({
    source: params.get("utm_source") || params.get("ref"),
    campaign: params.get("utm_campaign") || params.get("camp"),
    medium: params.get("utm_medium"),
  }, Boolean(params.get("ttclid")));
}

/**
 * URL の search 文字列から媒体/キャンペーンを抽出。
 * LIFF は通常クエリを落とすため、直接クエリに無ければ liff.state / state に
 * 退避された元クエリも見る (取りこぼし対策)。
 */
export function parseAcquisitionFromSearch(search: string): Acquisition {
  const params = new URLSearchParams(search);
  const direct = pickAcquisition(params);
  if (direct.source || direct.campaign || direct.medium) return direct;

  const state = params.get("liff.state") || params.get("state");
  if (!state) return direct;
  try {
    const decoded = decodeURIComponent(state);
    const qIdx = decoded.indexOf("?");
    const inner = new URLSearchParams(
      qIdx >= 0 ? decoded.slice(qIdx + 1) : decoded,
    );
    return pickAcquisition(inner);
  } catch {
    return direct;
  }
}

/** first-touch は欠損も含む一組として固定。旧保存値に後日のmediumを継ぎ足さない。 */
export function saveFirstTouchAcquisition(acq: Acquisition): void {
  try {
    if (localStorage.getItem(ACQ_TOUCH_KEY) ||
        localStorage.getItem(ACQ_SOURCE_KEY) || localStorage.getItem(ACQ_CAMPAIGN_KEY)) return;
    if (!acq.source && !acq.campaign && !acq.medium) return;
    // markerを先に書く。途中失敗でも異なる着地の値を継ぎ足さない。
    localStorage.setItem(ACQ_TOUCH_KEY, "1");
    if (acq.source) localStorage.setItem(ACQ_SOURCE_KEY, acq.source);
    if (acq.campaign) localStorage.setItem(ACQ_CAMPAIGN_KEY, acq.campaign);
    if (acq.medium) localStorage.setItem(ACQ_MEDIUM_KEY, acq.medium);
  } catch {
    // 保存不可の場合も診断を継続する。
  }
}

/** localStorage に保存済みの first-touch 値を読む。 */
export function readAcquisition(): Acquisition {
  try {
    return normalizeAcquisitionMedium({
      source: localStorage.getItem(ACQ_SOURCE_KEY),
      campaign: localStorage.getItem(ACQ_CAMPAIGN_KEY),
      medium: localStorage.getItem(ACQ_TOUCH_KEY) ? localStorage.getItem(ACQ_MEDIUM_KEY) : null,
    });
  } catch {
    return { source: null, campaign: null, medium: null };
  }
}

/**
 * 診断完了レコード保存用の流入元解決 (2026-08-15)。
 * TikTok広告等で utm がURL遷移で失われ「直接/不明」になるのを減らすため、
 * 広告クリック時に保存した last-touch 値 (wt_ad_utm_*) までフォールバックする。
 *
 * 優先順 (層ごと採用: 値のある最初の層から source/campaign/medium をセットで取る。
 * 項目別に混ぜると「instagram × 広告キャンペーン名」のような別流入の
 * 組み合わせが集計に混入するため):
 *   ① 現在URLのクエリ (utm_source/ref・utm_campaign/camp。liff.state 退避も見る)
 *   ② 同じタブで保存した着地URLの組 (sessionStorage。①の遷移後も維持)
 *   ③ first-touch 保存値 (wt_acq_* = 従来の読み出し先)
 *      → 旧保存値は維持し、欠けたmediumを別の流入から補完しない。
 *   ④ 広告クリック last-touch 保存値 (wt_ad_utm_source / wt_ad_utm_campaign)
 *   ⑤ ttclid 推定: 広告クリックID (wt_ad_ttclid) があれば
 *      source='tiktok' / medium='paid_social'。
 *      utm 未設定の広告でも有料クリックと確定できるため、リファラーより優先。
 *      ttclid の値自体は Supabase に保存しない (TikTok送信専用)。
 *   ⑥ リファラー補完: 着地時に保存した外部 referrer ホスト (wt_ref_host) を
 *      source 名に変換 (google / tiktok / instagram 等。未知ホストは素のホスト名)。
 * ⑥まで無ければ null (= 従来どおり「直接/不明」扱い)。
 * ⑤は広告と確定できるためmediumを補完し、⑥は推定しない。
 * campaign はどのキャンペーンか特定できないため null。
 */
export function resolveAcquisitionForSave(search: string): Acquisition {
  const fromUrl = parseAcquisitionFromSearch(search);
  if (fromUrl.source || fromUrl.campaign || fromUrl.medium) {
    try { sessionStorage.setItem(ACQ_SESSION_KEY, JSON.stringify(fromUrl)); } catch { /* 保存不可 */ }
    saveFirstTouchAcquisition(fromUrl);
    return fromUrl;
  }
  // 着地URLの優先権を同じタブの遷移・リロードでも保持する。
  try {
    const saved = JSON.parse(sessionStorage.getItem(ACQ_SESSION_KEY) || "null");
    if (saved && [saved.source, saved.campaign, saved.medium].every(
      (value) => value == null || typeof value === "string",
    ) && (saved.source || saved.campaign || saved.medium)) {
      return normalizeAcquisitionMedium({ source: saved.source ?? null, campaign: saved.campaign ?? null, medium: saved.medium ?? null });
    }
  } catch { /* 保存不可・破損時は既存のfallbackへ */ }
  const firstTouch = readAcquisition();
  if (firstTouch.source || firstTouch.campaign || firstTouch.medium) return firstTouch;
  const ad = readAdAttribution();
  if (ad.utmSource || ad.utmCampaign || ad.utmMedium) {
    return normalizeAcquisitionMedium(
      { source: ad.utmSource, campaign: ad.utmCampaign, medium: ad.utmMedium },
      Boolean(ad.ttclid),
    );
  }
  if (ad.ttclid) return { source: "tiktok", campaign: null, medium: "paid_social" };
  return { source: sourceFromReferrerHost(readReferrerHost()), campaign: null, medium: null };
}

// ---- リファラー補完 (2026-08-15) ----
// 着地時キャプチャは app/layout.tsx の REFERRER_CAPTURE_SCRIPT (first-touch・
// 外部ホストのみ・自ドメイン除外)。ここは読み出しと source 名への変換のみ。

export const REF_HOST_KEY = "wt_ref_host";

/** localStorage に保存済みの外部 referrer ホスト名を読む (無ければ null)。 */
export function readReferrerHost(): string | null {
  try {
    return localStorage.getItem(REF_HOST_KEY);
  } catch {
    return null;
  }
}

/**
 * referrer ホスト名 → 集計上の source 名。既知サービスは既存 taxonomy に
 * 揃えた短い名前へ、未知ホストは www. 等を落とした素のホスト名のまま返す
 * (既存値に "chatgpt.com" の前例あり)。utm 由来の値と campaign の有無で
 * 区別できる (リファラー由来は campaign が常に null)。
 */
export function sourceFromReferrerHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.toLowerCase().replace(/^(www|m|l|lm|touch)\./, "");
  if (h === "t.co" || h === "x.com" || h.endsWith("twitter.com")) return "x";
  if (h.endsWith("tiktok.com")) return "tiktok";
  if (h.endsWith("instagram.com")) return "instagram";
  if (h.endsWith("facebook.com") || h === "fb.com") return "facebook";
  if (h.endsWith("youtube.com") || h === "youtu.be") return "youtube";
  if (h.endsWith("line.me") || h.endsWith("line-apps.com")) return "line";
  if (h.endsWith("threads.net") || h.endsWith("threads.com")) return "threads";
  if (h === "google.com" || h.endsWith(".google.com") || /^google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h)) {
    return "google";
  }
  if (h.endsWith("yahoo.co.jp") || h.endsWith("yahoo.com")) return "yahoo";
  if (h.endsWith("bing.com")) return "bing";
  if (h.endsWith("duckduckgo.com")) return "duckduckgo";
  if (h.endsWith("naver.com")) return "naver";
  if (h.endsWith("daum.net")) return "daum";
  return h;
}

/**
 * 送客リンク (LINE/LIFF) 用: source/campaign を liff.state に載せるための
 * クエリ片を返す。LIFF はクエリを落とすので、LINE に飛ばすリンク側で
 *   https://liff.line.me/{id}?liff.state=${encodeURIComponent('?' + encodeAcquisitionState(acq))}
 * の形で埋め込めば、LIFF endpoint (本アプリ先頭スクリプト) が復元する。
 *
 * 例: encodeAcquisitionState({ source: "line", campaign: "rich_menu" })
 *     => "utm_source=line&utm_campaign=rich_menu"
 */
export function encodeAcquisitionState(acq: Acquisition): string {
  const p = new URLSearchParams();
  if (acq.source) p.set("utm_source", acq.source);
  if (acq.campaign) p.set("utm_campaign", acq.campaign);
  if (acq.medium) p.set("utm_medium", acq.medium);
  return p.toString();
}
