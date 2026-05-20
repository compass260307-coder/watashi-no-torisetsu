// T2-9 補助: 直近の payment_history + integrated_trisetsu を見る
//
// 実行: npx tsx scripts/check-payment-status.ts [user_id]
// 引数なし → 全件 (最新 5)

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
  const arg = process.argv[2];

  console.log("=== payment_history (最新 5) ===");
  let payQ = supabaseAdmin
    .from("payment_history")
    .select("id, user_id, stripe_session_id, amount_jpy, status, paid_at, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (arg) payQ = payQ.eq("user_id", arg);
  const { data: payments, error: pErr } = await payQ;
  if (pErr) {
    console.error("ERROR:", pErr);
  } else {
    for (const p of payments ?? []) {
      console.log(
        `  id=${p.id}\n    user_id=${p.user_id}\n    stripe_session_id=${p.stripe_session_id}\n    amount=¥${p.amount_jpy} status=${p.status} paid_at=${p.paid_at}\n    created=${p.created_at}`,
      );
    }
    if (!payments || payments.length === 0) {
      console.log("  (no rows)");
    }
  }

  console.log("\n=== integrated_trisetsu (最新 5) ===");
  let itQ = supabaseAdmin
    .from("integrated_trisetsu")
    .select(
      "id, user_id, payment_id, status, failure_reason, retry_count, ai_model, ai_input_tokens, ai_output_tokens, ai_cost_usd, generated_at",
    )
    .order("generated_at", { ascending: false })
    .limit(5);
  if (arg) itQ = itQ.eq("user_id", arg);
  const { data: trisetsus, error: tErr } = await itQ;
  if (tErr) {
    console.error("ERROR:", tErr);
  } else {
    for (const t of trisetsus ?? []) {
      console.log(
        `  id=${t.id}\n    user_id=${t.user_id}\n    payment_id=${t.payment_id ?? "NULL"}\n    status=${t.status} retry=${t.retry_count ?? 0}\n    model=${t.ai_model ?? "NULL"} in=${t.ai_input_tokens} out=${t.ai_output_tokens} cost=$${t.ai_cost_usd}\n    failure_reason=${t.failure_reason ?? "(none)"}\n    generated_at=${t.generated_at}`,
      );
    }
    if (!trisetsus || trisetsus.length === 0) {
      console.log("  (no rows)");
    }
  }
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
