import "server-only";

import { getAccessPurchaseEntitlements, hasFullAccess, hasUnmeiAccess } from "@/lib/entitlements";
import type { VerifiedPaidCheckoutSession } from "@/lib/paid-checkout-session";
import { supabaseAdmin } from "@/lib/supabase-server";

// Called only after Stripe verification. The exact payment and webhook's
// post-grant completion record must exist; a redirect alone is insufficient.
export async function hasGrantedXPurchaseAccess(session: VerifiedPaidCheckoutSession): Promise<boolean> {
  if (!session.id.startsWith("cs_live_")) return false;
  try {
    const { data: payment, error } = await supabaseAdmin
      .from("payment_history")
      .select("user_id")
      .eq("stripe_session_id", session.id)
      .eq("payment_kind", session.product)
      .eq("status", "completed")
      .maybeSingle();
    if (error || !payment?.user_id) return false;

    const completionEvent = session.product === "unmei"
      ? "unmei_purchase_complete"
      : session.product === "unmei_upgrade" ? "unmei_upgrade_complete" : "purchase_completed";
    const { data: completion, error: completionError } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("event_name", completionEvent)
      .eq("metadata->>stripe_session_id", session.id)
      .eq("metadata->>user_id", payment.user_id)
      .eq("metadata->>product", session.product)
      .limit(1);
    if (completionError || !completion?.length) return false;

    // Resolve the actual recipient from payment_history, including guest orders
    // linked by email. Reuse the same gates that unlock the purchased content.
    if (session.product === "unmei" || session.product === "unmei_upgrade") {
      return await hasUnmeiAccess(payment.user_id);
    }
    const access = await getAccessPurchaseEntitlements(payment.user_id);
    if (session.product === "self_report") return access.selfReport;
    if (!(await hasFullAccess(payment.user_id))) return false;
    return session.product === "premium_bundle" ? access.premiumBundle : access.full;
  } catch {
    // A lookup failure suppresses only rh5rd, never the purchase UX/other tags.
    return false;
  }
}
