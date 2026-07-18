// T3-1 補助: 全テーブル一覧と行数を取得（リセット対象/除外の判断材料）

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const t = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const l of t.split(/\r?\n/)) {
    const e = l.indexOf("=");
    if (e < 0 || l.startsWith("#")) continue;
    let v = l.slice(e + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(l.slice(0, e).trim() in process.env)) process.env[l.slice(0, e).trim()] = v;
  }
}
loadEnvLocal();

// 既知のアプリケーション系テーブル候補 (Phase 3-β リリース 1 の migration から)
const KNOWN_TABLES = [
  "users",
  "line_users",
  "friend_answers",
  "friend_perceptions",
  "integrated_trisetsu",
  "payment_history",
  "notification_preferences",
  "line_messages_sent",
  "events",
  // big_five など潜在的マスタ
  "big_five_results",
  "big_five_questions",
];

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabase-server");
  console.log("=== 既知候補テーブルの行数 ===");
  for (const t of KNOWN_TABLES) {
    try {
      const { count, error } = await supabaseAdmin
        .from(t)
        .select("*", { count: "exact", head: true });
      if (error) {
        console.log(`  ${t.padEnd(28)}  ERROR: ${error.code}/${error.message?.slice(0, 60)}`);
      } else {
        console.log(`  ${t.padEnd(28)}  count=${count}`);
      }
    } catch (err) {
      console.log(
        `  ${t.padEnd(28)}  EXCEPTION: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
