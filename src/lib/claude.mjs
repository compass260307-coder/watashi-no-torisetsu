// Claude Messages API クライアント (最小・raw HTTP)。
//
// ⚠️ 旧実装は廃止済みの /v1/complete (text completions) を叩いており、
//   claude-sonnet-4-6 等のモダンモデルでは一切動作しなかった。
//   → Messages API (/v1/messages) に修正。system プロンプト対応。
//
// 認可: x-api-key (CLAUDE_API_KEY、後方互換で ANTHROPIC_API_KEY も可)。
// モデル: CLAUDE_MODEL (例 claude-sonnet-4-6)。

const ANTHROPIC_VERSION = "2023-06-01";

export async function callClaude({
  system,
  prompt,
  model = process.env.CLAUDE_MODEL,
  maxTokens = 1500,
  temperature = 0.6,
  timeoutMs = 60_000,
}) {
  const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY not set");
  if (!model) throw new Error("CLAUDE_MODEL not set");

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: prompt }],
  };
  if (system) body.system = system;

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
