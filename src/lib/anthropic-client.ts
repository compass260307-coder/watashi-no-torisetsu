// Phase 3-β リリース 3 C-2: Anthropic Claude API クライアント (統合トリセツ用)
//
// callClaudeForIntegration:
//   - system / user プロンプトを受けて Claude messages API を呼ぶ
//   - JSON 抽出失敗時のみ 1 回リトライ
//   - 結果は { title, summary, body, inputTokens, outputTokens, costUsd, model }
//   - API キー未設定時は AnthropicNotConfiguredError を throw

import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_DEFAULT, calculateCostUsd } from "./ai-cost";

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY not set");
    this.name = "AnthropicNotConfiguredError";
  }
}

export class AnthropicResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnthropicResponseParseError";
  }
}

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!cachedClient) cachedClient = new Anthropic({ apiKey: key });
  return cachedClient;
}

export type IntegratedAiOutput = {
  title: string;
  summary: string;
  body: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
};

const MAX_TOKENS_DEFAULT = 1500;

export async function callClaudeForIntegration(args: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<IntegratedAiOutput> {
  const client = getClient();
  if (!client) throw new AnthropicNotConfiguredError();

  const model = args.model ?? AI_MODEL_DEFAULT;
  const maxTokens = args.maxTokens ?? MAX_TOKENS_DEFAULT;

  let lastParseError: AnthropicResponseParseError | null = null;

  // JSON 抽出失敗時のみ 1 回リトライ。
  // ネットワーク / 401 / レート制限等の SDK エラーは throw でそのまま伝播。
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      lastParseError = new AnthropicResponseParseError(
        "No text content in Claude response",
      );
      continue;
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      lastParseError = new AnthropicResponseParseError(
        "No JSON object found in response text",
      );
      continue;
    }

    let parsed: { title?: unknown; summary?: unknown; body?: unknown };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      lastParseError = new AnthropicResponseParseError(
        `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    if (typeof parsed.body !== "string" || parsed.body.length === 0) {
      lastParseError = new AnthropicResponseParseError(
        "Missing or empty body in JSON response",
      );
      continue;
    }

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = calculateCostUsd(model, inputTokens, outputTokens);

    return {
      title:
        typeof parsed.title === "string" && parsed.title.length > 0
          ? parsed.title
          : "真のトリセツ",
      summary:
        typeof parsed.summary === "string" ? parsed.summary : "",
      body: parsed.body,
      inputTokens,
      outputTokens,
      costUsd,
      model,
    };
  }

  throw (
    lastParseError ??
    new AnthropicResponseParseError("Failed to parse Claude response")
  );
}
