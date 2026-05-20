// T2-9 補助: テスト用 user_id / line_user_id を 1 件取得
// LIFF 認可をバイパスして Stripe trigger で擬似決済するため。
//
// 実行: npx tsx scripts/find-test-account.ts

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

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabase-server");

  // line_user_id が NULL でなく、users に紐付いている候補を取る
  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("id, display_name, type_id, line_user_id, owner_token, created_at")
    .not("type_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }

  console.log("=== users (最新 10 件) ===");
  for (const u of users ?? []) {
    console.log(
      `  id=${u.id} | name=${u.display_name ?? "(no name)"} | type=${u.type_id} | line_user_id=${u.line_user_id ?? "NULL"} | created=${u.created_at}`,
    );
  }

  // line_users 経由でも line_user_id を引く
  console.log("\n=== line_users (最新 10 件) ===");
  const { data: lineUsers } = await supabaseAdmin
    .from("line_users")
    .select("line_user_id, owner_token, current_owner_token, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  for (const lu of lineUsers ?? []) {
    console.log(
      `  line_user_id=${lu.line_user_id} | current_owner_token=${lu.current_owner_token ?? lu.owner_token}`,
    );
  }

  // 推奨ターゲット (users.line_user_id が直接ある最新行)
  const candidate = (users ?? []).find((u) => u.line_user_id);
  if (candidate) {
    console.log("\n=== T2-9 用おすすめターゲット ===");
    console.log(`  user_id:      ${candidate.id}`);
    console.log(`  line_user_id: ${candidate.line_user_id}`);
    console.log(`  display_name: ${candidate.display_name ?? "(no name)"}`);
  } else {
    // line_users 経由で fallback
    const lu = lineUsers?.[0];
    const u = users?.[0];
    if (lu && u) {
      console.log("\n=== T2-9 用おすすめターゲット (line_users 経由) ===");
      console.log(`  user_id:      ${u.id} (users.line_user_id は NULL)`);
      console.log(`  line_user_id: ${lu.line_user_id}`);
    }
  }

  // perception 0 件想定で十分。perception 込みなら下記参照:
  const { data: ps } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id, target_user_id, perceiver_name")
    .limit(5);
  console.log("\n=== 参考: friend_perceptions (5 件) ===");
  for (const p of ps ?? []) {
    console.log(
      `  id=${p.id} target=${p.target_user_id} perceiver=${p.perceiver_name}`,
    );
  }
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
