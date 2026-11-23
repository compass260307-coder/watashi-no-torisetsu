import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  FULL_ACCESS_PRICE_TEST_END_AT,
  FULL_ACCESS_PRICE_TEST_PAUSE_END_AT,
  FULL_ACCESS_PRICE_TEST_PAUSE_START_AT,
  FULL_ACCESS_PRICE_TEST_START_AT,
  FULL_ACCESS_PRICE_TEST_VERSION,
} from "@/lib/access-products";
import { fullAccessMarketForCountry, type JaFullAccessPriceArm } from "@/lib/full-access-pricing";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export type FullAccessBuyer = { id: string; email: string | null; owner_token: string | null };

export function fullAccessMarketForRequest(request: NextRequest) {
  // ローカル開発だけ、DEV_IP_COUNTRY（例: JP）で接続元の国を指定できる。本番ビルドでは無視する。
  const devCountry =
    process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1"
      ? process.env.DEV_IP_COUNTRY?.trim().toUpperCase() || null
      : null;
  return fullAccessMarketForCountry(
    process.env.VERCEL === "1" ? request.headers.get("x-vercel-ip-country") : devCountry,
  );
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
};

const NOT_ENROLLED: JaFullAccessPriceAssignment = { arm: "control", enrolled: false };
// ローカル開発だけ、DEV_FULL_ACCESS_PRICE_TEST_START_AT で開始時刻を前倒しして両方の群を試せる。本番ビルドでは無視する。
const devPriceTestStartAt =
  process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1"
    ? process.env.DEV_FULL_ACCESS_PRICE_TEST_START_AT?.trim() || null
    : null;
const PRICE_TEST_START_MS = Date.parse(devPriceTestStartAt ?? FULL_ACCESS_PRICE_TEST_START_AT);
const PRICE_TEST_END_MS = Date.parse(FULL_ACCESS_PRICE_TEST_END_AT);
const PRICE_TEST_PAUSE_START_MS = Date.parse(FULL_ACCESS_PRICE_TEST_PAUSE_START_AT);
const PRICE_TEST_PAUSE_END_MS = Date.parse(FULL_ACCESS_PRICE_TEST_PAUSE_END_AT);

// 終了時刻を過ぎたら、テストは自動で止まる（全員 ¥499）。環境変数でも止められる。
function priceTestEnabled() {
  return process.env.FULL_ACCESS_PRICE_TEST !== "off" && Date.now() < PRICE_TEST_END_MS;
}

export function jaFullAccessPriceAssignmentForUser(
  userId: string,
  diagnosisCompletedAt: string | null | undefined,
): JaFullAccessPriceAssignment {
  if (!priceTestEnabled() || !diagnosisCompletedAt) return NOT_ENROLLED;
  const completedMs = Date.parse(diagnosisCompletedAt);
  if (!Number.isFinite(completedMs) || completedMs < PRICE_TEST_START_MS) return NOT_ENROLLED;
  // 延長の反映をまたいだ1時間に診断した人は対象外（その間は全員 ¥499 を見ている）。
  if (completedMs >= PRICE_TEST_PAUSE_START_MS && completedMs < PRICE_TEST_PAUSE_END_MS) return NOT_ENROLLED;
  const digest = createHash("sha256").update(`${FULL_ACCESS_PRICE_TEST_VERSION}:${userId}`).digest();
  return { arm: digest[0] % 2 === 0 ? "control" : "test", enrolled: true };
}

/** 決済API用: 特定済みの購入者の群を引く。DBを読めないときは例外（呼び出し側で503にする）。 */
export async function resolveJaFullAccessPriceAssignment(
  buyer: Pick<FullAccessBuyer, "id"> | null,
): Promise<JaFullAccessPriceAssignment> {
  if (!priceTestEnabled() || !buyer) return NOT_ENROLLED;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, diagnosis_completed_at")
    .eq("id", buyer.id)
    .maybeSingle();
  if (error) throw new Error("price test assignment lookup failed");
  return data
    ? jaFullAccessPriceAssignmentForUser(data.id as string, data.diagnosis_completed_at as string | null)
    : NOT_ENROLLED;
}

/**
 * 見積もりAPI用: resolveFullAccessBuyer と同じ順（owner_token の本人 → ログイン中の本人）で
 * 購入者を特定して群を引く。owner_token があれば users を1回読むだけで済ませる。
 */
export async function resolveJaFullAccessPriceAssignmentForRequest(
  request: NextRequest,
  ownerToken: string,
): Promise<JaFullAccessPriceAssignment> {
  if (!priceTestEnabled()) return NOT_ENROLLED;
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
