// Phase 3-β リリース 3 C-5: AI 統合トリセツのコスト計算ヘルパー
// プレミアム化 v2 (Week 1 T1-1): Opus 4.7 をデフォルトに切替、Haiku 4.5 は後方互換のため残置
//
// 単価はハードコード (論点 4 (a) 採用)。料金改定時はこのファイルだけ更新。
// 過去の integrated_trisetsu.ai_cost_usd 行は記録時点の料金で固定されるため、
// 後追いの単価変更で履歴が崩れる懸念は β版段階では許容。

export const AI_MODEL_DEFAULT = "claude-opus-4-7";

type CostRate = {
  inputPerMtokUsd: number;
  outputPerMtokUsd: number;
};

// Anthropic 公式料金 (要定期確認、改定時にここを更新)
// https://www.anthropic.com/pricing
const COST_RATES: Record<string, CostRate> = {
  // Opus 4.7 (プレミアム版デフォルト、5,000-6,000 字生成想定で ~$0.36/回)
  "claude-opus-4-7": {
    inputPerMtokUsd: 15.0,
    outputPerMtokUsd: 75.0,
  },
  // Haiku 4.5 (後方互換、過去の integrated_trisetsu レコードのコスト計算用)
  "claude-haiku-4-5-20251001": {
    inputPerMtokUsd: 0.8,
    outputPerMtokUsd: 4.0,
  },
};

// 未登録モデルは現行デフォルト (Opus 4.7) 相当にフォールバック。
// 安価モデルにフォールバックすると未知モデルのコストを過小評価する恐れがあるため、
// 現行デフォルトに揃えて過大計上側に倒す。
const FALLBACK_RATE: CostRate = {
  inputPerMtokUsd: 15.0,
  outputPerMtokUsd: 75.0,
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
