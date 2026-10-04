import "server-only";

import { supabaseAdmin } from "./supabase-server";
import {
  accessPurchaseEntitlementsFromRows,
  getAccessPurchaseEntitlements,
  hasFullAccess,
  hasSelfReportAccess,
  hasTakoAccess,
  hasUnmeiAccess,
  validAccessPaymentRows,
  type AccessPaymentRow,
} from "./entitlements";
import { hoshiyomiChatCreditTarget } from "./access-products";
import { ensureHoshiyomiCreditsFromPurchase } from "./hoshiyomi/store";
import { EMPTY_FULL_ACCESS_STATUS, type FullAccessStatus } from "./full-access-status";

type StatusPayment = Omit<AccessPaymentRow, "payment_kind"> & {
  payment_kind: AccessPaymentRow["payment_kind"] | "tako_unlock";
  created_at: string | null;
};

type StatusUser = {
  id: string;
  email: string | null;
  plan: string;
  unmei: boolean | null;
  payment_history: StatusPayment[];
  hoshiyomi_credit_balances: { credits_total: number } | null;
};

// FK による left join。購入のないユーザーも消さず、残高・履歴は返却しない。
const STATUS_COLUMNS = `id, email, plan, unmei,
  payment_history(id, user_id, payment_kind, metadata, paid_at, created_at),
  hoshiyomi_credit_balances(credits_total)`;

function statusQuery() {
  return supabaseAdmin.from("users").select(STATUS_COLUMNS)
    .eq("payment_history.status", "completed")
    .in("payment_history.payment_kind", ["self_report", "full_access", "premium_bundle", "tako_unlock"])
    .order("paid_at", { referencedTable: "payment_history", ascending: true, nullsFirst: true })
    .order("created_at", { referencedTable: "payment_history", ascending: true });
}

/** schema cache に FK がない旧環境だけ、従来の個別判定を維持する。 */
function needsLegacyQuery(error: { code?: string } | null): boolean {
  return !!error && ["PGRST200", "PGRST201", "PGRST205", "42P01"].includes(error.code ?? "");
}

async function legacyStatus(userId: string): Promise<FullAccessStatus> {
  const fullPromise = hasFullAccess(userId);
  const purchasesPromise = getAccessPurchaseEntitlements(userId);
  const checks = { full: fullPromise, purchases: purchasesPromise };
  const [full, selfReport, friend, purchases, unmei] = await Promise.all([
    fullPromise, hasSelfReportAccess(userId, checks), hasTakoAccess(userId, checks),
    purchasesPromise, hasUnmeiAccess(userId, checks),
  ]);
  const credits = full || purchases.full
    ? await ensureHoshiyomiCreditsFromPurchase(userId) : null;
  return {
    full, selfReport, friend, premiumBundle: purchases.premiumBundle, unmei,
    tarot: purchases.tarotFeatures,
    astrologer: full && credits?.available === true && credits.data.total > 0,
  };
}

function chronological(a: StatusPayment, b: StatusPayment): number {
  // paid_at NULL は最初、created_at NULL は最後 (従来の PostgREST order と同じ)。
  const paid = (a.paid_at ? Date.parse(a.paid_at) : -Infinity) -
    (b.paid_at ? Date.parse(b.paid_at) : -Infinity);
  if (paid) return paid;
  return (a.created_at ? Date.parse(a.created_at) : Infinity) -
    (b.created_at ? Date.parse(b.created_at) : Infinity);
}

/** 通常はメールなし1通信、メールあり2通信。権限の真実源は常にDB。 */
export async function getFullAccessStatusByOwnerToken(token: string): Promise<FullAccessStatus> {
  const { data, error } = await statusQuery().eq("owner_token", token).maybeSingle();
  if (needsLegacyQuery(error)) {
    console.warn("[full-access-status] legacy relationship fallback");
    const owner = await supabaseAdmin.from("users").select("id").eq("owner_token", token).maybeSingle();
    if (owner.error) throw new Error("Access status lookup failed");
    return owner.data ? legacyStatus(owner.data.id as string) : { ...EMPTY_FULL_ACCESS_STATUS };
  }
  if (error) throw new Error("Access status lookup failed");
  if (!data) return { ...EMPTY_FULL_ACCESS_STATUS };
  const owner = data as unknown as StatusUser;
  const email = typeof owner.email === "string" ? owner.email.trim().toLowerCase() : "";
  let related: StatusUser[] = [];
  if (email) {
    const result = await statusQuery().eq("email", email).limit(50);
    if (result.error) throw new Error("Related access status lookup failed");
    related = result.data as unknown as StatusUser[];
    // full/unmei の旧判定は50件制限の外も見る。稀な大口アカウントは旧経路へ。
    // また、埋め込み履歴がAPI側の行上限に達した可能性がある場合も切り捨てない。
    if (related.length >= 50) return legacyStatus(owner.id);
  }
  const users = [...related];
  if (!users.some((user) => user.id === owner.id)) users.push(owner);
  if (users.some((user) => user.payment_history.length >= 1000)) return legacyStatus(owner.id);
  const payments = users.flatMap((user) => user.payment_history).sort(chronological);
  const accessPayments = payments.filter((row) => row.payment_kind !== "tako_unlock") as AccessPaymentRow[];
  const purchases = accessPurchaseEntitlementsFromRows(accessPayments);
  const full = users.some((user) => user.plan === "full");
  // 旧self_report/tako_unlockは本人＋同一emailの先頭20件、コース履歴は50件。
  const legacyUsers = new Set([owner.id, ...related.slice(0, 20).map((user) => user.id)]);
  const hasLegacyPayment = (kind: StatusPayment["payment_kind"]) =>
    payments.some((row) => row.payment_kind === kind && legacyUsers.has(row.user_id));
  const unmei = users.some((user) => user.unmei === true) || purchases.destinyFeatures ||
    (!purchases.full && owner.plan === "full");
  let creditsTotal = users.reduce((sum, user) => sum + Number(user.hoshiyomi_credit_balances?.credits_total ?? 0), 0);

  if (full || purchases.full) {
    // ensure の既存互換: full/premiumの履歴だけで差額の前提を検証する。
    const creditPayments = validAccessPaymentRows(accessPayments.filter((row) => row.payment_kind !== "self_report"));
    const target = creditPayments.reduce((max, row) => Math.max(max,
      hoshiyomiChatCreditTarget(row.payment_kind, row.metadata?.hoshiyomi_chat_policy)), 0);
    // ナビ判定は累計付与数だけを使う。予約掃除・毎回の再付与確認は不要。
    // 決済直後/旧購入の未付与だけ従来のidempotent復元を行う。
    if (creditsTotal < target) {
      const recovered = await ensureHoshiyomiCreditsFromPurchase(owner.id);
      creditsTotal = recovered.available ? recovered.data.total : 0;
    }
  }
  return {
    full,
    selfReport: full || hasLegacyPayment("self_report"),
    friend: full || purchases.friendFeatures || hasLegacyPayment("tako_unlock"),
    premiumBundle: purchases.premiumBundle,
    astrologer: full && creditsTotal > 0,
    unmei,
    tarot: purchases.tarotFeatures,
  };
}
