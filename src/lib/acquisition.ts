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
