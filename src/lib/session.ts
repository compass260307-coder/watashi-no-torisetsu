// プレミアム化 v3 Day 2: Cookie ベース session 管理
//
// Web ファースト + ログインなしモデルの認可基盤。
// 既存 src/lib/liff-verify.ts (LIFF id_token 検証) を Day 4 以降で
// この session module に差し替える。
//
// データモデル: users.session_token (nanoid 32, UNIQUE, nullable)
// 計画書: docs/PREMIUM_V3_DAY1_MIGRATION_PLAN.md § 3
//
// 注: Day 2 計画書では createSession() を引数なしの想定で書かれているが、
// users テーブルは type_id / scores / invite_code / owner_token に NOT NULL
// 制約がある (Day 1 で「既存スキーマ非破壊」方針を確定)。
// このため createSession は診断結果データを受け取る引数を持つ。
// 呼び出し側は /api/diagnosis (Day 4 で置換予定)。

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { nanoid } from "nanoid";

import { isMissingCoreKpiColumn } from "./core-kpis";
import { supabaseAdmin } from "./supabase-server";

export const SESSION_COOKIE_NAME = "wn_session";
const TOKEN_LENGTH = 32; // nanoid 32 文字 = 192 bit エントロピー
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const SESSION_USER_COLUMNS =
  "id, type_id, owner_token, email, email_verified_at, display_name, line_user_id, diagnosis_completed_at";
const LEGACY_SESSION_USER_COLUMNS =
  "id, type_id, owner_token, email, email_verified_at, display_name, line_user_id";

export interface SessionUser {
  id: string;
  type_id: string;
  owner_token: string | null;
  email: string | null;
  email_verified_at: string | null;
  display_name: string | null;
  line_user_id: string | null;
  diagnosis_completed_at: string | null;
}

export interface CreateSessionPayload {
  type_id: string;
  scores: unknown;
  invite_code: string;
  owner_token: string;
  display_name?: string | null;
  campaign?: string | null;
  source_user_id?: string | null;
  generation?: number | null;
  line_user_id?: string | null;
  // Day 12-C3: SNS媒体別＋キャンペーン別の流入元 (新規作成時のみ・first-touch)。
  // source_user_id / generation (招待ツリー) とは別系統。
  acquisition_source?: string | null;
  acquisition_campaign?: string | null;
  // 診断データは言語共通。初回流入言語と現在の表示言語だけを別カラムで持つ。
  acquisition_locale?: "ja" | "ko";
  preferred_locale?: "ja" | "ko";
  diagnosis_completed_at?: string;
}

function generateSessionToken(): string {
  return nanoid(TOKEN_LENGTH);
}

function buildCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  };
}

/**
 * リクエストの Cookie から session を解決して users 行を返す。
 *
 * Cookie 不在 / token に一致する users 行なし → null。
 *
 * 使い分け:
 *   - API route (Route Handler): getSession(request)
 *   - Server Component / Server Action: getSession() (next/headers cookies() を使用)
 *
 * 認可済み API route の入口で呼ぶ:
 *   const user = await getSession(request);
 *   if (!user) return new Response("Unauthorized", { status: 401 });
 */
export async function getSession(
  request?: NextRequest,
): Promise<SessionUser | null> {
  let token: string | undefined;
  if (request) {
    token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  } else {
    const c = await cookies();
    token = c.get(SESSION_COOKIE_NAME)?.value;
  }
  if (!token) return null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(SESSION_USER_COLUMNS)
    .eq("session_token", token)
    .maybeSingle();

  if (isMissingCoreKpiColumn(error, "diagnosis_completed_at")) {
    const legacyResult = await supabaseAdmin
      .from("users")
      .select(LEGACY_SESSION_USER_COLUMNS)
      .eq("session_token", token)
      .maybeSingle();
    if (legacyResult.error) {
      console.error("[session] getSession legacy query error:", legacyResult.error);
      return null;
    }
    return legacyResult.data
      ? ({
          ...legacyResult.data,
          diagnosis_completed_at: null,
        } as SessionUser)
      : null;
  }
  if (error) {
    console.error("[session] getSession query error:", error);
    return null;
  }
  return (data as SessionUser | null) ?? null;
}

/**
 * 新規 users 行を session_token 付きで INSERT し、レスポンスに Cookie をセット。
 *
 * /api/diagnosis から呼び出される想定。診断結果 (type_id / scores 等) を
 * payload で受け取る (users の NOT NULL 制約を満たすため)。
 *
 * 戻り値: 作成された users 行 + 生成された token。
 */
export async function createSession(
  userData: CreateSessionPayload,
): Promise<{ user: SessionUser; token: string }> {
  const token = generateSessionToken();

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({ ...userData, session_token: token })
    .select(SESSION_USER_COLUMNS)
    .single();

  let createdUser: SessionUser | null = (data as SessionUser | null) ?? null;
  let createError = error;
  if (isMissingCoreKpiColumn(error, "diagnosis_completed_at")) {
    const legacyUserData = { ...userData };
    delete legacyUserData.diagnosis_completed_at;
    const legacyResult = await supabaseAdmin
      .from("users")
      .insert({ ...legacyUserData, session_token: token })
      .select(LEGACY_SESSION_USER_COLUMNS)
      .single();
    createError = legacyResult.error;
    createdUser = legacyResult.data
      ? ({
          ...legacyResult.data,
          diagnosis_completed_at: null,
        } as SessionUser)
      : null;
  }

  if (createError || !createdUser) {
    throw new Error(
      `createSession failed: ${createError?.message ?? "no row returned"}`,
    );
  }

  const c = await cookies();
  c.set(SESSION_COOKIE_NAME, token, buildCookieOptions());

  return { user: createdUser, token };
}

/**
 * 既存ユーザーの session_token を再生成 (rotate)。
 * マジックリンク verify 成功時、アカウント設定変更後など、
 * セキュリティ重要操作後に呼ぶ。
 *
 * 旧 token は即座に無効化される (UNIQUE 制約 + UPDATE で上書き)。
 */
export async function rotateSession(userId: string): Promise<string> {
  const token = generateSessionToken();

  const { error } = await supabaseAdmin
    .from("users")
    .update({ session_token: token })
    .eq("id", userId);

  if (error) {
    throw new Error(`rotateSession failed: ${error.message}`);
  }

  const c = await cookies();
  c.set(SESSION_COOKIE_NAME, token, buildCookieOptions());

  return token;
}

/**
 * session を破棄: DB の session_token を NULL にし、Cookie を削除。
 * ログアウト操作・アカウント削除の前段で呼ぶ。idempotent。
 */
export async function destroySession(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("users")
    .update({ session_token: null })
    .eq("id", userId);

  if (error) {
    console.error("[session] destroySession DB update error:", error);
    // Cookie 側は削除を試みる (DB エラーでも Cookie は消す)
  }

  const c = await cookies();
  c.delete(SESSION_COOKIE_NAME);
}
