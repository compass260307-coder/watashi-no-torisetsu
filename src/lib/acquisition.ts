// Day 12-C3: SNS媒体別＋キャンペーン別の「新規ユーザー流入元」first-touch 計測。
//
// ⚠️ users.source_user_id / generation (人単位のバイラル招待ツリー) とは別物。
//    あちらは「誰の招待で来たか」、こちらは「どの媒体/投稿で来たか」。
//
// 取得ルール:
//   - source   : utm_source を優先、なければ ref
//   - campaign : utm_campaign を優先、なければ camp
//   - first-touch: 一度 localStorage に入った値は上書きしない。
//   - 保存キー: wt_acq_source / wt_acq_campaign。
//
// 注: 実際の「着地時キャプチャ」は app/layout.tsx 先頭のインラインスクリプトで
//     同期的に行う (描画最上流 / モーダル・リダイレクトより前)。本モジュールは
//     その読み出し (readAcquisition) と、送客リンク用の encode/decode を担う。
//     ロジックはインラインスクリプトと同義 (二重管理だが、最上流同期実行のため
//     インライン版が必要)。

import { readAdAttribution } from "@/lib/ad-attribution";

export const ACQ_SOURCE_KEY = "wt_acq_source";
export const ACQ_CAMPAIGN_KEY = "wt_acq_campaign";

export interface Acquisition {
  source: string | null;
  campaign: string | null;
}

/** utm_source 優先 / なければ ref、utm_campaign 優先 / なければ camp。 */
export function pickAcquisition(params: URLSearchParams): Acquisition {
  return {
    source: params.get("utm_source") || params.get("ref"),
    campaign: params.get("utm_campaign") || params.get("camp"),
  };
}

/**
 * URL の search 文字列から媒体/キャンペーンを抽出。
 * LIFF は通常クエリを落とすため、直接クエリに無ければ liff.state / state に
 * 退避された元クエリも見る (取りこぼし対策)。
 */
export function parseAcquisitionFromSearch(search: string): Acquisition {
  const params = new URLSearchParams(search);
  const direct = pickAcquisition(params);
  if (direct.source || direct.campaign) return direct;

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

/** first-touch 保存: 既に値があるキーは上書きしない。 */
export function saveFirstTouchAcquisition(acq: Acquisition): void {
  try {
    if (acq.source && !localStorage.getItem(ACQ_SOURCE_KEY)) {
      localStorage.setItem(ACQ_SOURCE_KEY, acq.source);
    }
    if (acq.campaign && !localStorage.getItem(ACQ_CAMPAIGN_KEY)) {
      localStorage.setItem(ACQ_CAMPAIGN_KEY, acq.campaign);
    }
  } catch {
    // localStorage 不可 (プライベートモード / SSR) は無視
  }
}

/** localStorage に保存済みの first-touch 値を読む (insert 時に使用)。 */
export function readAcquisition(): Acquisition {
  try {
    return {
      source: localStorage.getItem(ACQ_SOURCE_KEY),
      campaign: localStorage.getItem(ACQ_CAMPAIGN_KEY),
    };
  } catch {
    return { source: null, campaign: null };
  }
}

/**
 * 診断完了レコード保存用の流入元解決 (2026-08-15)。
 * TikTok広告等で utm がURL遷移で失われ「直接/不明」になるのを減らすため、
 * 広告クリック時に保存した last-touch 値 (wt_ad_utm_*) までフォールバックする。
 *
 * 優先順 (層ごと採用: 値のある最初の層から source/campaign をセットで取る。
 * 項目別に混ぜると「instagram × 広告キャンペーン名」のような別流入の
 * 組み合わせが集計に混入するため):
 *   ① 現在URLのクエリ (utm_source/ref・utm_campaign/camp。liff.state 退避も見る)
 *   ② first-touch 保存値 (wt_acq_* = 従来の読み出し先)
 *      → 従来値が付くレコードは①②で決まり、結果が変わらない (集計互換)
 *   ③ 広告クリック last-touch 保存値 (wt_ad_utm_source / wt_ad_utm_campaign)
 *   ④ ttclid 推定: 広告クリックID (wt_ad_ttclid) があれば source='tiktok'。
 *      utm 未設定の広告でも有料クリックと確定できるため、リファラーより優先。
 *      ttclid の値自体は Supabase に保存しない (TikTok送信専用)。
 *   ⑤ リファラー補完: 着地時に保存した外部 referrer ホスト (wt_ref_host) を
 *      source 名に変換 (google / tiktok / instagram 等。未知ホストは素のホスト名)。
 * ⑤まで無ければ null (= 従来どおり「直接/不明」扱い)。
 * ④⑤は campaign を付けない (どのキャンペーンかは特定できないため null)。
 */
export function resolveAcquisitionForSave(search: string): Acquisition {
  const fromUrl = parseAcquisitionFromSearch(search);
  if (fromUrl.source || fromUrl.campaign) return fromUrl;
  const firstTouch = readAcquisition();
  if (firstTouch.source || firstTouch.campaign) return firstTouch;
  const ad = readAdAttribution();
  if (ad.utmSource || ad.utmCampaign) {
    return { source: ad.utmSource, campaign: ad.utmCampaign };
  }
  if (ad.ttclid) return { source: "tiktok", campaign: null };
  return { source: sourceFromReferrerHost(readReferrerHost()), campaign: null };
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
  return p.toString();
}
