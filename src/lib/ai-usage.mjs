const AI_USAGE_TABLE = "ai_usage_events";

let missingTableWarned = false;

function nonNegativeInteger(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function errorCode(error) {
  if (!error || typeof error !== "object") return null;
  if (typeof error.code === "string") return error.code.slice(0, 120);
  if (typeof error.status === "number") return `http_${error.status}`;
  if (typeof error.name === "string") return error.name.slice(0, 120);
  return null;
}

function isMissingTable(error) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes("42p01") ||
    text.includes("pgrst205") ||
    (text.includes(AI_USAGE_TABLE) && text.includes("not found"))
  );
}

export function anthropicUsage(raw) {
  const usage = raw?.usage;
  return {
    inputTokens: nonNegativeInteger(usage?.input_tokens),
    outputTokens: nonNegativeInteger(usage?.output_tokens),
    cacheReadInputTokens: nonNegativeInteger(usage?.cache_read_input_tokens),
    cacheWriteInputTokens: nonNegativeInteger(
      usage?.cache_creation_input_tokens,
    ),
  };
}

export function aiSdkUsage(usage) {
  return {
    inputTokens: nonNegativeInteger(usage?.inputTokens),
    outputTokens: nonNegativeInteger(usage?.outputTokens),
    cacheReadInputTokens: nonNegativeInteger(
      usage?.inputTokenDetails?.cacheReadTokens,
    ),
    cacheWriteInputTokens: nonNegativeInteger(
      usage?.inputTokenDetails?.cacheWriteTokens,
    ),
  };
}

export function gatewayGenerationId(providerMetadata) {
  const value = providerMetadata?.gateway?.generationId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * AI呼び出しの費用分析用イベントをbest-effortで保存する。
 * プロンプトや生成本文は受け取らず、個人情報をmetadataへ入れない。
 */
export async function recordAiUsage(supabaseAdmin, input) {
  const row = {
    user_id: input.userId ?? null,
    feature: String(input.feature),
    provider: String(input.provider),
    model: String(input.model || "unknown"),
    modality: input.modality === "image" ? "image" : "text",
    status: input.status === "failed" ? "failed" : "succeeded",
    generation_key: input.generationKey ?? null,
    attempt: Math.max(1, nonNegativeInteger(input.attempt) ?? 1),
    provider_request_id: input.providerRequestId
      ? String(input.providerRequestId).slice(0, 255)
      : input.error?.generationId
        ? String(input.error.generationId).slice(0, 255)
        : null,
    input_tokens: nonNegativeInteger(input.inputTokens),
    output_tokens: nonNegativeInteger(input.outputTokens),
    cache_read_input_tokens: nonNegativeInteger(input.cacheReadInputTokens),
    cache_write_input_tokens: nonNegativeInteger(input.cacheWriteInputTokens),
    image_count: nonNegativeInteger(input.imageCount) ?? 0,
    duration_ms: nonNegativeInteger(input.durationMs),
    estimated_cost_usd:
      typeof input.estimatedCostUsd === "number" &&
      Number.isFinite(input.estimatedCostUsd) &&
      input.estimatedCostUsd >= 0
        ? input.estimatedCostUsd
        : null,
    error_code: errorCode(input.error),
    metadata:
      input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };

  try {
    const { error } = await supabaseAdmin.from(AI_USAGE_TABLE).insert(row);
    if (!error) return;
    if (isMissingTable(error)) {
      if (!missingTableWarned) {
        missingTableWarned = true;
        console.warn(
          `[ai-usage] ${AI_USAGE_TABLE} migration is not applied; usage was not persisted`,
        );
      }
      return;
    }
    console.error("[ai-usage] insert failed", {
      code: error.code ?? null,
      message: error.message,
      feature: row.feature,
    });
  } catch (error) {
    console.error("[ai-usage] unexpected insert failure", {
      code: errorCode(error),
      feature: row.feature,
    });
  }
}
