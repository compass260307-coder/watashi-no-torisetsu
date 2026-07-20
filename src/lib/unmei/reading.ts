// natal_readings の「有効な鑑定」判定 (single source of truth)。
//
// 有効 = 実際にAIが生成した本文 (sections 配列) を持つキャッシュ。
// 以下はすべて「無効(=再生成対象)」として扱う:
//   - 未生成 (行なし) / model が 'pending' / 'local-placeholder'
//   - 旧ダミー: generated_from === 'not-implemented'(エフェメリス未計算のフォールバック)
//   - sections を持たない(旧 summary ダミー等)
export function isReadingReady(
  row: { model?: string | null; reading?: unknown } | null | undefined,
): boolean {
  if (!row) return false;
  const model = row.model;
  if (!model || model === "pending" || model === "local-placeholder") {
    return false;
  }
  const r = row.reading as
    | { sections?: unknown; generated_from?: unknown }
    | null
    | undefined;
  if (!r || typeof r !== "object") return false;
  if ((r as { generated_from?: unknown }).generated_from === "not-implemented") {
    return false;
  }
  const sections = (r as { sections?: unknown }).sections;
  return Array.isArray(sections) && sections.length > 0;
}
