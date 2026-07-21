// テストユーザーの運命の設計図を再生成して結果を確認する。
//
// 使い方 (Node 20+):
//   node --env-file=.env.local scripts/unmei-regen.mjs <userId>
//
// 前提: 対象ユーザーに birth_profiles があること。エフェメリス(ephemeris.mjs =
//   circular-natal-horoscope-js)は任意の出生日で実データを返すため、日付の縛りはない。
//   (2004-04-26 02:00 JST は scripts/ephemeris-test.mjs の回帰検証に使うフィクスチャで、
//    太陽 牡牛座 5.8° 等の既知値を再現する例。実行時のゲートではない。)
//
// 無効キャッシュ(旧ダミー / 生成中 / 失敗)は自動で再生成対象になる。
// 明示的にやり直したい場合は natal_readings / natal_charts の行を先に削除してもよい。

import { createClient } from "@supabase/supabase-js";
import { runForUser } from "../src/lib/unmei/generateWorker.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.argv[2];

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (use --env-file=.env.local)");
  process.exit(1);
}
if (!userId) {
  console.error("usage: node --env-file=.env.local scripts/unmei-regen.mjs <userId>");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

console.log(`[regen] user=${userId} model=${process.env.CLAUDE_MODEL}`);
const result = await runForUser(sb, userId);
console.log("[regen] runForUser ->", JSON.stringify(result));

const { data } = await sb
  .from("natal_readings")
  .select("model, reading, generated_at")
  .eq("user_id", userId)
  .maybeSingle();

if (!data) {
  console.log("[regen] natal_readings: (行なし)");
} else {
  console.log("[regen] model:", data.model);
  console.log("[regen] generated_at:", data.generated_at);
  const sections = Array.isArray(data.reading?.sections) ? data.reading.sections : [];
  console.log("[regen] sections:", sections.map((s) => s.title));
  console.log("[regen] hitokoto:", data.reading?.hitokoto);
  console.log("[regen] 配置(haichi) 本文:", (sections[0]?.body ?? "").slice(0, 240));
  const body = JSON.stringify(data.reading);
  console.log("[regen] 太陽/牡牛座 に言及?:", /太陽/.test(body) && /牡牛座/.test(body));
}
process.exit(0);
