// 結果ページの「共通の見出し + タイプ別の結論の一行 + 本文」形式の項目。
// 見出しはロック中にぼかして敷いている見本と同じ文言、lead と本文がタイプ別。
// 表示は components/result/ResultItemGrid。

export type ResultItem = {
  /** 全タイプ共通の問い (ロック中の見本と同じ文言)。 */
  heading: string;
  /** そのタイプだけの結論の一行。 */
  lead: string;
  body: string;
};

/** 見出しとタイプ別の本文を組み合わせる。本文が未登録・数が合わないときは undefined。 */
export function zipResultItems(
  headings: readonly string[],
  items: readonly { lead: string; body: string }[] | undefined,
): ResultItem[] | undefined {
  if (!items || items.length !== headings.length) return undefined;
  return headings.map((heading, i) => ({
    heading,
    lead: items[i].lead,
    body: items[i].body,
  }));
}
