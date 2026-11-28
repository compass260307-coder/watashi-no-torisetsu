import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  FULL_ACCESS_PRICE_TEST_899_END_AT,
  FULL_ACCESS_PRICE_TEST_899_START_AT,
  FULL_ACCESS_PRICE_TEST_899_VERSION,
  FULL_ACCESS_PRICE_TEST_END_AT,
  FULL_ACCESS_PRICE_TEST_PAUSE_END_AT,
  FULL_ACCESS_PRICE_TEST_PAUSE_START_AT,
  FULL_ACCESS_PRICE_TEST_START_AT,
  FULL_ACCESS_PRICE_TEST_VERSION,
} from "@/lib/access-products";
import { fullAccessMarketForCountry, type JaFullAccessPriceArm } from "@/lib/full-access-pricing";
import { hasPlatformRequestCountry, platformRequestCountry } from "@/lib/request-country";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export type FullAccessBuyer = { id: string; email: string | null; owner_token: string | null };

export function fullAccessMarketForRequest(request: NextRequest) {
  // ローカル開発だけ、DEV_IP_COUNTRY（例: JP）で接続元の国を指定できる。本番ビルドでは無視する。
  const onPlatform = hasPlatformRequestCountry();
  const devCountry =
    process.env.NODE_ENV !== "production" && !onPlatform
      ? process.env.DEV_IP_COUNTRY?.trim().toUpperCase() || null
      : null;
  return fullAccessMarketForCountry(onPlatform ? platformRequestCountry(request) : devCountry);
}

export async function resolveFullAccessBuyer(
  request: NextRequest,
  ownerToken: string,
): Promise<FullAccessBuyer | null> {
  if (ownerToken) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, email, owner_token")
      .eq("owner_token", ownerToken)
      .maybeSingle();
    if (data) return data as FullAccessBuyer;
  }
  const session = await getSession(request);
  return session
    ? { id: session.id, email: session.email, owner_token: session.owner_token }
    : null;
}

// ===== 日本円の完全版の価格テスト（FULL_ACCESS_PRICE_TEST_VERSION） =====
// 開始時刻から終了時刻までに初めて診断した人だけを対象に、ユーザーIDから半々に固定で分ける。
// 同じ人は、どのページ・どの端末から見ても同じ額になる。見積もりAPIと決済APIは必ずこの判定を共有する。
export type JaFullAccessPriceAssignment = {
  arm: JaFullAccessPriceArm;
  /** テストの対象者（開始後に診断した人）か。対象外の人は control と同じ¥499だが、集計では分ける。 */
  enrolled: boolean;
  /** 対象者のとき、どのテストのどちらの群か（決済の記録用。control＝安い方、test＝高い方）。 */
  test?: { version: string; arm: "control" | "test" };
};

const NOT_ENROLLED: JaFullAccessPriceAssignment = { arm: "control", enrolled: false };
// 2026-11-25の本人判断: 価格テストを打ち切った時点（終了時刻。本番反映の時点）からは、日本円の完全版を全員 ¥699
// （通常価格¥1,499 − ¥800。テストの¥699の群と同じ見せ方）にする。テストの対象者ではないので enrolled は false。
const STANDARD_699: JaFullAccessPriceAssignment = { arm: "test", enrolled: false };
// ローカル開発だけ、DEV_FULL_ACCESS_PRICE_TEST_START_AT で開始時刻を前倒しして両方の群を試せる。本番ビルドでは無視する。
const devPriceTestStartAt =
  process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1"
    ? process.env.DEV_FULL_ACCESS_PRICE_TEST_START_AT?.trim() || null
    : null;
const PRICE_TEST_START_MS = Date.parse(devPriceTestStartAt ?? FULL_ACCESS_PRICE_TEST_START_AT);
const PRICE_TEST_END_MS = Date.parse(FULL_ACCESS_PRICE_TEST_END_AT);
const PRICE_TEST_PAUSE_START_MS = Date.parse(FULL_ACCESS_PRICE_TEST_PAUSE_START_AT);
const PRICE_TEST_PAUSE_END_MS = Date.parse(FULL_ACCESS_PRICE_TEST_PAUSE_END_AT);

// 終了時刻を過ぎたら、テストは自動で止まる。終了前に環境変数で止めたときは全員 ¥499。
function priceTestEnabled() {
  return process.env.FULL_ACCESS_PRICE_TEST !== "off" && Date.now() < PRICE_TEST_END_MS;
}

// ===== 次の価格テスト（FULL_ACCESS_PRICE_TEST_899_VERSION。¥699 と ¥899） =====
// ローカル開発だけ、DEV_FULL_ACCESS_PRICE_TEST_899_START_AT で開始時刻を前倒しして両方の群を試せる。本番ビルドでは無視する。
const devPriceTest899StartAt =
  process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1"
    ? process.env.DEV_FULL_ACCESS_PRICE_TEST_899_START_AT?.trim() || null
    : null;
const PRICE_TEST_899_START_MS = Date.parse(devPriceTest899StartAt ?? FULL_ACCESS_PRICE_TEST_899_START_AT);
const PRICE_TEST_899_END_MS = Date.parse(FULL_ACCESS_PRICE_TEST_899_END_AT);

// 開始時刻から終了時刻のあいだだけ動く。環境変数で止められる。全員を¥499に戻しているあいだも動かさない。
function priceTest899Enabled() {
  const now = Date.now();
  return process.env.FULL_ACCESS_PRICE_TEST_899 !== "off" && process.env.FULL_ACCESS_JA_PRICE !== "499" &&
    now >= PRICE_TEST_899_START_MS && now < PRICE_TEST_899_END_MS;
}

// テストの対象外の人・テストが止まっているときの額。終了時刻までは従来の¥499、終了時刻からは全員¥699。
// ¥499に戻すときは、環境変数 FULL_ACCESS_JA_PRICE=499 を設定して再デプロイする。
function standardAssignment(): JaFullAccessPriceAssignment {
  return Date.now() >= PRICE_TEST_END_MS && process.env.FULL_ACCESS_JA_PRICE !== "499" ? STANDARD_699 : NOT_ENROLLED;
}

export function jaFullAccessPriceAssignmentForUser(
  userId: string,
  diagnosisCompletedAt: string | null | undefined,
): JaFullAccessPriceAssignment {
  if (priceTest899Enabled()) {
    // 開始後に初めて診断した人だけが対象。開始前に診断した人は¥699のまま。
    const completed899Ms = diagnosisCompletedAt ? Date.parse(diagnosisCompletedAt) : Number.NaN;
    if (!Number.isFinite(completed899Ms) || completed899Ms < PRICE_TEST_899_START_MS) return standardAssignment();
    const digest899 = createHash("sha256").update(`${FULL_ACCESS_PRICE_TEST_899_VERSION}:${userId}`).digest();
    return digest899[0] % 2 === 0
      ? { arm: "test", enrolled: true, test: { version: FULL_ACCESS_PRICE_TEST_899_VERSION, arm: "control" } }
      : { arm: "test899", enrolled: true, test: { version: FULL_ACCESS_PRICE_TEST_899_VERSION, arm: "test" } };
  }
  if (!priceTestEnabled() || !diagnosisCompletedAt) return standardAssignment();
  const completedMs = Date.parse(diagnosisCompletedAt);
  if (!Number.isFinite(completedMs) || completedMs < PRICE_TEST_START_MS) return NOT_ENROLLED;
  // 延長の反映をまたいだ1時間に診断した人は対象外（その間は全員 ¥499 を見ている）。
  if (completedMs >= PRICE_TEST_PAUSE_START_MS && completedMs < PRICE_TEST_PAUSE_END_MS) return NOT_ENROLLED;
  const digest = createHash("sha256").update(`${FULL_ACCESS_PRICE_TEST_VERSION}:${userId}`).digest();
  const arm = digest[0] % 2 === 0 ? "control" : "test";
  return { arm, enrolled: true, test: { version: FULL_ACCESS_PRICE_TEST_VERSION, arm } };
}

/** 決済API用: 特定済みの購入者の群を引く。DBを読めないときは例外（呼び出し側で503にする）。 */
export async function resolveJaFullAccessPriceAssignment(
  buyer: Pick<FullAccessBuyer, "id"> | null,
): Promise<JaFullAccessPriceAssignment> {
  if (!(priceTestEnabled() || priceTest899Enabled()) || !buyer) return standardAssignment();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, diagnosis_completed_at")
    .eq("id", buyer.id)
    .maybeSingle();
  if (error) throw new Error("price test assignment lookup failed");
  return data
    ? jaFullAccessPriceAssignmentForUser(data.id as string, data.diagnosis_completed_at as string | null)
    : standardAssignment();
}

/**
 * 見積もりAPI用: resolveFullAccessBuyer と同じ順（owner_token の本人 → ログイン中の本人）で
 * 購入者を特定して群を引く。owner_token があれば users を1回読むだけで済ませる。
 */
export async function resolveJaFullAccessPriceAssignmentForRequest(
  request: NextRequest,
  ownerToken: string,
): Promise<JaFullAccessPriceAssignment> {
  if (!(priceTestEnabled() || priceTest899Enabled())) return standardAssignment();
  if (ownerToken) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, diagnosis_completed_at")
      .eq("owner_token", ownerToken)
      .maybeSingle();
    if (error) throw new Error("price test assignment lookup failed");
    if (data) {
      return jaFullAccessPriceAssignmentForUser(data.id as string, data.diagnosis_completed_at as string | null);
    }
  }
  const session = await getSession(request);
  return resolveJaFullAccessPriceAssignment(session ? { id: session.id } : null);
}
