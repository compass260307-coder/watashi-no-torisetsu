// Phase 3-β リリース 3 C-2: Anthropic Claude API クライアント (統合トリセツ用)
// プレミアム化 v2 (Week 1 T1-3):
//   - max_tokens 1500 → 16000 (5,000-6,000 字 + JSON 構造のオーバーヘッド対応)
//   - レスポンスを 7 章構成 JSON (title / subtitle / chapters x 7) に対応
//   - JSON パース・スキーマ検証失敗時のみ最大 2 回リトライ + 指数バックオフ (1s, 2s)
//   - ネットワーク / 401 / 429 / 500 等の SDK エラーは即時 throw (二重課金回避)

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

// 7 章のキー (計画書 § 5 と完全一致、順序も維持)
export const CHAPTER_KEYS = [
  "essence",
  "multifacetedness",
  "hidden_self",
  "strengths_weaknesses",
  "relationships",
  "life_guidance",
  "message",
] as const;

export type ChapterKey = (typeof CHAPTER_KEYS)[number];

export type IntegratedChapter = {
  title: string;
  subtitle?: string; // "message" 章のみ subtitle 無し
  body: string;
};

export type IntegratedChapters = Record<ChapterKey, IntegratedChapter>;

export type IntegratedAiOutput = {
  title: string;
  subtitle: string;
  chapters: IntegratedChapters;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
};

// Opus 4.7 + 7 章 + JSON オーバーヘッドで安全な上限
// 詳細は docs/PREMIUM_PLAN.md § 4「max_tokens 拡張」参照
const MAX_TOKENS_DEFAULT = 16000;

// JSON / スキーマ失敗時のリトライ設定
const MAX_RETRIES = 2; // attempt 0 + 2 リトライ = 計 3 回試行
const BACKOFF_BASE_MS = 1000; // attempt 0 失敗後 1s, attempt 1 失敗後 2s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * Claude レスポンステキストから 7 章 JSON を抽出 + スキーマ検証。
 * 失敗時は AnthropicResponseParseError を throw (呼び出し側でリトライ判定)。
 */
function parseAndValidateChapters(text: string): {
  title: string;
  subtitle: string;
  chapters: IntegratedChapters;
} {
  // 最外周の { ... } を貪欲マッチ (Claude が前置きや末尾にテキストを付けても拾える)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AnthropicResponseParseError(
      "No JSON object found in response text",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new AnthropicResponseParseError(
      `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new AnthropicResponseParseError("Response root is not an object");
  }

  const root = parsed as Record<string, unknown>;
  const title = isNonEmptyString(root.title) ? root.title : "真のトリセツ";
  const subtitle = typeof root.subtitle === "string" ? root.subtitle : "";

  if (typeof root.chapters !== "object" || root.chapters === null) {
    throw new AnthropicResponseParseError("Missing or invalid 'chapters' object");
  }

  const chaptersRaw = root.chapters as Record<string, unknown>;
  const chapters = {} as IntegratedChapters;

  for (const key of CHAPTER_KEYS) {
    const ch = chaptersRaw[key];
    if (typeof ch !== "object" || ch === null) {
      throw new AnthropicResponseParseError(
        `Missing chapter '${key}' (must be object)`,
      );
    }
    const obj = ch as Record<string, unknown>;
    if (!isNonEmptyString(obj.title)) {
      throw new AnthropicResponseParseError(
        `Chapter '${key}' is missing non-empty 'title'`,
      );
    }
    if (!isNonEmptyString(obj.body)) {
      throw new AnthropicResponseParseError(
        `Chapter '${key}' is missing non-empty 'body'`,
      );
    }
    chapters[key] = {
      title: obj.title,
      subtitle: typeof obj.subtitle === "string" ? obj.subtitle : undefined,
      body: obj.body,
    };
  }

  return { title, subtitle, chapters };
}

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

  // attempt = 0..MAX_RETRIES。パース/スキーマ系のみリトライ。
  // 各リトライ前に指数バックオフ (1s, 2s)。最終試行後はバックオフせず throw。
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // SDK 例外 (ネットワーク / 401 / 429 / 500 等) はリトライせず即時 throw。
    // → AI コストの二重課金を避けるため、再試行は呼び出し側 (Phase 2 で Cron 等) に委ねる。
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
    } else {
      try {
        const validated = parseAndValidateChapters(textBlock.text);
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        const costUsd = calculateCostUsd(model, inputTokens, outputTokens);
        return {
          title: validated.title,
          subtitle: validated.subtitle,
          chapters: validated.chapters,
          inputTokens,
          outputTokens,
          costUsd,
          model,
        };
      } catch (err) {
        if (err instanceof AnthropicResponseParseError) {
          lastParseError = err;
        } else {
          // 想定外エラーは即時 throw
          throw err;
        }
      }
    }

    // パース系失敗だった場合、次のリトライがあるならバックオフ
    if (attempt < MAX_RETRIES) {
      await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
    }
  }

  throw (
    lastParseError ??
    new AnthropicResponseParseError("Failed to parse Claude response")
  );
}
