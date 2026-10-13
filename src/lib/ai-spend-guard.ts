export type AiSpendBlockCode = "budget_exceeded" | "insufficient_funds";

// Allow time for an operator's budget/credit change to propagate before one
// explicit recovery attempt. Elapsed time alone never starts another AI call.
export const AI_SPEND_RETRY_DELAY_MS = 5 * 60_000;
const SPEND_ERROR_PREFIX = "ai_spend_blocked:";

export function aiSpendBlockCode(error: unknown): AiSpendBlockCode | null {
  const seen = new Set<unknown>();
  function inspect(value: unknown, depth: number): AiSpendBlockCode | null {
    if (depth > 6 || value == null || seen.has(value)) return null;
    seen.add(value);
    if (typeof value === "string") {
      if (
        value.includes("quota_for_entity_exceeded") ||
        value.includes(`${SPEND_ERROR_PREFIX}budget_exceeded`) ||
        /(?:project|team|user|api[- ]key) budget exceeded/i.test(value)
      ) return "budget_exceeded";
      if (
        value.includes("insufficient_funds") ||
        value.includes(`${SPEND_ERROR_PREFIX}insufficient_funds`) ||
        /insufficient (?:funds|credits)/i.test(value)
      ) return "insufficient_funds";
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const code = inspect(item, depth + 1);
        if (code) return code;
      }
    } else if (typeof value === "object") {
      const object = value as Record<string, unknown>;
      for (const key of ["code", "type", "message", "error", "cause", "errors", "responseBody", "data"]) {
        const code = inspect(object[key], depth + 1);
        if (code) return code;
      }
    }
    return null;
  }
  return inspect(error, 0);
}

export function storedGenerationError(error: unknown): string {
  const code = aiSpendBlockCode(error);
  // Store a stable, non-sensitive reason rather than a provider's billing link.
  if (code) return `${SPEND_ERROR_PREFIX}${code}`;
  return error instanceof Error ? error.message.slice(0, 500) : "generation failed";
}

export function aiSpendRetryAt(updatedAt: string): string | null {
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp)
    ? new Date(timestamp + AI_SPEND_RETRY_DELAY_MS).toISOString()
    : null;
}

export function resultUpgradeSpendBlock(
  row: { state: string; last_error: string | null; updated_at: string },
  now = Date.now(),
) {
  const code = row.state === "failed" ? aiSpendBlockCode(row.last_error) : null;
  if (!code) return null;
  const retryAt = aiSpendRetryAt(row.updated_at);
  return { code, retryAt, canRetry: retryAt !== null && now >= Date.parse(retryAt) };
}

/**
 * Gateway quota errors can be surfaced as HTTP 500 in AI SDK 7. Mark only
 * identified spend rejections as 402 so the SDK does not retry them. Preserve
 * normal provider errors and the SDK's transient-error retry policy.
 */
export const fetchWithAiSpendGuard: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.ok || (response.status !== 402 && response.status < 500)) return response;
  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    return response;
  }
  if (!aiSpendBlockCode(payload)) return response;
  return new Response(response.body, {
    status: 402,
    statusText: "Payment Required",
    headers: response.headers,
  });
};
