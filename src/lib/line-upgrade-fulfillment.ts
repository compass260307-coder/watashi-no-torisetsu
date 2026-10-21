import "server-only";
import { randomUUID } from "node:crypto";
import { hasPremiumBundleAccess } from "@/lib/entitlements";
import { deterministicLineEventId } from "@/lib/line-events";
import { pushLineMessages } from "@/lib/line";
import { lineUpgradeDeliveryMessages } from "@/lib/line-upgrade-delivery-copy";
import { signLineUpgradeImage } from "@/lib/line-upgrade-image-token";
import { signLineResultUpgradeIdentity } from "@/lib/line-result-upgrade-token";
import { isResultUpgradeReady, normalizeResultUpgradeAnswers } from "@/lib/result-upgrade";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";
import { resultUpgradeSpendBlock } from "@/lib/ai-spend-guard";
import { RESULT_UPGRADE_PRICE_JPY } from "@/lib/access-products";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

const EVENT = "line_result_upgrade_fulfillment";
const LEASE_MS = 6 * 60_000;
// LINE only deduplicates retry keys for 24 hours. Never resend outside that window.
const PUSH_RETRY_MS = 23 * 60 * 60_000;
type Job = {
  revision: string; status: "pending" | "processing" | "sent" | "cancelled" | "attention";
  user_id: string; line_user_id: string; session_id: string; attempts: number;
  next_at: string; lease_until?: string; delivery_at?: number; delivery_origin?: string;
  generated_at?: string; error?: string;
};
type Purchase = { id: string; payment_status: string; amount_total: number | null; currency: string | null; metadata: Record<string,string> | null };
export function isLineResultUpgradePurchase(session: Pick<Purchase,"metadata">): boolean {
  const m = session.metadata;
  return m?.locale === "ja" && m.sales_channel === "line" && m.product === "premium_bundle" && m.paywall_source === "result_upgrade_after_answers";
}
async function linked(lineUserId: string, userId: string) {
  const {data,error} = await supabaseAdmin.from("line_accounts").select("user_id").eq("line_user_id",lineUserId).maybeSingle();
  if(error) throw new Error("link_lookup_failed");
  return data?.user_id === userId;
}
export async function enqueueLineResultUpgrade(session: Purchase, userId: string): Promise<string | null> {
  if(!isLineResultUpgradePurchase(session)) return null;
  if(session.payment_status !== "paid" || session.currency !== "jpy" || session.amount_total !== RESULT_UPGRADE_PRICE_JPY || session.metadata?.user_id !== userId) throw new Error("invalid_line_upgrade_purchase");
  let lineUserId = session.metadata.line_user_id;
  // Compatibility for previously issued LINE Checkout Sessions; never pick an ambiguous account.
  if(!lineUserId) {
    const {data,error} = await supabaseAdmin.from("line_accounts").select("line_user_id").eq("user_id",userId).limit(2);
    if(error || data?.length !== 1) throw new Error("line_upgrade_recipient_missing");
    lineUserId = data[0].line_user_id;
  }
  if(!lineUserId || !(await linked(lineUserId,userId))) throw new Error("line_upgrade_recipient_changed");
  const id = deterministicLineEventId(EVENT,session.id);
  const metadata: Job = {revision:randomUUID(),status:"pending",user_id:userId,line_user_id:lineUserId,session_id:session.id,attempts:0,next_at:new Date().toISOString()};
  const {error} = await supabaseAdmin.from("events").insert({id,event_name:EVENT,locale:"ja",owner_token:null,metadata});
  if(error && error.code !== "23505") throw new Error("line_upgrade_enqueue_failed");
  return id;
}
async function save(id: string, previous: Job, next: Job): Promise<Job> {
  const metadata = {...next,revision:randomUUID()};
  const {data,error} = await supabaseAdmin.from("events").update({metadata}).eq("id",id)
    .eq("metadata->>revision",previous.revision).select("id").maybeSingle();
  if(error || !data) throw new Error("fulfillment_lease_lost");
  return metadata;
}
export async function processLineResultUpgrade(id: string, options: {force?: boolean} = {}) {
  const {data,error} = await supabaseAdmin.from("events").select("metadata").eq("id",id).eq("event_name",EVENT).maybeSingle();
  if(error) throw new Error("fulfillment_lookup_failed");
  const initial = data?.metadata as Job | undefined;
  if(!initial || ["sent","cancelled","attention"].includes(initial.status) || Date.parse(initial.next_at)>Date.now() ||
    (initial.status === "processing" && Date.parse(initial.lease_until ?? "")>Date.now())) return;
  let job: Job;
  try {
    job=await save(id,initial,{...initial,status:"processing",attempts:initial.attempts+1,lease_until:new Date(Date.now()+LEASE_MS).toISOString(),next_at:new Date(Date.now()+LEASE_MS).toISOString()});
  } catch { return; } // A different worker already owns the job, or the DB is unavailable.
  try {
    if(!(await hasPremiumBundleAccess(job.user_id)) || !(await linked(job.line_user_id,job.user_id))) {
      await save(id,job,{...job,status:"cancelled",error:"purchase_or_link_revoked"});return;
    }
    let row=await loadResultUpgradeForUser(job.user_id);
    if(row?.locale !== "ja" || !normalizeResultUpgradeAnswers(row.answers)) {
      await save(id,job,{...job,status:"attention",error:"answers_unavailable"});return;
    }
    if(!isResultUpgradeReady(row)) {
      const block=resultUpgradeSpendBlock(row);
      if(block && (!options.force || !block.canRetry)) {
        await save(id,job,{...job,status:"pending",error:"spend_blocked",next_at:new Date(Math.max(Date.now()+60*60_000,Date.parse(block.retryAt ?? "")||0)).toISOString()});return;
      }
      const {generateResultUpgradeForUser}=await import("@/lib/result-upgrade/generate");
      await generateResultUpgradeForUser(job.user_id,{force:options.force});
      row=await loadResultUpgradeForUser(job.user_id);
    }
    if(!isResultUpgradeReady(row)) {
      const attention=(row?.attempts ?? 0)>=3 || job.attempts>=12;
      await save(id,job,{...job,status:attention?"attention":"pending",error:"generation_pending",next_at:new Date(Date.now()+5*60_000).toISOString()});return;
    }
    if(!row.generated_at || !Number.isFinite(Date.parse(row.generated_at)) || !row.character_storage_path.startsWith(`${job.user_id}/`)) {
      await save(id,job,{...job,status:"attention",error:"invalid_generated_result"});return;
    }
    if(!(await hasPremiumBundleAccess(job.user_id)) || !(await linked(job.line_user_id,job.user_id))) {
      await save(id,job,{...job,status:"cancelled",error:"purchase_or_link_revoked"});return;
    }
    if(job.delivery_at && Date.now()-job.delivery_at>=PUSH_RETRY_MS) {
      await save(id,job,{...job,status:"attention",error:"push_retry_window_expired"});return;
    }
    if(job.delivery_origin && job.delivery_origin!==resolveSiteUrl()) {
      await save(id,job,{...job,status:"attention",error:"delivery_origin_changed"});return;
    }
    if(job.generated_at && job.generated_at!==row.generated_at) {
      await save(id,job,{...job,status:"attention",error:"generated_result_changed"});return;
    }
    if(!job.delivery_at) {
      const origin=resolveSiteUrl();
      if(!origin.startsWith("https://")) throw new Error("delivery_requires_https");
      job=await save(id,job,{...job,delivery_at:Date.now(),delivery_origin:origin,generated_at:row.generated_at!});
    }
    const imageToken=signLineUpgradeImage({userId:job.user_id,lineUserId:job.line_user_id,generatedAt:job.generated_at!},job.delivery_at!);
    const imageUrl=`${job.delivery_origin}/api/line/result-upgrade/image?token=${encodeURIComponent(imageToken)}`;
    const readingToken=signLineResultUpgradeIdentity(job.line_user_id,job.user_id,job.delivery_at);
    const readingUrl=`${job.delivery_origin}/api/line/result-upgrade/enter?token=${encodeURIComponent(readingToken)}`;
    const messages=lineUpgradeDeliveryMessages({characterUrl:imageUrl,previewUrl:`${imageUrl}&size=preview`,readingUrl});
    if(!(await pushLineMessages(job.line_user_id,messages,id))) throw new Error("line_push_failed");
    await save(id,job,{...job,status:"sent",error:undefined});
  } catch {
    // Keep the same recipient, delivery timestamp and retry key after uncertain delivery.
    try { await save(id,job,{...job,status:job.attempts>=12?"attention":"pending",error:"fulfillment_retry",next_at:new Date(Date.now()+Math.min(60*60_000,30_000*2**Math.min(job.attempts,7))).toISOString()}); }
    catch { /* The lease expires and the durable worker reclaims it. */ }
  }
}
export async function processDueLineResultUpgrades(limit=1) {
  const {data,error}=await supabaseAdmin.from("events").select("id").eq("event_name",EVENT)
    .in("metadata->>status",["pending","processing"]).lte("metadata->>next_at",new Date().toISOString())
    .order("created_at",{ascending:true}).limit(limit);
  if(error) throw new Error("fulfillment_due_lookup_failed");
  for(const row of data ?? []) await processLineResultUpgrade(row.id);
  return {checked:data?.length ?? 0};
}
export async function resumeLineResultUpgradeForUser(userId: string, force=false) {
  if(!(await hasPremiumBundleAccess(userId))) return;
  const {data,error}=await supabaseAdmin.from("events").select("id, metadata").eq("event_name",EVENT)
    .eq("metadata->>user_id",userId).order("created_at",{ascending:false}).limit(1);
  if(error) throw new Error("fulfillment_resume_lookup_failed");
  const row=data?.[0];if(!row) return;
  const job=row.metadata as Job;
  if(job.status==="sent" || (job.status==="processing" && Date.parse(job.lease_until ?? "")>Date.now())) return;
  if(job.status==="cancelled" && (!force || !(await linked(job.line_user_id,userId)))) return;
  try { await save(row.id,job,{...job,status:"pending",next_at:new Date().toISOString()}); } catch { return; }
  await processLineResultUpgrade(row.id,{force});
}
