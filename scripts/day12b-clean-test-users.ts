// Phase 1.5-α Day 12-B: 本番クリーンスタート
// 開発者セルフテストの users 2 件を削除 → 全関連テーブル 0 件確認
//
// 削除前後で件数を表示。FK ON DELETE CASCADE により以下も自動削除:
//   - magic_links (user_id CASCADE)
//   - payment_history (user_id CASCADE)
//   - friend_perceptions (target_user_id CASCADE、perceiver_user_id SET NULL)
//   - integrated_trisetsu (user_id CASCADE)
//   - friend_answers 等の他 user_id 参照 (該当時)
//
// 実行: npx tsx scripts/day12b-clean-test-users.ts
//
// 本スクリプトは ad-hoc (本 PR では commit しない)。一回限りのクリーンアップ。

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

const TABLES = [
  "users",
  "friend_perceptions",
  "friend_answers",
  "integrated_trisetsu",
  "payment_history",
  "magic_links",
];

async function countAll(label: string, supabaseAdmin: any) {
  console.log(`\n===== ${label} =====`);
  for (const t of TABLES) {
    const { count, error } = await supabaseAdmin
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ${t.padEnd(24)} ERROR ${error.code}`);
    } else {
      console.log(`  ${t.padEnd(24)} ${count} 件`);
    }
  }
}

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabase-server");

  // ===== 1. 削除前の件数 =====
  await countAll("削除前の件数", supabaseAdmin);

  // ===== 2. 削除対象 users を特定 + 表示 =====
  const { data: targets, error: selErr } = await supabaseAdmin
    .from("users")
    .select("id, type_id, display_name, created_at")
    .order("created_at", { ascending: true });
  if (selErr) {
    console.error("users select error:", selErr);
    process.exit(1);
  }
  console.log("\n===== 削除対象 users =====");
  for (const u of targets ?? []) {
    console.log(
      `  id=${u.id} type=${u.type_id} name=${u.display_name ?? "<null>"} created=${u.created_at}`,
    );
  }

  if (!targets || targets.length === 0) {
    console.log("\n→ users 0 件、削除不要。終了。");
    return;
  }

  // ===== 3. 削除実行 (全 users 対象、CASCADE で関連も消える) =====
  const ids = targets.map((u: { id: string }) => u.id);
  console.log(`\n===== DELETE 実行 (${ids.length} 件、CASCADE) =====`);
  const { error: delErr, count: delCount } = await supabaseAdmin
    .from("users")
    .delete({ count: "exact" })
    .in("id", ids);
  if (delErr) {
    console.error("DELETE error:", delErr);
    process.exit(1);
  }
  console.log(`削除完了: ${delCount} 件`);

  // ===== 4. 削除後の件数 (全テーブルが 0 になっているはず) =====
  await countAll("削除後の件数", supabaseAdmin);

  console.log(
    "\n→ クリーンスタート達成。次は migration を Supabase Dashboard で実行。",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
