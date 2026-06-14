// 相互理解度の本文を「評価者視点」に反転するユーティリティ。
//
// 本人ページ (/evaluate/result) の本文は「アナタ=評価される本人 / 相手=評価した友達」
// 前提 (主語省略・名前なし)。評価完了ページ (/evaluate/sent) は閲覧者が
// 「評価した友達(アナタ)」、対象が「評価された人(=targetName, 例: のすけ)」なので視点を
// 入れ替える:
//   - 「アナタ」(=対象者) → targetName (のすけ)
//   - 「相手」(=評価者)   → 「アナタ」(閲覧者)
//
// 実データ文字列に「友達」は出てこない (コメントのみ) ため対象外。
// プレースホルダ方式で双方向の衝突 (アナタ↔相手) を回避する。

// 本文(日本語)に絶対に出現しない ASCII センチネル。
const PLACEHOLDER = "__WTR_TARGET__";

/** owner視点の本文 → evaluator視点。targetName=対象者名(例「のすけ」)。 */
export function flipToEvaluatorView(text: string, targetName: string): string {
  return text
    .split("アナタ")
    .join(PLACEHOLDER) // 対象者 → 退避
    .split("この相手")
    .join("アナタ") // 「この相手の前で」等を先に処理
    .split("相手")
    .join("アナタ") // 評価者 → 閲覧者
    .split(PLACEHOLDER)
    .join(targetName); // 退避した対象者 → 名前
}
