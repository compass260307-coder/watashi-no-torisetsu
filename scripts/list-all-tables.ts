// T3-1 補助: information_schema から public スキーマの全テーブル一覧 + 行数を取得

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

  // PostgREST 経由で information_schema を直接叩けない (RPC が必要)
  // 代わりに supabase-js の rpc を使う or 各テーブルを順に試す
  // ここでは Postgres の pg_tables を直接読みに行く RPC を試す
  // ※ RPC 未定義環境では失敗するので、その場合は手動列挙にフォールバック

  // 試行 1: PostgREST が public スキーマのテーブル定義を露出していないため
  // supabaseAdmin.from は使えない。RPC 'list_public_tables' を呼ぶ前提だが
  // 未定義のため、ここでは仮設定の RPC 名で試す
  console.log("=== 試行: RPC list_public_tables ===");
  const rpc = await supabaseAdmin.rpc("list_public_tables" as never);
  console.log("rpc.data:", rpc.data);
  console.log("rpc.error:", rpc.error?.message);

  // 試行 2: 既知マイグレーション一覧から推測 (確実)
  // phase-3b-release-1-foundations.sql に登場するテーブル名を全部リスト
  console.log("\n=== Phase 3-β + premium-v2 マイグレーション登場テーブル ===");
  const KNOWN = [
    "users", "line_users", "friend_answers", "friend_perceptions",
    "integrated_trisetsu", "payment_history", "notification_preferences",
    "line_messages_sent", "events",
  ];
  for (const t of KNOWN) {
    try {
      const { count, error } = await supabaseAdmin
        .from(t)
        .select("*", { count: "exact", head: true });
      if (error) console.log(`  ${t.padEnd(28)} ERR ${error.code}`);
      else console.log(`  ${t.padEnd(28)} count=${count}`);
    } catch (err) {
      console.log(`  ${t.padEnd(28)} EX ${err}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
