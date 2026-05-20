// T3-3 補助: friend_perceptions の pdf_consent 状態確認

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
  const { data } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id, perceiver_name, target_user_id, pdf_consent, pdf_consent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  let consented = 0, notConsented = 0;
  for (const r of data ?? []) {
    if (r.pdf_consent === true) consented++;
    else notConsented++;
    console.log(`  ${r.id} | ${r.perceiver_name} → ${(r.target_user_id as string).slice(0, 8)}... | pdf_consent=${r.pdf_consent} consent_at=${r.pdf_consent_at ?? "null"}`);
  }
  console.log(`\nSummary: consented=${consented}, not_consented=${notConsented}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
