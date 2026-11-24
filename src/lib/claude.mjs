// Claude Messages API クライアント (最小・raw HTTP)。
//
// ⚠️ 旧実装は廃止済みの /v1/complete (text completions) を叩いており、
//   claude-sonnet-4-6 等のモダンモデルでは一切動作しなかった。
//   → Messages API (/v1/messages) に修正。system プロンプト対応。
//
// 認可: x-api-key (CLAUDE_API_KEY、後方互換で ANTHROPIC_API_KEY も可)。
// モデル: CLAUDE_MODEL (例 claude-sonnet-4-6)。
//
// cacheSystem: true で system をプロンプトキャッシュ対象にする (5分TTL)。
//   同一 system で5分以内に再呼び出しされるチャット用途で入力コストを削減できる。
//   キャッシュ書き込みは通常の1.25倍のため、一発生成系では有効化しないこと。
//   効果は raw.usage.cache_read_input_tokens / cache_creation_input_tokens で確認する。

const ANTHROPIC_VERSION = "2023-06-01";

// Claude 5 世代 (Haiku 5.5 / Sonnet 5.5 / Opus 5 系 / Fable / Mythos) は temperature 等の
// 既定外の値を 400 で拒否するため、これらのモデルでは temperature を送らない。
const REJECTS_SAMPLING_PARAMS = /^claude-(haiku-5|sonnet-5|opus-5|fable|mythos)/;

export function modelAcceptsTemperature(model) {
  return !REJECTS_SAMPLING_PARAMS.test(String(model ?? ""));
}

// 推論 (thinking) を使わない一発生成用の設定。Claude 5 世代は既定で推論が有効になり、
// その分も出力トークンとして課金されるため明示的に止める。4.x 以前は既定で無効なので送らない。
//   - Haiku 5.5 / Opus 5: { type: "disabled" }
//   - Sonnet 5.5: disabled は 400 のため { type: "between_tools" }
export function noThinkingConfig(model) {
  const id = String(model ?? "");
  if (/^claude-sonnet-5-5/.test(id)) return { type: "between_tools" };
  if (/^claude-(haiku-5|opus-5(?!-5)|sonnet-5(?!-5))/.test(id)) {
    return { type: "disabled" };
  }
  return undefined;
}

export async function callClaude({
  system,
  prompt,
  model = process.env.CLAUDE_MODEL,
  maxTokens = 1500,
  temperature = 0.6,
  timeoutMs = 60_000,
  cacheSystem = false,
  thinking = undefined,
}) {
  const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY not set");
  if (!model) throw new Error("CLAUDE_MODEL not set");

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (temperature !== undefined && modelAcceptsTemperature(model)) {
    body.temperature = temperature;
  }
  if (thinking) body.thinking = thinking;
  if (system) {
    body.system = cacheSystem
      ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
      : system;
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`claude api error ${res.status}: ${t}`);
    }
    const json = await res.json();
    // content は blocks 配列。text ブロックを連結する。
    const text = Array.isArray(json.content)
      ? json.content
          .filter((b) => b && b.type === "text" && typeof b.text === "string")
          .map((b) => b.text)
          .join("")
      : null;
    return { raw: json, text };
  } finally {
    clearTimeout(id);
  }
}
