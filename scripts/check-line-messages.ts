// T3-4 補助: line_messages_sent の直近を表示

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const t = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const l of t.split(/\r?\n/)) {
    const e = l.indexOf("=");
    if (e < 0 || l.startsWith("#")) continue;
    let v = l.slice(e + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(l.slice(0, e).trim() in process.env)) {
      process.env[l.slice(0, e).trim()] = v;
    }
  }
}
loadEnvLocal();

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabase-server");
  const { data, error } = await supabaseAdmin
    .from("line_messages_sent")
    .select(
      "id, line_user_id, message_type, message_subtype, send_result, error_detail, sent_at",
    )
    .order("sent_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
  for (const r of data ?? []) {
    console.log(
      `  [${r.sent_at}] type=${r.message_type}/${r.message_subtype ?? "-"} | result=${r.send_result} | err=${r.error_detail ?? "(none)"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
