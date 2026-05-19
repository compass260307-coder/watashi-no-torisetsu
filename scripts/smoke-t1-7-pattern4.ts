// プレミアム化 v2 Week 1 T1-7 パターン 4 疎通テスト
// 「友達のみ・自己評価なし」(include_self=false) での AI 統合トリセツ生成。
// perception: ユウキ (繊細系) + ヒロ (実家系)。selfData は与えない。
//
// 実行: npx tsx scripts/smoke-t1-7-pattern4.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  const { buildIntegratedPrompt } = await import("../src/lib/ai-prompt-builder");
  const { callClaudeForIntegration, CHAPTER_KEYS } = await import(
    "../src/lib/anthropic-client"
  );

  const prompt = buildIntegratedPrompt({
    ownerName: "ハルカ",
    includeSelf: false,
    // selfData は undefined のまま (include_self=false)
    perceptions: [
      {
        perceiverName: "ユウキ",
        perceivedFullCode: "EAO-c-n",
        perceivedTypeName: "好奇心旺盛な共感者",
        perceivedModifierLabel: "繊細系",
        perceivedScores: { E: 6.8, A: 8.5, O: 8.7, C: 5.2, N: 4.0 },
        perceivedFacetScores: {
          E_assertiveness: 5.5,
          E_warmth: 8.0,
          A_cooperation: 8.5,
          A_sympathy: 8.5,
          O_adventurousness: 8.0,
          O_imagination: 8.9,
          C_achievement: 5.5,
          C_orderliness: 5.0,
          N_volatility: 3.8,
          N_anxiety: 4.2,
        },
        perceivedModifierParagraph:
          "ユウキから見ると、ハルカは感情に振り回されず、落ち着いて自分のペースを保てる人。相談すると安心して話せる、頼れる存在。",
        extraQuestions: {
          favoritePoint: "相談に乗ってくれるときの、ふっと肩の力が抜ける安心感",
          animal: "ねこ",
        },
      },
      {
        perceiverName: "ヒロ",
        perceivedFullCode: "eAO-c-N",
        perceivedTypeName: "好奇心旺盛な共感者",
        perceivedModifierLabel: "実家系",
        perceivedScores: { E: 4.5, A: 7.8, O: 9.2, C: 4.3, N: 6.5 },
        perceivedFacetScores: {
          E_assertiveness: 4.0,
          E_warmth: 7.5,
          A_cooperation: 7.5,
          A_sympathy: 8.0,
          O_adventurousness: 9.5,
          O_imagination: 9.0,
          C_achievement: 4.5,
          C_orderliness: 4.0,
          N_volatility: 6.0,
          N_anxiety: 7.0,
        },
        perceivedModifierParagraph:
          "ヒロから見ると、ハルカは静かに自分の世界を持っている人。無理に話さなくても気まずくない、思索的でひとり時間を大切にする人。",
        extraQuestions: {
          animal: "フクロウ",
          impressionScene: "夜の喫茶店で、誰とも喋らず本を読んでいる横顔",
        },
      },
    ],
  });

  console.log("=== 疎通テスト T1-7 パターン 4: 友達のみ (include_self=false) ===");
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
    console.log(
      `  ${key.padEnd(22)} ${String(len).padStart(4)} 字 (目安 ${lo}-${hi}) ${inRange}`,
    );
  }
  console.log(`  ${"合計".padEnd(22)} ${totalLen} 字 (参考、目安 4900-5900)`);

  console.log("\n--- 第一章 (本質) 冒頭 200 字 ---");
  console.log(
    "  " +
      (out.chapters.essence?.body ?? "").replace(/\s+/g, " ").slice(0, 200) +
      "...",
  );

  console.log("\n--- 第三章 (気づきにくい自分) 冒頭 200 字 ---");
  console.log(
    "  " +
      (out.chapters.hidden_self?.body ?? "").replace(/\s+/g, " ").slice(0, 200) +
      "...",
  );

  console.log("\n=== 疎通テスト完了 ===");
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
