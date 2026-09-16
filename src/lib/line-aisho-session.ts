import "server-only";

import {
  createLineAishoResult,
  type LineAishoRelationship,
  type LineAishoResult,
} from "@/lib/line-aisho";
import { supabaseAdmin } from "@/lib/supabase-server";

export type LineAishoSessionStep =
  | "partner_name"
  | "relationship"
  | "partner_birth_date"
  | "you_birth_date"
  | "confirm";

export interface LineAishoSessionData {
  partnerName?: string;
  relationship?: LineAishoRelationship;
  partnerBirthDate?: string;
  youBirthDate?: string;
}

export interface LineAishoSession {
  lineUserId: string;
  userId: string;
  step: LineAishoSessionStep;
  data: LineAishoSessionData;
}

const SESSION_TTL_MS = 30 * 60 * 1_000;

const RELATIONSHIP_BY_LABEL: Record<string, LineAishoRelationship> = {
  "片思い": "crush",
  "片思い・気になる人": "crush",
  "気になる人": "crush",
  "恋人": "dating",
  "交際中": "dating",
  "夫婦・長い交際": "partner",
  "夫婦": "partner",
  "復縁": "reconciliation",
  "元恋人・復縁": "reconciliation",
  "その他": "other",
};

function expiresAt(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

function isStep(value: unknown): value is LineAishoSessionStep {
  return [
    "partner_name",
    "relationship",
    "partner_birth_date",
    "you_birth_date",
    "confirm",
  ].includes(String(value));
}

function safeData(value: unknown): LineAishoSessionData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    partnerName:
      typeof raw.partnerName === "string" ? raw.partnerName.slice(0, 20) : undefined,
    relationship:
      typeof raw.relationship === "string" &&
      ["crush", "dating", "partner", "reconciliation", "other"].includes(
        raw.relationship,
      )
        ? (raw.relationship as LineAishoRelationship)
        : undefined,
    partnerBirthDate:
      typeof raw.partnerBirthDate === "string"
        ? raw.partnerBirthDate.slice(0, 10)
        : undefined,
    youBirthDate:
      typeof raw.youBirthDate === "string"
        ? raw.youBirthDate.slice(0, 10)
        : undefined,
  };
}

export function normalizeLineAishoBirthDate(input: string): string | null {
  const normalized = input
    .trim()
    .replace(/[０-９]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
    )
    .replace(/\s+/g, "");
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(normalized);
  const separated = /^(\d{4})[年/\.\-](\d{1,2})[月/\.\-](\d{1,2})日?$/.exec(
    normalized,
  );
  const match = compact ?? separated;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1901 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getTime() > Date.now()
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatLineAishoBirthDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function parseLineAishoRelationship(
  input: string,
): LineAishoRelationship | null {
  return RELATIONSHIP_BY_LABEL[input.trim().replace(/\s+/g, "")] ?? null;
}

export async function startLineAishoSession(input: {
  lineUserId: string;
  userId: string;
}): Promise<boolean> {
  // 通常のトークでも期限切れ行を少しずつ掃除できるよう、開始時にまとめて削除する。
  await supabaseAdmin
    .from("line_aisho_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());
  const { error } = await supabaseAdmin.from("line_aisho_sessions").upsert(
    {
      line_user_id: input.lineUserId,
      user_id: input.userId,
      step: "partner_name",
      data: {},
      expires_at: expiresAt(),
    },
    { onConflict: "line_user_id" },
  );
  if (error) {
    console.error("[line-aisho] failed to start session", {
      message: error.message,
    });
    return false;
  }
  return true;
}

export async function loadLineAishoSession(
  lineUserId: string,
): Promise<LineAishoSession | null> {
  const { data, error } = await supabaseAdmin
    .from("line_aisho_sessions")
    .select("line_user_id, user_id, step, data, expires_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (error) {
    console.error("[line-aisho] failed to load session", {
      message: error.message,
    });
    return null;
  }
  if (!data || !isStep(data.step)) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await deleteLineAishoSession(lineUserId);
    return null;
  }
  return {
    lineUserId: data.line_user_id,
    userId: data.user_id,
    step: data.step,
    data: safeData(data.data),
  };
}

export async function updateLineAishoSession(
  session: LineAishoSession,
  step: LineAishoSessionStep,
  data: LineAishoSessionData,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("line_aisho_sessions")
    .update({ step, data, expires_at: expiresAt() })
    .eq("line_user_id", session.lineUserId)
    .eq("user_id", session.userId);
  if (error) {
    console.error("[line-aisho] failed to update session", {
      message: error.message,
    });
    return false;
  }
  return true;
}

export async function deleteLineAishoSession(lineUserId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("line_aisho_sessions")
    .delete()
    .eq("line_user_id", lineUserId);
  if (error) {
    console.error("[line-aisho] failed to delete session", {
      message: error.message,
    });
  }
}

export function createResultFromLineAishoSession(input: {
  session: LineAishoSession;
  youName: string;
}): LineAishoResult {
  const { data } = input.session;
  if (
    !data.partnerName ||
    !data.relationship ||
    !data.partnerBirthDate ||
    !data.youBirthDate
  ) {
    throw new Error("incomplete_aisho_session");
  }
  return createLineAishoResult({
    you: {
      name: input.youName || "あなた",
      birthDate: data.youBirthDate,
    },
    partner: {
      name: data.partnerName,
      birthDate: data.partnerBirthDate,
    },
    relationship: data.relationship,
  });
}
