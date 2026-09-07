// LINE連携コード発行。LIFF用はURL安全な32文字、手入力用は6桁。
// 平文はレスポンスで一度だけ返し、DBにはHMACのみを保存する。

import { randomBytes, randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { hashLineLinkCode } from "@/lib/line";
import { checkOrigin } from "@/lib/origin-check";
import { isUndiagnosedPlaceholderUser } from "@/lib/placeholder-user";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const CODE_TTL_MS = 10 * 60 * 1000;
type CodeKind = "liff" | "manual";

function createCode(kind: CodeKind): string {
  return kind === "liff"
    ? randomBytes(24).toString("base64url")
    : String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return json({ error: "login_required", linked: false }, 401);
  }

  const { data, error } = await supabaseAdmin
    .from("line_accounts")
    .select("id")
    .eq("user_id", session.id)
    .not("linked_at", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[line/link-code] linked status lookup failed", {
      message: error.message,
    });
    return json({ error: "link_status_failed" }, 503);
  }
  return json({ linked: Boolean(data) });
}

export async function POST(request: NextRequest) {
  const origin = checkOrigin(request);
  if (!origin.ok) {
    return json({ error: "forbidden_origin" }, 403);
  }

  const session = await getSession(request);
  if (!session) {
    return json({ error: "login_required" }, 401);
  }

  let kind: CodeKind = "manual";
  if (request.body) {
    const parsed = await readJsonObject(request, 1024);
    if (!parsed.ok) {
      return json({ error: "invalid_body" }, parsed.status);
    }
    if (parsed.value.kind !== undefined) {
      if (parsed.value.kind !== "liff" && parsed.value.kind !== "manual") {
        return json({ error: "invalid_kind" }, 400);
      }
      kind = parsed.value.kind;
    }
  }

  const { data: diagnosis, error: diagnosisError } = await supabaseAdmin
    .from("users")
    .select("scores, diagnosis_completed_at")
    .eq("id", session.id)
    .maybeSingle();
  if (diagnosisError || !diagnosis) {
    return json({ error: "diagnosis_lookup_failed" }, 503);
  }
  if (isUndiagnosedPlaceholderUser(diagnosis)) {
    return json({ error: "diagnosis_required" }, 409);
  }

  const nowIso = new Date().toISOString();

  // 未使用・有効な同種コードを置き換える再発行はレート制限に数えない。
  // 平文を保存していないため、サーバーは同じ値を再返却せず新しい値へ差し替える。
  const { data: activeCode, error: activeLookupError } = await supabaseAdmin
    .from("line_link_codes")
    .select("id")
    .eq("user_id", session.id)
    .eq("kind", kind)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .limit(1)
    .maybeSingle();
  if (activeLookupError) {
    console.error("[line/link-code] active code lookup failed", {
      kind,
      message: activeLookupError.message,
    });
    return json({ error: "code_issue_failed" }, 503);
  }

  if (!activeCode) {
    const rateLimit = await consumeRateLimit(request, {
      scope: `line-link-code-issue-user-${kind}`,
      identifier: session.id,
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) {
      return json({ error: "rate_limited" }, 429);
    }
  }

  // 再発行時は本人の同種の未消費コードを無効化し、期限切れ行も掃除する
  // (uq_line_link_codes_active_code の衝突空間を空けるため)。
  const { error: invalidateError } = await supabaseAdmin
    .from("line_link_codes")
    .delete()
    .eq("user_id", session.id)
    .eq("kind", kind)
    .is("consumed_at", null);
  if (invalidateError) {
    console.error("[line/link-code] previous code invalidation failed", {
      kind,
      message: invalidateError.message,
    });
    return json({ error: "code_issue_failed" }, 503);
  }
  await supabaseAdmin
    .from("line_link_codes")
    .delete()
    .is("consumed_at", null)
    .lt("expires_at", nowIso);

  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = createCode(kind);
    const { error } = await supabaseAdmin.from("line_link_codes").insert({
      code_hash: hashLineLinkCode(code),
      user_id: session.id,
      expires_at: expiresAt,
      kind,
    });

    if (!error) {
      return json({ code, expires_at: expiresAt, kind });
    }
    // 23505 = 有効コードの衝突。別の乱数で再試行
    if (error.code !== "23505") {
      console.error("[line/link-code] insert failed", {
        message: error.message,
      });
      break;
    }
  }

  return json({ error: "code_issue_failed" }, 503);
}
