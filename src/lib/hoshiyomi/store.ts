import "server-only";

import type { UIMessage } from "ai";
import {
  validAccessPaymentRows,
  type AccessPaymentRow,
} from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase-server";

export type HoshiyomiConversationSummary = {
  id: string;
  title: string;
  messages: UIMessage[];
  updatedAt: string;
};

type StoreResult<T> = {
  data: T;
  available: boolean;
};

export type HoshiyomiCredits = {
  total: number;
  remaining: number;
  used: number;
};

export function isMissingHoshiyomiStore(error: unknown): boolean {
  const value = error as { code?: string; message?: string; details?: string } | null;
  const text = `${value?.code ?? ""} ${value?.message ?? ""} ${value?.details ?? ""}`.toLowerCase();
  return (
    text.includes("42p01") ||
    text.includes("pgrst205") ||
    text.includes("hoshiyomi_") && text.includes("does not exist") ||
    text.includes("schema cache")
  );
}

function toMessages(value: unknown): UIMessage[] {
  return Array.isArray(value) ? (value as UIMessage[]) : [];
}

export async function listHoshiyomiConversations(
  userId: string,
): Promise<StoreResult<HoshiyomiConversationSummary[]>> {
  const userIds = await relatedUserIds(userId);
  const { data, error } = await supabaseAdmin
    .from("hoshiyomi_conversations")
    .select("id, title, messages, updated_at")
    .in("user_id", userIds)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    if (isMissingHoshiyomiStore(error)) return { data: [], available: false };
    throw new Error(`Failed to load hoshiyomi conversations: ${error.message}`);
  }

  return {
    available: true,
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      messages: toMessages(row.messages),
      updatedAt: row.updated_at as string,
    })),
  };
}

async function relatedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return [userId];

  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email) return [userId];

  const { data: rows, error: relatedError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(50);
  if (relatedError) return [userId];
  const ids = (rows ?? []).map((row) => row.id as string);
  return ids.includes(userId) ? ids : [...ids, userId];
}

export async function getHoshiyomiCredits(
  userId: string,
): Promise<StoreResult<HoshiyomiCredits>> {
  const userIds = await relatedUserIds(userId);

  // 通信断で settle まで到達しなかった予約は、次の送信を待たずに返却する。
  // 残り0回のときもページ再表示だけで回復できるよう、残高取得前に掃除する。
  for (const ownerId of userIds) {
    const { error: releaseError } = await supabaseAdmin.rpc(
      "release_stale_hoshiyomi_reservations",
      { p_user_id: ownerId },
    );
    if (releaseError) {
      if (isMissingHoshiyomiStore(releaseError)) {
        return {
          data: { total: 0, remaining: 0, used: 0 },
          available: false,
        };
      }
      throw new Error(
        `Failed to release stale hoshiyomi reservations: ${releaseError.message}`,
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("hoshiyomi_credit_balances")
    .select("credits_total, credits_remaining")
    .in("user_id", userIds);

  if (error) {
    if (isMissingHoshiyomiStore(error)) {
      return {
        data: { total: 0, remaining: 0, used: 0 },
        available: false,
      };
    }
    throw new Error(`Failed to load hoshiyomi credits: ${error.message}`);
  }
  const total = (data ?? []).reduce(
    (sum, row) => sum + Number(row.credits_total ?? 0),
    0,
  );
  const remaining = (data ?? []).reduce(
    (sum, row) => sum + Number(row.credits_remaining ?? 0),
    0,
  );
  return {
    data: { total, remaining, used: Math.max(0, total - remaining) },
    available: true,
  };
}

export async function loadHoshiyomiConversation(
  userId: string,
  conversationId: string,
): Promise<UIMessage[] | null> {
  const userIds = await relatedUserIds(userId);
  const { data, error } = await supabaseAdmin
    .from("hoshiyomi_conversations")
    .select("messages")
    .eq("id", conversationId)
    .in("user_id", userIds)
    .maybeSingle();
  if (error) throw new Error(`Failed to load hoshiyomi conversation: ${error.message}`);
  return data ? toMessages(data.messages) : null;
}

export async function reserveHoshiyomiMessage(
  userId: string,
  reservationId: string,
): Promise<{
  allowed: boolean;
  ownerId: string | null;
  total: number;
  used: number;
  remaining: number;
}> {
  const userIds = await relatedUserIds(userId);
  const { data: balances, error: balanceError } = await supabaseAdmin
    .from("hoshiyomi_credit_balances")
    .select("user_id, credits_total, credits_remaining")
    .in("user_id", userIds)
    .order("credits_remaining", { ascending: false });
  if (balanceError) {
    throw new Error(`Failed to load hoshiyomi credits: ${balanceError.message}`);
  }

  const total = (balances ?? []).reduce(
    (sum, row) => sum + Number(row.credits_total ?? 0),
    0,
  );
  const remaining = (balances ?? []).reduce(
    (sum, row) => sum + Number(row.credits_remaining ?? 0),
    0,
  );

  for (const balance of balances ?? []) {
    const ownerId = balance.user_id as string;
    const { data, error } = await supabaseAdmin.rpc(
      "reserve_hoshiyomi_credit",
      {
        p_user_id: ownerId,
        p_reservation_id: reservationId,
      },
    );
    if (error) {
      throw new Error(`Failed to reserve hoshiyomi credit: ${error.message}`);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.allowed === true) {
      const nextRemaining = Math.max(
        0,
        remaining -
          Number(balance.credits_remaining ?? 0) +
          Number(row.credits_remaining ?? 0),
      );
      return {
        allowed: true,
        ownerId,
        total,
        used: Math.max(0, total - nextRemaining),
        remaining: nextRemaining,
      };
    }
  }

  return {
    allowed: false,
    ownerId: null,
    total,
    used: Math.max(0, total - remaining),
    remaining,
  };
}

export async function settleHoshiyomiMessage(
  ownerId: string,
  reservationId: string,
  commit: boolean,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("settle_hoshiyomi_credit", {
    p_user_id: ownerId,
    p_reservation_id: reservationId,
    p_commit: commit,
  });
  if (error) {
    throw new Error(`Failed to settle hoshiyomi credit: ${error.message}`);
  }
}

export async function grantHoshiyomiCredits(args: {
  userId: string;
  sourceKey: string;
  credits: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("grant_hoshiyomi_credits", {
    p_user_id: args.userId,
    p_source_key: args.sourceKey,
    p_credits: args.credits,
  });
  if (error) {
    throw new Error(`Failed to grant hoshiyomi credits: ${error.message}`);
  }
}

/**
 * その購入後に保証すべき累計回数まで不足分だけ付与する。
 * upgrade_from の自己申告には依存せず、実際の累計残高を基準にするため、
 * 完全版の5回が未付与だったユーザーでもプレミアム購入後は必ず30回になる。
 */
export async function grantHoshiyomiCreditsToTarget(args: {
  userId: string;
  sourceKey: string;
  targetTotal: number;
}): Promise<void> {
  const current = await getHoshiyomiCredits(args.userId);
  if (!current.available) {
    throw new Error("Hoshiyomi credit store is unavailable");
  }
  const credits = Math.max(0, args.targetTotal - current.data.total);
  if (credits === 0) return;
  await grantHoshiyomiCredits({
    userId: args.userId,
    sourceKey: args.sourceKey,
    credits,
  });
}

export async function revokeHoshiyomiCredits(sourceKey: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("revoke_hoshiyomi_credit_grant", {
    p_source_key: sourceKey,
  });
  if (error) {
    throw new Error(`Failed to revoke hoshiyomi credits: ${error.message}`);
  }
}

export async function ensureHoshiyomiCreditsFromPurchase(
  userId: string,
): Promise<StoreResult<HoshiyomiCredits>> {
  const current = await getHoshiyomiCredits(userId);
  if (!current.available) return current;

  const userIds = await relatedUserIds(userId);
  const { data: payments, error } = await supabaseAdmin
    .from("payment_history")
    .select("id, user_id, stripe_session_id, payment_kind, metadata, paid_at")
    .in("user_id", userIds)
    .eq("status", "completed")
    .in("payment_kind", ["full_access", "premium_bundle"])
    .order("paid_at", { ascending: true });
  if (error) {
    throw new Error(`Failed to recover hoshiyomi credits: ${error.message}`);
  }

  const validPayments = validAccessPaymentRows(
    (payments ?? []) as (AccessPaymentRow & { stripe_session_id: string })[],
  ) as (AccessPaymentRow & { stripe_session_id: string })[];
  for (const payment of validPayments) {
    const kind = payment.payment_kind as string;
    await grantHoshiyomiCreditsToTarget({
      userId: payment.user_id as string,
      sourceKey: `stripe:${payment.stripe_session_id as string}`,
      targetTotal: kind === "premium_bundle" ? 30 : 5,
    });
  }

  return getHoshiyomiCredits(userId);
}

function conversationTitle(messages: UIMessage[]): string {
  const firstUserText = messages
    .find((message) => message.role === "user")
    ?.parts.find((part) => part.type === "text")?.text.trim();
  if (!firstUserText) return "新しい会話";
  return firstUserText.length > 34
    ? `${firstUserText.slice(0, 34)}…`
    : firstUserText;
}

export async function saveHoshiyomiConversation(args: {
  id: string;
  userId: string;
  messages: UIMessage[];
}): Promise<void> {
  const userIds = await relatedUserIds(args.userId);
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("hoshiyomi_conversations")
    .select("user_id")
    .eq("id", args.id)
    .maybeSingle();
  if (lookupError) throw new Error(`Failed to inspect hoshiyomi conversation: ${lookupError.message}`);
  if (existing && !userIds.includes(existing.user_id as string)) {
    throw new Error("Conversation ownership mismatch");
  }

  const { error } = await supabaseAdmin.from("hoshiyomi_conversations").upsert(
    {
      id: args.id,
      user_id: args.userId,
      title: conversationTitle(args.messages),
      messages: args.messages.slice(-60),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Failed to save hoshiyomi conversation: ${error.message}`);
}

export async function deleteHoshiyomiConversation(
  userId: string,
  conversationId: string,
): Promise<void> {
  const userIds = await relatedUserIds(userId);
  const { error } = await supabaseAdmin
    .from("hoshiyomi_conversations")
    .delete()
    .eq("id", conversationId)
    .in("user_id", userIds);
  if (error) throw new Error(`Failed to delete hoshiyomi conversation: ${error.message}`);
}
