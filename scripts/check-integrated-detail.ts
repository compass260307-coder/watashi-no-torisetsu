// T2-9 補助: integrated_trisetsu の chapters JSON を確認

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabase-server");
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: npx tsx scripts/check-integrated-detail.ts <integrated_trisetsu_id>");
    process.exit(1);
  }
  const { data, error } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select("id, status, generated_title, generated_subtitle, generated_chapters, ai_model, ai_cost_usd")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
  if (!data) {
    console.error("Not found");
    process.exit(1);
  }
  console.log(`status: ${data.status}`);
  console.log(`title: ${data.generated_title}`);
  console.log(`subtitle: ${data.generated_subtitle}`);
  console.log(`model: ${data.ai_model}, cost: $${data.ai_cost_usd}`);
  console.log("\n--- chapters keys ---");
  const ch = data.generated_chapters as Record<string, { body?: string }> | null;
  if (!ch) {
    console.log("  (null)");
  } else {
    let total = 0;
    for (const [key, c] of Object.entries(ch)) {
      const len = c?.body?.length ?? 0;
      total += len;
      console.log(`  ${key.padEnd(22)} ${String(len).padStart(4)} 字`);
    }
    console.log(`  ${"合計".padEnd(22)} ${total} 字`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
