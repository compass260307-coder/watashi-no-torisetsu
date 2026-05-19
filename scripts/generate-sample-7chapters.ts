// プレミアム化 v2 Week 1 T1-8 補助: 7 章サンプル JSON 生成スクリプト
// T1-7 パターン 3 v2 と同じ入力で AI 呼び出しを行い、結果を JSON に保存。
// PDF プロトタイプの test-pdf エンドポイントが読み込んでレンダリングする。
//
// 実行: npx tsx scripts/generate-sample-7chapters.ts
// 出力: scripts/sample-7chapters.json
// コスト: 約 ¥61 (Opus 4.7)

import { readFileSync, writeFileSync } from "node:fs";
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
  const { callClaudeForIntegration } = await import("../src/lib/anthropic-client");

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
      {
        perceiverName: "アヤ",
        perceivedFullCode: "EAO-C-n",
        perceivedTypeName: "好奇心旺盛な共感者",
        perceivedModifierLabel: "自由系",
        perceivedScores: { E: 8.0, A: 7.5, O: 9.5, C: 5.5, N: 5.0 },
        perceivedFacetScores: {
          E_assertiveness: 7.5,
          E_warmth: 8.0,
          A_cooperation: 7.0,
          A_sympathy: 7.8,
          O_adventurousness: 9.8,
          O_imagination: 9.2,
          C_achievement: 6.0,
          C_orderliness: 4.5,
          N_volatility: 5.5,
          N_anxiety: 4.5,
        },
        perceivedModifierParagraph:
          "アヤから見ると、ハルカはいつも新しいことを探してる、止まらない人。一緒にいると毎回どこか面白い場所に連れていかれる、軽快な冒険者。",
        extraQuestions: {
          favoritePoint: "「これ面白そう」と思った瞬間の、目の輝き",
          impressionScene:
            "初めて会った日、いきなり地元の人しか知らない路地裏のお店に連れていってくれた",
        },
      },
    ],
  });

  console.log("AI 呼び出し開始 (約 90-110 秒、コスト 約 ¥61)...");
  const t0 = Date.now();
  const out = await callClaudeForIntegration({
    system: prompt.system,
    user: prompt.user,
  });
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`完走 ${elapsedSec} 秒, cost USD ${out.costUsd}`);

  const outputPath = resolve(process.cwd(), "scripts/sample-7chapters.json");
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        ownerName: "ハルカ",
        title: out.title,
        subtitle: out.subtitle,
        generatedAt: new Date().toISOString(),
        chapters: out.chapters,
        meta: {
          model: out.model,
          inputTokens: out.inputTokens,
          outputTokens: out.outputTokens,
          costUsd: out.costUsd,
          elapsedSec: Number(elapsedSec),
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`保存: ${outputPath}`);

  // 章ごとの文字数も表示
  console.log("\n--- 章ごとの本文長 ---");
  let total = 0;
  for (const [key, ch] of Object.entries(out.chapters)) {
    const len = ch.body.length;
    total += len;
    console.log(`  ${key.padEnd(22)} ${String(len).padStart(4)} 字`);
  }
  console.log(`  ${"合計".padEnd(22)} ${total} 字`);
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
