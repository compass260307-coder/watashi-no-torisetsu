// Incremental facts for diagnosis-cohort viral/friend/share metrics.
// No raw owner tokens, names, answers, or payment data leave this endpoint.
import { authorizeSheetsMetricsRequest, metricsExportReference, metricsPrivateHeaders } from "@/lib/metrics-access";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;
const shareNames = ["share_clicked", "share_click", "share_completed", "share_success", "friend_share_clicked", "friend_link_copied"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jobs = {
  diagnoses: { table: "users", at: "diagnosis_completed_at", select: "id,diagnosis_completed_at,source_user_id,owner_token", columns: ["ref", "at", "parent_ref", "owner_ref"] },
  friends: { table: "friend_answers", at: "created_at", select: "id,created_at,user_id", columns: ["ref", "at", "user_ref"] },
  shares: { table: "events", at: "created_at", select: "id,created_at,owner_token,locale,metadata", columns: ["ref", "at", "owner_ref", "user_ref", "locale"] },
} as const;

export async function GET(request: NextRequest) {
  const access = authorizeSheetsMetricsRequest(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: metricsPrivateHeaders });
  const q = request.nextUrl.searchParams, kind = q.get("kind") || "";
  if (!Object.hasOwn(jobs, kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400, headers: metricsPrivateHeaders });
  const job = jobs[kind as keyof typeof jobs];
  // Preserve microsecond precision in the cursor supplied by PostgreSQL.
  const after = q.get("after") || "", until = q.get("until") || "", id = q.get("after_id") || "";
  if (!Number.isFinite(Date.parse(after)) || !Number.isFinite(Date.parse(until)) || Date.parse(after) >= Date.parse(until) || Date.parse(until) > Date.now() + 60000 || (id && !uuid.test(id))) {
    return NextResponse.json({ error: "Invalid cursor or cutoff" }, { status: 400, headers: metricsPrivateHeaders });
  }
  const limit = Math.min(999, Math.max(1, Number.parseInt(q.get("limit") || "999", 10) || 999));
  // The six historic share names do not all use the existing partial index.
  // Bound scans to one day instead of sorting an entire month's events.
  const scanUntil = kind === "shares" ? new Date(Math.min(Date.parse(until), Date.parse(after) + 86400000)).toISOString() : until;
  const base = () => {
    let b = supabaseAdmin.from(job.table).select(job.select).lt(job.at, scanUntil);
    if (kind === "diagnoses") b = b.eq("acquisition_locale", "ja");
    if (kind === "shares") b = b.in("event_name", shareNames);
    return b;
  };
  // Two indexed ranges avoid the expensive OR + ORDER BY query on events.
  const facts: Record<string, unknown>[] = [];
  if (id) {
    const tie = await base().eq(job.at, after).gt("id", id).order("id").limit(limit + 1);
    if (tie.error) return NextResponse.json({ error: "Social metrics query failed" }, { status: 503, headers: metricsPrivateHeaders });
    facts.push(...(tie.data as unknown as Record<string, unknown>[]));
  }
  if (facts.length <= limit) {
    const later = await base().gt(job.at, after).order(job.at).order("id").limit(limit + 1 - facts.length);
    if (later.error) return NextResponse.json({ error: "Social metrics query failed" }, { status: 503, headers: metricsPrivateHeaders });
    facts.push(...(later.data as unknown as Record<string, unknown>[]));
  }
  const page = facts.slice(0, limit), ref = (value: unknown) => metricsExportReference(value, access.exportSecret);
  const owners = new Map<string, string>();
  if (kind === "shares") {
    // owner_token can move/change after the diagnosis. Resolve it again when
    // reading share history instead of freezing an old diagnosis-cache mapping.
    const tokens = [...new Set(page.map(f => f.owner_token).filter((v): v is string => typeof v === "string" && !!v))];
    for (let i = 0; i < tokens.length; i += 300) {
      const chunks = [tokens.slice(i, i + 100), tokens.slice(i + 100, i + 200), tokens.slice(i + 200, i + 300)].filter(c => c.length);
      const results = await Promise.all(chunks.map(chunk => supabaseAdmin.from("users").select("id,owner_token").in("owner_token", chunk).limit(1000)));
      if (results.some(r => r.error)) return NextResponse.json({ error: "Social owner lookup failed" }, { status: 503, headers: metricsPrivateHeaders });
      for (const result of results) for (const user of result.data || []) if (user.owner_token) owners.set(user.owner_token, user.id);
    }
  }
  const rows = page.map(f => {
    const common = { ref: ref(f.id), at: f[job.at] };
    if (kind === "diagnoses") return { ...common, parent_ref: ref(f.source_user_id), owner_ref: ref(f.owner_token) };
    if (kind === "friends") return { ...common, user_ref: ref(f.user_id) };
    const metadata = f.metadata as Record<string, unknown> | null;
    const locale = f.locale || metadata?.locale || "";
    return { ...common, owner_ref: ref(f.owner_token), user_ref: ref(owners.get(String(f.owner_token))), locale: typeof locale === "string" ? locale : "unknown" };
  });
  const last = page.at(-1);
  const windowComplete = kind === "shares" && facts.length <= limit;
  const nextCursor = windowComplete ? { at: new Date(Date.parse(scanUntil) - 1).toISOString(), id: "" } : last ? { at: last[job.at], id: last.id } : null;
  return NextResponse.json({ version: 1, kind, until, scanUntil, windowComplete, columns: job.columns, rows, nextCursor, hasMore: facts.length > limit || Date.parse(scanUntil) < Date.parse(until) }, { headers: metricsPrivateHeaders });
}
