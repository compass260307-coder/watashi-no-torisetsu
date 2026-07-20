import { computeNatalChart } from "../ephemeris.mjs";
import { callClaude } from "../claude.mjs";
import { buildNatalSystemPrompt, buildNatalUserPrompt } from "./prompts.mjs";

// 出生地未入力時のフォールバック緯度経度 (指示書②: 都道府県未入力なら東京で仮計算)。
const TOKYO_LAT = 35.6895;
const TOKYO_LNG = 139.6917;

// birth_profiles の行から ephemeris 用の ISO 日時 (JST) を組み立てる。
//   - birth_date は 'YYYY-MM-DD'
//   - time_unknown / birth_time 無し → 正午 (12:00) 仮定
function buildBirthDateIso(profile) {
  const date = profile?.birth_date;
  if (!date) return null;
  const rawTime =
    profile.time_unknown || !profile.birth_time
      ? "12:00"
      : String(profile.birth_time).slice(0, 5);
  return `${date}T${rawTime}:00+09:00`;
}

// 出生図チャートを計算して natal_charts に保存し、natal_chart_ready を立てる。
// 返り値: { chart, timeUnknown } / birth_profiles が無ければ null。
export async function computeChartForUser(supabaseAdmin, userId) {
  const { data: profile } = await supabaseAdmin
    .from("birth_profiles")
    .select("birth_date, birth_time, time_unknown, latitude, longitude, place_unknown")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile || !profile.birth_date) {
    return null;
  }

  const dateIso = buildBirthDateIso(profile);
  const latitude =
    typeof profile.latitude === "number" ? profile.latitude : TOKYO_LAT;
  const longitude =
    typeof profile.longitude === "number" ? profile.longitude : TOKYO_LNG;

  const chart = computeNatalChart({
    dateIso,
    latitude,
    longitude,
    timezone: "Asia/Tokyo",
    timeUnknown: !!profile.time_unknown,
  });

  await supabaseAdmin.from("natal_charts").upsert(
    {
      user_id: userId,
      chart,
      computed_at: new Date().toISOString(),
      ready: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  await supabaseAdmin.from("users").update({ natal_chart_ready: true }).eq("id", userId);

  return { chart, timeUnknown: !!profile.time_unknown };
}

// 生成済み鑑定が有効か (reading.ts と同じ規律・.mjs 側のインライン実装)。
// 有効 = sections を持つ実生成。pending / local-placeholder / not-implemented ダミーは無効。
function isReadingReady(row) {
  if (!row) return false;
  const model = row.model;
  if (!model || model === "pending" || model === "local-placeholder") return false;
  const r = row.reading;
  if (!r || typeof r !== "object") return false;
  if (r.generated_from === "not-implemented") return false;
  return Array.isArray(r.sections) && r.sections.length > 0;
}

// Claude 応答から JSON を取り出してパースし、鑑定オブジェクトを検証する。
function parseReading(text) {
  if (!text) throw new Error("empty claude response");
  let jsonText = text.trim();
  // ```json ... ``` フェンス除去 (指示ではJSONのみだが保険)
  if (jsonText.startsWith("```")) {
    const lines = jsonText.split(/\r?\n/);
    if (lines.length >= 3) jsonText = lines.slice(1, -1).join("\n");
  }
  // 先頭/末尾に説明文が混じった場合、最初の { から最後の } を採用
  const first = jsonText.indexOf("{");
  const last = jsonText.lastIndexOf("}");
  if (first > 0 || (last >= 0 && last < jsonText.length - 1)) {
    if (first >= 0 && last > first) jsonText = jsonText.slice(first, last + 1);
  }
  const parsed = JSON.parse(jsonText);
  if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("reading missing sections");
  }
  return parsed;
}

// 鑑定生成本体。
// 返り値:
//   { skipped: "no_birth_profile" }  … 出生データ未入力 (正常な待機)
//   { skipped: "chart_not_ready" }   … エフェメリス未計算(実データ無し・ダミーを書かない)
//   { ok: true, cached?: true }      … 生成済み or キャッシュ有効
//   { error: string }                … 生成失敗 (呼び出し側で非致命扱い)
//
// opts: { scores, essence } … Big Five スコアと32タイプ称号 (呼び出し側で解決して渡す)
export async function runForUser(supabaseAdmin, userId, opts = {}) {
  try {
    // 1. 出生図を計算 (出生データ無しならスキップ)
    const computed = await computeChartForUser(supabaseAdmin, userId);
    if (!computed) return { skipped: "no_birth_profile" };
    const { chart, timeUnknown } = computed;

    // 2. 天体が算出できていなければ生成しない(AIに位置を推測させない・指示書③の原則)。
    //    ダミーもキャッシュしない。実エフェメリス採用後は通常ここには来ないが防御的に残す。
    if (!chart || chart.source === "not-implemented" || !chart.planets || !chart.planets.sun) {
      return { skipped: "chart_not_ready" };
    }

    // 3. キャッシュ規律: 有効な鑑定が既にあれば再生成しない(API再呼び出し禁止)。
    const { data: existing } = await supabaseAdmin
      .from("natal_readings")
      .select("model, reading")
      .eq("user_id", userId)
      .maybeSingle();
    if (isReadingReady(existing)) {
      return { ok: true, cached: true };
    }

    // 4. 生成入力を用意 (opts 優先、無ければ scores だけ DB から補完)
    let scores = opts.scores ?? null;
    const essence = opts.essence ?? null;
    if (!scores) {
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("scores")
        .eq("id", userId)
        .maybeSingle();
      scores = u?.scores ?? null;
    }

    const model = process.env.CLAUDE_MODEL ?? null;
    if (!model) {
      // モデル未設定は構成ミス。ダミーを書かずエラーで返す(待機のまま)。
      return { error: "CLAUDE_MODEL not set" };
    }

    const system = buildNatalSystemPrompt();
    const userPrompt = buildNatalUserPrompt({ chart, scores, essence, timeUnknown });

    // 5. 生成 (parse失敗時は1回だけリトライ = 最大2試行)
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await callClaude({
          system,
          prompt: userPrompt,
          model,
          maxTokens: 2000,
          timeoutMs: 120_000,
        });
        const parsed = parseReading(resp.text);
        await supabaseAdmin.from("natal_readings").upsert(
          { user_id: userId, reading: parsed, model, generated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
        return { ok: true };
      } catch (e) {
        lastErr = e;
        console.warn(`[generateWorker] attempt ${attempt} failed:`, e);
      }
    }
    console.error("[generateWorker] all attempts failed:", lastErr);
    return { error: String(lastErr) };
  } catch (e) {
    console.error("[generateWorker] error:", e);
    return { error: String(e) };
  }
}
