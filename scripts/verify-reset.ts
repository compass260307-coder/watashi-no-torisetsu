// T3-1 補助: リセット前後の状態確認
//
// 使い方:
//   実行前: npx tsx scripts/verify-reset.ts before  → 件数記録
//   実行後: npx tsx scripts/verify-reset.ts after   → 全 0 件 + スキーマ確認

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

const TARGET_TABLES = [
  "users",
  "line_users",
  "friend_answers",
  "friend_perceptions",
  "integrated_trisetsu",
  "payment_history",
  "notification_preferences",
  "line_messages_sent",
  "feature_optins",
  "events",
];

async function main() {
  const mode = process.argv[2] === "after" ? "after" : "before";
  const { supabaseAdmin } = await import("../src/lib/supabase-server");

  console.log(`=== TRUNCATE ${mode} ===`);
  let totalRows = 0;
  for (const t of TARGET_TABLES) {
    const { count, error } = await supabaseAdmin
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ${t.padEnd(28)} ERR ${error.code}/${error.message?.slice(0, 50)}`);
      continue;
    }
    const c = count ?? 0;
    totalRows += c;
    const marker = mode === "after" ? (c === 0 ? "✓" : "❌") : "";
    console.log(`  ${t.padEnd(28)} count=${String(c).padStart(5)} ${marker}`);
  }
  console.log(`  ${"TOTAL".padEnd(28)} ${totalRows}`);

  if (mode === "after") {
    if (totalRows === 0) {
      console.log("\n✅ 全テーブル 0 件、リセット成功");
    } else {
      console.log("\n❌ 一部テーブルにデータ残存、再確認必要");
    }

    // スキーマ無事チェック (列存在確認)
    console.log("\n=== スキーマ無事チェック (主要列の SELECT が通るか) ===");
    const schemaProbes: Array<{ table: string; columns: string }> = [
      { table: "integrated_trisetsu", columns: "id, status, generated_chapters, payment_id, generated_subtitle" },
      { table: "friend_perceptions", columns: "id, pdf_consent, pdf_consent_at" },
      { table: "payment_history", columns: "id, stripe_session_id, status" },
    ];
    for (const probe of schemaProbes) {
      const { error } = await supabaseAdmin
        .from(probe.table)
        .select(probe.columns)
        .limit(0);
      const mark = error ? `❌ ${error.code}/${error.message?.slice(0, 60)}` : "✓";
      console.log(`  ${probe.table.padEnd(28)} cols [${probe.columns}] ${mark}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
