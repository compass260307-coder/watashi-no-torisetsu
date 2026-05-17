// Phase 3-β リリース 3 C-5: AI 統合トリセツのコスト計算ヘルパー
//
// 単価はハードコード (論点 4 (a) 採用)。料金改定時はこのファイルだけ更新。
// 過去の integrated_trisetsu.ai_cost_usd 行は記録時点の料金で固定されるため、
// 後追いの単価変更で履歴が崩れる懸念は β版段階では許容。

export const AI_MODEL_DEFAULT = "claude-haiku-4-5-20251001";

type CostRate = {
  inputPerMtokUsd: number;
  outputPerMtokUsd: number;
};

// Anthropic 公式料金 (要定期確認、改定時にここを更新)
// https://www.anthropic.com/pricing
const COST_RATES: Record<string, CostRate> = {
  // Haiku 4.5 (想定料金、本番反映時に Anthropic 公式値で再確認)
  "claude-haiku-4-5-20251001": {
    inputPerMtokUsd: 0.8,
    outputPerMtokUsd: 4.0,
  },
};

// 未登録モデルは Haiku 相当 (誤計上を避けるため最も安全な低単価で代用しない)
const FALLBACK_RATE: CostRate = {
  inputPerMtokUsd: 0.8,
  outputPerMtokUsd: 4.0,
};

export function calculateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = COST_RATES[model] ?? FALLBACK_RATE;
  const inputCost = (inputTokens / 1_000_000) * rate.inputPerMtokUsd;
  const outputCost = (outputTokens / 1_000_000) * rate.outputPerMtokUsd;
  // 6 桁精度 (numeric(10,6) に合わせる)
  return Number((inputCost + outputCost).toFixed(6));
}
