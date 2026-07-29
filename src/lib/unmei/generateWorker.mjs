import { computeNatalChart } from "../ephemeris.mjs";
import { callClaude } from "../claude.mjs";
import { buildNatalSystemPrompt, buildNatalUserPrompt } from "./prompts.mjs";

// 出生地未入力時のフォールバック緯度経度 (指示書②: 都道府県未入力なら東京で仮計算)。
const TOKYO_LAT = 35.6895;
const TOKYO_LNG = 139.6917;

// v2: 生成後スキャンで弾く推量表現 (これのみ。「してみてください」は正しい命令形なので弾かない)。
const HEDGE_TERMS = [
  "かもしれない",
  "かもしれません",
  "でしょう",
  "だろう",
  "と思われ",
  "のかもしれ",
  "ように見えるかも",
];
// reading (hitokoto + 各 section の subline/body) に推量表現が含まれるか。検出語を返す。
function detectHedges(reading) {
  const parts = [reading?.hitokoto || ""];
  for (const s of reading?.sections || []) {
    parts.push(s?.subline || "", s?.body || "");
  }
  const text = parts.join("\n");
  return HEDGE_TERMS.filter((t) => text.includes(t));
}

// 生成状態マシン用の定数 (reading.ts と一致させること)。
const MAX_GEN_ATTEMPTS = 3; // 自動再生成の上限。超えたら opts.force(手動)でのみ再試行。
const STALE_LOCK_MS = 180_000; // 'generating' ロックの陳腐化(クラッシュ復帰)閾値=3分。

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
  if (
    !model ||
    model === "pending" ||
    model === "generating" ||
    model === "failed" ||
    model === "local-placeholder"
  ) {
    return false;
  }
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

    // 3. 既存の生成状態を読む
    const { data: existing } = await supabaseAdmin
      .from("natal_readings")
      .select("model, reading, generated_at")
      .eq("user_id", userId)
      .maybeSingle();

    // 3a. 有効な鑑定が既にあれば再生成しない(キャッシュ規律・API再呼び出し禁止)
    if (isReadingReady(existing)) {
      return { ok: true, cached: true };
    }

    const attempts =
      existing && existing.reading && typeof existing.reading === "object"
        ? Number(existing.reading.attempts) || 0
        : 0;

    // 3b. 並行生成ロック: 別プロセスが生成中(かつ陳腐化していない)なら重複起動しない。
    //     クラッシュで放置された 'generating' は STALE_LOCK_MS 経過で再取得を許可。
    if (existing && existing.model === "generating") {
      const startedAt = existing.generated_at ? Date.parse(existing.generated_at) : 0;
      if (startedAt && Date.now() - startedAt < STALE_LOCK_MS) {
        return { skipped: "in_progress" };
      }
    }

    // 3c. 自動再生成の上限。手動(opts.force)でのみ超過リトライを許可。
    if (attempts >= MAX_GEN_ATTEMPTS && !opts.force) {
      return { skipped: "failed", attempts };
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

    // 4a. ロック取得 (model='generating')。以降 isReadingReady=false のまま生成中を表す。
    await supabaseAdmin.from("natal_readings").upsert(
      {
        user_id: userId,
        reading: { status: "generating", attempts },
        model: "generating",
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    const system = buildNatalSystemPrompt();
    const userPrompt = buildNatalUserPrompt({
      chart,
      scores,
      essence,
      typeName: opts.typeName ?? null,
      timeUnknown,
    });

    // 5. 生成 (parse失敗 or 推量表現検出で1回だけ再生成 = 最大2試行)
    const saveReading = (parsed) =>
      supabaseAdmin.from("natal_readings").upsert(
        { user_id: userId, reading: parsed, model, generated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    let lastErr = null;
    let hedgedFallback = null; // 1回目が推量表現ありだが有効な reading (再生成が失敗したとき採用)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await callClaude({
          system,
          prompt: userPrompt,
          model,
          maxTokens: 4500, // v2: 4章×550〜900字 + subline + hitokoto
          timeoutMs: 120_000,
        });
        const parsed = parseReading(resp.text);
        const hedges = detectHedges(parsed);
        if (hedges.length > 0 && attempt < 2) {
          // 推量表現検出 → 1回だけ再生成。1回目は有効なので fallback に退避。
          console.warn(`[generateWorker] 推量表現を検出 (attempt ${attempt}): ${hedges.join("/")} → 再生成`);
          hedgedFallback = parsed;
          continue;
        }
        if (hedges.length > 0) {
          // 2回目も検出 → 無限ループを避け、ログに残して通す。
          console.warn(`[generateWorker] 再生成後も推量表現が残存: ${hedges.join("/")} — ログに残して通す`);
        }
        await saveReading(parsed);
        return { ok: true };
      } catch (e) {
        lastErr = e;
        console.warn(`[generateWorker] claude attempt ${attempt} failed:`, e);
      }
    }
    // 再生成が parse 失敗等で無効だった場合、1回目(推量あり)の有効な reading を採用して通す。
    if (hedgedFallback) {
      console.warn("[generateWorker] 再生成が無効。1回目(推量あり)を採用して通す");
      await saveReading(hedgedFallback);
      return { ok: true };
    }

    // 6. 失敗を記録 (attempts++)。上限までは呼び出し側が自動再生成できる。
    const nextAttempts = attempts + 1;
    console.error(`[generateWorker] generation failed (attempts=${nextAttempts}):`, lastErr);
    await supabaseAdmin.from("natal_readings").upsert(
      {
        user_id: userId,
        reading: {
          status: "failed",
          attempts: nextAttempts,
          error: String(lastErr).slice(0, 500),
        },
        model: "failed",
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return { error: String(lastErr), attempts: nextAttempts };
  } catch (e) {
    console.error("[generateWorker] error:", e);
    return { error: String(e) };
  }
}
