// プレミアム化 v2 Week 1 T1-7 パターン 1 疎通テスト
// 「自己評価のみ・perception 0 件」での AI 統合トリセツ生成を最小チェーンで叩く。
// LIFF / DB は介さない: buildIntegratedPrompt → callClaudeForIntegration のみ。
//
// 実行: npx tsx scripts/smoke-t1-7-pattern1.ts
// 前提: .env.local に ANTHROPIC_API_KEY が設定されていること。

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// .env.local の最小パーサ (dotenv 未導入のため自前)
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // 引用符を剥がす
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY not loaded from .env.local");
  process.exit(1);
}

async function main() {
// dynamic import で .env 注入後にモジュールをロード (副作用順序を担保)
const { buildIntegratedPrompt } = await import("../src/lib/ai-prompt-builder");
const { callClaudeForIntegration, CHAPTER_KEYS } = await import(
  "../src/lib/anthropic-client"
);

const prompt = buildIntegratedPrompt({
  ownerName: "ハルカ",
  includeSelf: true,
  selfData: {
    fullCode: "EAO-c-N",
    typeName: "好奇心旺盛な共感者",
    modifierLabel: "実家系",
    scores: { E: 7.2, A: 8.1, O: 9.0, C: 4.5, N: 6.8 },
    facetScores: {
      E_assertiveness: 6.0,
      E_warmth: 8.5,
      A_cooperation: 8.0,
      A_sympathy: 8.2,
      O_adventurousness: 9.2,
      O_imagination: 8.8,
      C_achievement: 5.0,
      C_orderliness: 4.0,
      N_volatility: 6.5,
      N_anxiety: 7.0,
    },
    modifierParagraph:
      "やさしくて温かい、でも一人時間も大事にしたい。新しいことには好奇心旺盛、計画より直感で動く傾向。",
  },
  perceptions: [],
});

console.log("=== 疎通テスト T1-7 パターン 1: 自己評価のみ ===");
console.log("system prompt length:", prompt.system.length);
console.log("user prompt length:", prompt.user.length);
console.log("AI 呼び出し開始...");

const t0 = Date.now();
const out = await callClaudeForIntegration({
  system: prompt.system,
  user: prompt.user,
});
const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);

console.log("\n--- 基本情報 ---");
console.log("完走時間:", elapsedSec, "秒");
console.log("model:", out.model);
console.log("input tokens:", out.inputTokens);
console.log("output tokens:", out.outputTokens);
console.log(
  "cost USD:",
  out.costUsd,
  "(≈ JPY",
  Math.round(out.costUsd * 150),
  ")",
);
console.log("title:", out.title);
console.log("subtitle:", out.subtitle);

console.log("\n--- 章ごとの本文長 ---");
const TARGETS: Record<string, [number, number]> = {
  essence: [800, 1000],
  multifacetedness: [700, 900],
  hidden_self: [700, 900],
  strengths_weaknesses: [800, 1000],
  relationships: [700, 900],
  life_guidance: [600, 800],
  message: [200, 400],
};
let totalLen = 0;
for (const key of CHAPTER_KEYS) {
  const ch = out.chapters[key];
  const len = ch?.body?.length ?? 0;
  totalLen += len;
  const [lo, hi] = TARGETS[key] ?? [0, 0];
  const inRange = len >= lo && len <= hi ? "✓" : len < lo ? "↓短い" : "↑長い";
  console.log(`  ${key.padEnd(22)} ${len} 字 (目安 ${lo}-${hi}) ${inRange}`);
}
console.log(`  ${"合計".padEnd(22)} ${totalLen} 字 (目安 4900-5900)`);

console.log("\n--- 各章 冒頭 150 字プレビュー ---");
for (const key of CHAPTER_KEYS) {
  const ch = out.chapters[key];
  console.log(`\n■ [${key}] ${ch?.title ?? "(no title)"}`);
  if (ch?.subtitle) console.log(`  〜 ${ch.subtitle} 〜`);
  const preview = (ch?.body ?? "").replace(/\s+/g, " ").slice(0, 150);
  console.log(`  ${preview}...`);
}

console.log("\n=== 疎通テスト完了 ===");
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
