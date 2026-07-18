// Phase 1.5-α Day 12-B 事前調査 (補足版): 関連テーブルの規模感
// READ のみ実行。
//
// 実行: npx tsx scripts/day12b-investigate-perceptions.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const t = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const l of t.split(/\r?\n/)) {
    const e = l.indexOf("=");
    if (e < 0 || l.startsWith("#")) continue;
    let v = l.slice(e + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(l.slice(0, e).trim() in process.env)) process.env[l.slice(0, e).trim()] = v;
  }
}
loadEnvLocal();

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabase-server");

  console.log("===== Day 12-B 事前調査: 関連テーブルの規模感 =====\n");

  // 各テーブルの件数
  const TABLES = [
    "users",
    "friend_perceptions",
    "friend_answers",
    "integrated_trisetsu",
    "payment_history",
    "magic_links",
  ];
  for (const t of TABLES) {
    const { count, error } = await supabaseAdmin
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ${t.padEnd(24)} ERROR ${error.code} ${error.message}`);
    } else {
      console.log(`  ${t.padEnd(24)} ${count} 件`);
    }
  }

  // users の作成日時範囲
  console.log("\n===== users 作成日時範囲 (テスト/本番の境界判定) =====");
  const { data: uOldest } = await supabaseAdmin
    .from("users")
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1);
  const { data: uNewest } = await supabaseAdmin
    .from("users")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (uOldest?.[0]) console.log(`最古: ${uOldest[0].created_at}`);
  if (uNewest?.[0]) console.log(`最新: ${uNewest[0].created_at}`);

  // users.scores の入り具合 (Big Five 構造把握、self-diagnosis 側の参考)
  console.log("\n===== users.scores の構造サンプル =====");
  const { data: usersWithScores } = await supabaseAdmin
    .from("users")
    .select("id, type_id, scores, created_at")
    .not("scores", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);
  for (const u of usersWithScores ?? []) {
    console.log(`  type_id=${u.type_id} created=${u.created_at}`);
    console.log(`    scores: ${JSON.stringify(u.scores).slice(0, 200)}`);
  }

  // friend_answers の構造サンプル
  console.log("\n===== friend_answers サンプル (perception の Big Five 復元可能性) =====");
  const { data: faSample } = await supabaseAdmin
    .from("friend_answers")
    .select("*")
    .limit(2);
  if (faSample && faSample.length > 0) {
    console.log(`列名: ${Object.keys(faSample[0]).join(", ")}`);
    for (const f of faSample) {
      console.log(`  ${JSON.stringify(f).slice(0, 250)}`);
    }
  } else {
    console.log("(0 件)");
  }

  // payment_history の構造サンプル (¥500 課金履歴)
  console.log("\n===== payment_history サンプル =====");
  const { data: phSample } = await supabaseAdmin
    .from("payment_history")
    .select("*")
    .limit(2);
  if (phSample && phSample.length > 0) {
    console.log(`列名: ${Object.keys(phSample[0]).join(", ")}`);
    for (const p of phSample) {
      console.log(`  ${JSON.stringify(p).slice(0, 250)}`);
    }
  } else {
    console.log("(0 件)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
