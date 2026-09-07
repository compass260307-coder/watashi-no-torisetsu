// PR1: entitlement 判定 (課金ロックの唯一の真実源)。
//
// 完全版と、学生向けライト商品の権限を分離する。
// 課金判定は各所で .eq('plan','full') とベタ書きせず、必ず hasFullAccess() に集約する
// (ロジックが1箇所なら抜け道点検も1箇所で済む)。PR2 のサーバゲートはこの関数を通す。

import { supabaseAdmin } from "./supabase-server";
import {
  purchaseIncludesAishoFeatures,
  purchaseIncludesDestinyFeatures,
  purchaseIncludesFriendFeatures,
  purchaseIncludesHoshiyomiChat,
  purchaseIncludesTarotFeatures,
} from "./access-products";

export type AccessPaymentKind =
  | "self_report"
  | "full_access"
  | "premium_bundle";

export type AccessPaymentRow = {
  id: string;
  user_id: string;
  payment_kind: AccessPaymentKind;
  metadata: {
    upgrade_from?: unknown;
    locale?: unknown;
    destiny_access_policy?: unknown;
    hoshiyomi_chat_policy?: unknown;
    tarot_access_policy?: unknown;
    friend_access_policy?: unknown;
    aisho_access_policy?: unknown;
  } | null;
  paid_at?: string | null;
};

function upgradeFrom(row: AccessPaymentRow): string {
  return typeof row.metadata?.upgrade_from === "string"
    ? row.metadata.upgrade_from
    : "none";
}

/**
 * 差額購入は前提商品の completed 決済が残っているときだけ有効。
 * 返金で土台が消えた差額行を権限源として扱わないための共通判定。
 */
export function validAccessPaymentRows(
  rows: AccessPaymentRow[],
): AccessPaymentRow[] {
  let hasSelfReport = false;
  let hasFull = false;
  const valid: AccessPaymentRow[] = [];

  for (const row of rows) {
    if (row.payment_kind === "self_report") {
      hasSelfReport = true;
      valid.push(row);
      continue;
    }

    const prerequisite = upgradeFrom(row);
    if (
      (prerequisite === "self_report" && !hasSelfReport) ||
      (prerequisite === "full_access" && !hasFull)
    ) {
      continue;
    }

    valid.push(row);
    hasFull = true;
  }

  return valid;
}

async function completedAccessPaymentRows(
  userIds: string[],
): Promise<AccessPaymentRow[] | null> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("payment_history")
    .select("id, user_id, payment_kind, metadata, paid_at")
    .in("user_id", userIds)
    .eq("status", "completed")
    .in("payment_kind", ["self_report", "full_access", "premium_bundle"])
    .order("paid_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (error) return null;
  return (data ?? []) as AccessPaymentRow[];
}

export async function getAccessPurchaseEntitlements(
  userId: string | null | undefined,
): Promise<{
  selfReport: boolean;
  full: boolean;
  premiumBundle: boolean;
  destinyFeatures: boolean;
  hoshiyomiChat: boolean;
  tarotFeatures: boolean;
  friendFeatures: boolean;
  aishoFeatures: boolean;
}> {
  if (!userId) {
    return {
      selfReport: false,
      full: false,
      premiumBundle: false,
      destinyFeatures: false,
      hoshiyomiChat: false,
      tarotFeatures: false,
      friendFeatures: false,
      aishoFeatures: false,
    };
  }
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) {
    return {
      selfReport: false,
      full: false,
      premiumBundle: false,
      destinyFeatures: false,
      hoshiyomiChat: false,
      tarotFeatures: false,
      friendFeatures: false,
      aishoFeatures: false,
    };
  }

  let userIds = [userId];
  const email =
    typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email) {
    const { data: related, error: relatedError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .limit(50);
    if (relatedError) {
      return {
        selfReport: false,
        full: false,
        premiumBundle: false,
        destinyFeatures: false,
        hoshiyomiChat: false,
        tarotFeatures: false,
        friendFeatures: false,
        aishoFeatures: false,
      };
    }
    userIds = (related ?? []).map((row) => row.id as string);
    if (!userIds.includes(userId)) userIds.push(userId);
  }

  const payments = await completedAccessPaymentRows(userIds);
  if (!payments) {
    return {
      selfReport: false,
      full: false,
      premiumBundle: false,
      destinyFeatures: false,
      hoshiyomiChat: false,
      tarotFeatures: false,
      friendFeatures: false,
      aishoFeatures: false,
    };
  }
  const valid = validAccessPaymentRows(payments);
  const premiumBundle = valid.some(
    (row) => row.payment_kind === "premium_bundle",
  );
  const full = premiumBundle || valid.some(
    (row) => row.payment_kind === "full_access",
  );
  const destinyFeatures = valid.some((row) =>
    purchaseIncludesDestinyFeatures(
      row.payment_kind,
      row.metadata?.destiny_access_policy,
      row.metadata?.locale,
    ),
  );
  const hoshiyomiChat = valid.some((row) =>
    purchaseIncludesHoshiyomiChat(
      row.payment_kind,
      row.metadata?.hoshiyomi_chat_policy,
    ),
  );
  const tarotFeatures = valid.some((row) =>
    purchaseIncludesTarotFeatures(
      row.payment_kind,
      row.metadata?.tarot_access_policy,
    ),
  );
  const friendFeatures = valid.some((row) =>
    purchaseIncludesFriendFeatures(
      row.payment_kind,
      row.metadata?.friend_access_policy,
    ),
  );
  const aishoFeatures = valid.some((row) =>
    purchaseIncludesAishoFeatures(
      row.payment_kind,
      row.metadata?.aisho_access_policy,
    ),
  );
  return {
    selfReport:
      full || valid.some((row) => row.payment_kind === "self_report"),
    full,
    premiumBundle,
    destinyFeatures,
    hoshiyomiChat,
    tarotFeatures,
    friendFeatures,
    aishoFeatures,
  };
}

export type Plan = "free" | "full";

/** DB からプランを引く。取得失敗時は安全側 (free) に倒す。 */
export async function getPlan(userId: string): Promise<Plan> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return "free";
  return data.plan === "full" ? "full" : "free";
}

/**
 * 全解放を持っているか。課金ロックの判定は必ずこの関数を経由する。
 * userId が無い (未ログイン) なら false。
 *
 * 紐付けは email 優先: その user 行が plan='full' でなくても、同じ email を持つ別の
 * user 行に full があれば full 扱いにする (ゲスト決済・再診断で行が分かれても、email が
 * 同じなら全解放が効く)。email が無い行は自分の plan だけで判定。
 */
export async function hasFullAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("plan, email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;

  // ① その行自身が full
  if (data.plan === "full") return true;

  // ② email 優先: 同一 email の行に full があれば full 扱い
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (email) {
    const { data: fullRows } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .eq("plan", "full")
      .limit(1);
    if (fullRows && fullRows.length > 0) return true;
  }

  return false;
}

/**
 * 運命の設計図まで利用できるか。
 * premium_bundle と、設計図込みで販売した旧 full_access、旧 unmei / unmei_upgrade
 * を利用可にする。
 * users.unmei を優先しつつ、再診断時は同一 email、旧購入者は購入履歴から復元する。
 */
export async function hasUnmeiAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("unmei, email, plan")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  if (data.unmei === true) return true;
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (email) {
    const { data: rows } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .eq("unmei", true)
      .limit(1);
    if (rows && rows.length > 0) return true;
  }

  const entitlements = await getAccessPurchaseEntitlements(userId);
  if (entitlements.destinyFeatures) return true;
  // 決済履歴がある完全版は、その購入時のpolicyを優先する。
  // payment_history導入前の旧plan='full'だけ後方互換で残す。
  if (entitlements.full) return false;
  return data.plan === "full";
}

/**
 * プレミアムコースの追加特典を利用できるか。
 *
 * users.unmei には旧完全版購入者も含まれるため、premium_bundle の決済履歴で判定する。
 */
export async function hasPremiumCourseAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  return hasPremiumBundleAccess(userId);
}

/** user_id 群に指定商品の completed 決済があるか。 */
async function anyCompletedPayment(
  userIds: string[],
  paymentKind: "self_report" | "tako_unlock" | "premium_bundle",
): Promise<boolean> {
  if (userIds.length === 0) return false;
  const { count, error } = await supabaseAdmin
    .from("payment_history")
    .select("id", { count: "exact", head: true })
    .in("user_id", userIds)
    .eq("payment_kind", paymentKind)
    .eq("status", "completed");
  if (error) return false;
  return (count ?? 0) > 0;
}

/** プレミアム商品そのものの購入済み判定。 */
export async function hasPremiumBundleAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  return (await getAccessPurchaseEntitlements(userId)).premiumBundle;
}

/**
 * AI占い師チャットが購入に含まれているか (メール文面などの表示判定用)。
 * 実際のチャット利用可否は hoshiyomi クレジット残高が真実源で、
 * 付与は webhook / ensureHoshiyomiCreditsFromPurchase が行う。
 */
export async function hasHoshiyomiChatPurchase(
  userId: string | null | undefined,
): Promise<boolean> {
  return (await getAccessPurchaseEntitlements(userId)).hoshiyomiChat;
}

/** 現行の完全版または全部入りに含まれるタロット権限。 */
export async function hasTarotAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  return (await getAccessPurchaseEntitlements(userId)).tarotFeatures;
}

/**
 * 自己診断のロック本文と自己分析PDFを利用できるか。
 *
 * - 既存の full_access 購入者は後方互換で利用可。
 * - self_report 購入者は自己診断/PDFを利用可。
 * - ゲスト購入や再診断で users 行が分かれても、同じ email の購入を引き継ぐ。
 */
export async function hasSelfReportAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;

  if (await hasFullAccess(userId)) return true;
  if (await anyCompletedPayment([userId], "self_report")) return true;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;

  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email) return false;

  const { data: rows } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(20);
  const relatedIds = (rows ?? []).map((row) => row.id as string);
  return anyCompletedPayment(relatedIds, "self_report");
}

/**
 * 相性診断を利用できるか。
 * 現行日本版は完全版以上、韓国版と一部の旧販売世代はプレミアム限定。
 * 旧購入は購入時に案内した権利を維持する。
 */
export async function hasAishoAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const entitlements = await getAccessPurchaseEntitlements(userId);
  if (entitlements.aishoFeatures) return true;
  // completed の現行 full_access がある場合はポリシー判定を優先する。
  if (entitlements.full) return false;
  // payment_history 導入前の plan='full' 購入者は旧権利として維持する。
  return hasFullAccess(userId);
}


// =====================================================================
// 友達診断 (/tako) の解放。
//   日本版の学生向けライトは2人目以降の結果シートと友達診断PDFも解放する。
//   full_access 以上も友達機能を解放し、旧 self_report は購入時の権利を維持する。
//   旧 'tako_unlock' (¥799 単体販売) は廃止。ただし過去の ¥799 購入者の権限は
//   payment_history から引き続き読み取り、解放を維持する (下記 anyTakoUnlockPayment)。
// =====================================================================

// 旧 ¥799 単体販売の価格定数 (2026-07-22 に販売終了。過去参照・型互換のため残置)。
export const TAKO_UNLOCK_PRICE_JPY = 799;
export const TAKO_UNLOCK_DISCOUNTED_PRICE_JPY = 300;

/** user_id 群に tako_unlock の completed 行があるか。 */
async function anyTakoUnlockPayment(userIds: string[]): Promise<boolean> {
  return anyCompletedPayment(userIds, "tako_unlock");
}

/**
 * 友達診断の解放を持っているか。判定は必ずこの関数を経由する。
 * hasFullAccess と同じ思想で email 紐付けも見る (ゲスト決済・再診断で行が
 * 分かれても、同じ email の行に購入があれば解放扱い)。
 */
export async function hasTakoAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;

  // ⓪ full_access / premium_bundle / 旧 plan='full' は友達診断を解放。
  if (await hasFullAccess(userId)) return true;

  // ① self_report は購入世代のポリシーに応じて友達機能を解放する。
  if ((await getAccessPurchaseEntitlements(userId)).friendFeatures) return true;

  // ② 旧 ¥799 単体購入者の権限維持: 自分の行での tako_unlock 購入
  if (await anyTakoUnlockPayment([userId])) return true;

  // ③ email 紐付け: 同一 email の別 user 行での購入
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email) return false;

  const { data: rows } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(20);
  const otherIds = (rows ?? [])
    .map((r) => r.id as string)
    .filter((id) => id !== userId);
  return anyTakoUnlockPayment(otherIds);
}
