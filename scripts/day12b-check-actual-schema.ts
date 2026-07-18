// Phase 1.5-α Day 12-B: friend_perceptions の実テーブル列を確認
// writeFriendPerception が perceived_scores / perceived_facet_scores を INSERT しようと
// しているが、リポジトリの supabase/migrations/* には該当 ALTER が無い。
// 実テーブルに既存するか確認 (本番に未追跡の migration が当たっている可能性)。

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

  // 1. test INSERT を試して列の存在を確認 (即 rollback したいので transaction を…
  //    と思いきや PostgREST は transaction を直接使えない。代わりに dummy データを
  //    INSERT して、その直後に DELETE する戦略を取る)
  //
  // ただしテスト前に users 0 件なので target_user_id を作れない。
  // → 別の方法: 列の存在は PostgREST のスキーマキャッシュから推測できる。
  //    .select("perceived_scores") を投げて column not found エラーが返るかで判定。

  console.log("===== test 1: SELECT perceived_scores (列の存在確認) =====");
  const test1 = await supabaseAdmin
    .from("friend_perceptions")
    .select("perceived_scores, perceived_facet_scores")
    .limit(1);
  if (test1.error) {
    console.log(`ERROR ${test1.error.code}: ${test1.error.message}`);
    console.log("→ perceived_scores / perceived_facet_scores は存在しない可能性");
  } else {
    console.log("OK: 列が存在 (実テーブルに既に追加されている)");
    console.log(`返却: ${JSON.stringify(test1.data)}`);
  }

  console.log("\n===== test 2: SELECT * (列名一覧の取得試行) =====");
  // 0 件なので返ってこないが、エラーメッセージから情報が得られるかも
  const test2 = await supabaseAdmin
    .from("friend_perceptions")
    .select("*")
    .limit(1);
  if (test2.error) {
    console.log(`ERROR: ${test2.error.message}`);
  } else {
    console.log(`返却 (0 件想定): ${JSON.stringify(test2.data)}`);
    // 0 件なので列名は分からないが、エラー無しなら friend_perceptions 自体は存在
  }

  // 3. 列名を全部試して存在チェック (片端から SELECT)
  console.log("\n===== test 3: 主要列の存在を 1 つずつ確認 =====");
  const SUSPECT_COLS = [
    "id",
    "target_user_id",
    "perceiver_name",
    "perceiver_user_id",
    "perceiver_line_user_id",
    "perceived_type_id",
    "perceived_modifier_c_f",
    "perceived_modifier_n_r",
    "perceived_full_code",
    "perceived_modifier_label",
    "perceived_modifier_paragraph",
    "perceived_scores",
    "perceived_facet_scores",
    "qualitative_data",
    "friend_answer_id",
    "pdf_consent",
    "pdf_consent_at",
    "pdf_consent_revoked_at",
    "notified_at",
    "created_at",
  ];
  for (const col of SUSPECT_COLS) {
    const r = await supabaseAdmin
      .from("friend_perceptions")
      .select(col)
      .limit(1);
    if (r.error) {
      console.log(`  ✗ ${col.padEnd(30)} NOT EXISTS (${r.error.code})`);
    } else {
      console.log(`  ✓ ${col.padEnd(30)} EXISTS`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
