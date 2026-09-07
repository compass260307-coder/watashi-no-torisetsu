import { NextRequest, NextResponse } from "next/server";

import {
  appError,
  appRequestId,
  requireAppAccountId,
} from "@/lib/alice-app-api";
import { getAccessPurchaseEntitlements } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = appRequestId(request);
  const auth = await requireAppAccountId(request);
  if (!auth.ok) return auth.response;

  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select(
      "id, active_base_profile_snapshot_id, locale, timezone, guide, is_review_account, registered_at",
    )
    .eq("id", auth.accountId)
    .maybeSingle();

  if (accountError) {
    console.error("[alice/bootstrap] account lookup failed", {
      requestId,
      message: accountError.message,
    });
    return appError({
      status: 503,
      code: "bootstrap_unavailable",
      message: "Aliceを開始できませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }
  if (!account?.active_base_profile_snapshot_id) {
    return appError({
      status: 404,
      code: "account_not_linked",
      message: "診断結果がまだ引き継がれていません。",
      requestId,
    });
  }

  const { data: snapshot, error: snapshotError } = await supabaseAdmin
    .from("base_profile_snapshots")
    .select(
      "id, source_user_id, logic_version, schema_version, copied_at, type_id, scores, facet_scores, self_report, perceived_report, friend_view_base",
    )
    .eq("id", account.active_base_profile_snapshot_id)
    .eq("account_id", auth.accountId)
    .maybeSingle();

  if (snapshotError || !snapshot) {
    if (snapshotError) {
      console.error("[alice/bootstrap] snapshot lookup failed", {
        requestId,
        message: snapshotError.message,
      });
    }
    return appError({
      status: 503,
      code: "snapshot_unavailable",
      message: "診断結果を読み込めませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }

  const nowIso = new Date().toISOString();
  const { data: cycle, error: cycleError } = await supabaseAdmin
    .from("weekly_cycles")
    .select(
      "id, cycle_number, starts_at, ends_at, day_start_at, timezone_at_start",
    )
    .eq("account_id", auth.accountId)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let activeCycle = null;
  let phaseTwoAvailable = !cycleError;
  if (cycleError) {
    if (!isPhaseTwoMissing(cycleError)) {
      console.error("[alice/bootstrap] active cycle lookup failed", {
        requestId,
        message: cycleError.message,
      });
    }
  } else if (cycle) {
    const { data: completedCheckins, error: completedDaysError } =
      await supabaseAdmin
        .from("daily_checkins")
        .select("cycle_day")
        .eq("account_id", auth.accountId)
        .eq("cycle_id", cycle.id)
        .eq("status", "completed");

    if (completedDaysError && !isPhaseTwoMissing(completedDaysError)) {
      console.error("[alice/bootstrap] completed days lookup failed", {
        requestId,
        message: completedDaysError.message,
      });
    }
    if (completedDaysError) phaseTwoAvailable = false;

    const dayNumber = currentCycleDay(cycle.day_start_at, Date.now());
    const completedDayNumbers = (completedCheckins ?? []).map(
      (checkin) => checkin.cycle_day,
    );

    activeCycle = {
      id: cycle.id,
      cycle_number: cycle.cycle_number,
      day_number: dayNumber,
      completed_days: completedDayNumbers.length,
      completed_day_numbers: completedDayNumbers,
      completed_today: completedDayNumbers.includes(dayNumber),
      starts_at: cycle.starts_at,
      ends_at: cycle.ends_at,
      timezone: cycle.timezone_at_start,
    };
  }

  const friendBase = snapshot.friend_view_base;
  const { data: entitlement, error: entitlementError } = await supabaseAdmin
    .from("subscription_entitlements")
    .select("state, expires_at, grace_period_expires_at")
    .eq("account_id", auth.accountId)
    .maybeSingle();
  if (entitlementError && !isPhaseThreeMissing(entitlementError)) {
    console.error("[alice/bootstrap] entitlement lookup failed", {
      requestId,
      message: entitlementError.message,
    });
  }
  const entitlementState = entitlement?.state ?? "none";
  const phaseThreeAvailable = !entitlementError;
  const chatEntitled = hasChatEntitlement(entitlement, Date.now());
  const purchaseEntitlements = await getAccessPurchaseEntitlements(
    snapshot.source_user_id,
  );
  const developmentBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.ALICE_CHAT_DEV_BYPASS === "true";
  return NextResponse.json(
    {
      api_version: "v1",
      min_supported_app_version: process.env.ALICE_MIN_APP_VERSION ?? "1.0.0",
      latest_app_version: process.env.ALICE_LATEST_APP_VERSION ?? "1.0.0",
      maintenance_state: "available",
      feature_flags: {
        daily_check_in:
          phaseTwoAvailable && process.env.ALICE_DAILY_ENABLED === "true",
        alice_chat:
          phaseThreeAvailable &&
          process.env.ALICE_CHAT_ENABLED === "true" &&
          (chatEntitled || account.is_review_account || developmentBypass),
        weekly_report: false,
      },
      entitlement_state: entitlementState,
      purchase_entitlements: purchaseEntitlements,
      active_cycle: activeCycle,
      account: {
        id: account.id,
        locale: account.locale,
        timezone: account.timezone,
        guide: account.guide,
        is_review_account: account.is_review_account,
        registered_at: account.registered_at,
      },
      base_profile: {
        snapshot_id: snapshot.id,
        logic_version: snapshot.logic_version,
        schema_version: snapshot.schema_version,
        copied_at: snapshot.copied_at,
        type_id: snapshot.type_id,
        scores: snapshot.scores,
        facet_scores: snapshot.facet_scores,
        self_report: snapshot.self_report,
        perceived_report: snapshot.perceived_report,
        friend_view: {
          base: friendBase
            ? {
                snapshotId: snapshot.id,
                copiedAt: snapshot.copied_at,
                ...friendBase,
              }
            : null,
          live: null,
          displaySource: friendBase ? "base" : "none",
        },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function currentCycleDay(dayStarts: unknown, now: number) {
  if (!Array.isArray(dayStarts) || dayStarts.length !== 8) return 1;
  for (let index = 0; index < 7; index += 1) {
    const start = Date.parse(String(dayStarts[index]));
    const end = Date.parse(String(dayStarts[index + 1]));
    if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end) {
      return index + 1;
    }
  }
  return 1;
}

function isPhaseTwoMissing(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("weekly_cycles") === true ||
    error.message?.includes("daily_checkins") === true
  );
}

function isPhaseThreeMissing(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("subscription_entitlements") === true
  );
}

function hasChatEntitlement(
  entitlement:
    | {
        state: string;
        expires_at: string | null;
        grace_period_expires_at: string | null;
      }
    | null,
  now: number,
) {
  if (!entitlement) return false;
  if (entitlement.state === "grace_period") {
    return (
      entitlement.grace_period_expires_at === null ||
      Date.parse(entitlement.grace_period_expires_at) > now
    );
  }
  if (entitlement.state !== "trialing" && entitlement.state !== "active") {
    return false;
  }
  return entitlement.expires_at === null || Date.parse(entitlement.expires_at) > now;
}
