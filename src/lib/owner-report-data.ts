// 結果ページ (自己 /me・他己 /tako) 共通の owner データローダー (サーバー専用)。
//
// /me の他己パート算出 (friend_perceptions 取得・友達平均・みんなの目 context・
// 招待URL・解除判定) を関数化し、新規 /tako/[token] から再利用する。
// ※ 判断: /me 側は既存インライン算出のまま据え置き (本番稼働中の自己パートを壊さない)。
//    重複は最終的に /me から他己算出を撤去することで解消する (Step4)。
//
// supabaseAdmin を使うためサーバーコンポーネント/ルートからのみ import すること。

import { supabaseAdmin } from "./supabase-server";
import { resolveSiteUrl } from "./site-url";
import {
  computeMinnaNoMeContext,
  type MinnaNoMeContext,
} from "./minna-no-me";
import { REPORT_FRIEND_THRESHOLD } from "./report-data";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoName,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "./thirty-two-types";
import { preferCutImage } from "./character-image";
import type { BigFiveDimension } from "./types";

const SITE_URL =
  resolveSiteUrl();

const DIMS: BigFiveDimension[] = ["E", "A", "O", "C", "N"];

export type OwnerReportUser = {
  id: string;
  type_id: string | null;
  scores: Partial<Record<BigFiveDimension, number>>;
  display_name: string | null;
  invite_code: string | null;
  owner_token: string | null;
};

export type FriendCharacter = {
  type32: ThirtyTwoTypeId;
  essence: string;
  name: string;
  imageSrc: string;
  previewPath: string;
};

export type OwnerReportData = {
  user: OwnerReportUser;
  selfScores: Partial<Record<BigFiveDimension, number>>;
  friendEvalCount: number;
  friendAvgScores: Partial<Record<BigFiveDimension, number>> | null;
  friendNames: string[];
  friendMessages: { name: string; message: string }[];
  minnaContext: MinnaNoMeContext | null;
  inviteCode: string;
  inviteUrl: string;
  threshold: number;
  /** friendEvalCount >= threshold かつ 友達平均あり。他己ページのロック解除条件。 */
  unlocked: boolean;
  /** 友達平均から算出した「みんなから見たキャラ」(unlocked 時のみ非null)。 */
  friendCharacter: FriendCharacter | null;
};

/**
 * owner_token から他己ページ (と /me 他己パート) に必要なデータ一式を取得・算出する。
 * users 行が見つからなければ null。
 */
export async function loadOwnerReportData(
  token: string,
): Promise<OwnerReportData | null> {
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, type_id, scores, display_name, invite_code, owner_token")
    .eq("owner_token", token)
    .maybeSingle();
  if (!userRow) return null;

  const user: OwnerReportUser = {
    id: userRow.id as string,
    type_id: (userRow.type_id as string | null) ?? null,
    scores: (userRow.scores ?? {}) as Partial<Record<BigFiveDimension, number>>,
    display_name: (userRow.display_name as string | null) ?? null,
    invite_code: (userRow.invite_code as string | null) ?? null,
    owner_token: (userRow.owner_token as string | null) ?? null,
  };
  const selfScores = user.scores;

  // friend_perceptions (件数 + perceived_scores + qualitative_data)
  const { data: perceptionRows } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id, perceived_scores, perceiver_name, qualitative_data, created_at")
    .eq("target_user_id", user.id)
    .order("created_at", { ascending: true });
  const rows = perceptionRows ?? [];
  const friendEvalCount = rows.length;

  const friendNames: string[] = rows.map((r) => {
    const n = ((r.perceiver_name as string | null) ?? "").trim();
    return n.length > 0 ? n : "ともだち";
  });

  // owner_message (手紙) は best-effort (列未適用でも壊さない)。
  let friendMessages: { name: string; message: string }[] = [];
  try {
    const { data: msgRows, error: msgErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select("perceiver_name, owner_message, created_at")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: true });
    if (!msgErr && msgRows) {
      friendMessages = msgRows
        .map((r) => ({
          name:
            ((r.perceiver_name as string | null) ?? "").trim() || "ともだち",
          message: ((r.owner_message as string | null) ?? "").trim(),
        }))
        .filter((m) => m.message.length > 0);
    }
  } catch {
    // 列未適用などは無視 (手紙非表示)
  }

  // 友達平均 (0-10)。数値のある軸だけ母数に平均。0件 or 全欠損なら null。
  const friendAvgScores: Partial<Record<BigFiveDimension, number>> | null =
    (() => {
      if (rows.length === 0) return null;
      const acc: Record<BigFiveDimension, { sum: number; n: number }> = {
        E: { sum: 0, n: 0 },
        A: { sum: 0, n: 0 },
        O: { sum: 0, n: 0 },
        C: { sum: 0, n: 0 },
        N: { sum: 0, n: 0 },
      };
      for (const r of rows) {
        const ps = (r.perceived_scores ?? {}) as Record<string, unknown>;
        for (const d of DIMS) {
          const v = ps[d];
          if (typeof v === "number") {
            acc[d].sum += v;
            acc[d].n += 1;
          }
        }
      }
      const avg: Partial<Record<BigFiveDimension, number>> = {};
      for (const d of DIMS) if (acc[d].n > 0) avg[d] = acc[d].sum / acc[d].n;
      return Object.keys(avg).length > 0 ? avg : null;
    })();

  const unlocked =
    friendEvalCount >= REPORT_FRIEND_THRESHOLD && friendAvgScores !== null;

  const minnaContext =
    unlocked
      ? computeMinnaNoMeContext({
          selfScores,
          friends: rows.map((r) => ({
            name:
              ((r.perceiver_name as string | null) ?? "").trim() || "ともだち",
            perceivedScores: (r.perceived_scores ?? null) as Record<
              string,
              unknown
            > | null,
            qualitative: (r.qualitative_data ?? null) as Record<
              string,
              unknown
            > | null,
          })),
        })
      : null;

  const friendCharacter: FriendCharacter | null =
    unlocked && friendAvgScores
      ? (() => {
          const t = classifyThirtyTwoType(friendAvgScores);
          return {
            type32: t,
            essence: thirtyTwoEssence(t),
            name: thirtyTwoName(t),
            imageSrc: preferCutImage(thirtyTwoImagePath(t)),
            previewPath: `/preview/${t}`,
          };
        })()
      : null;

  const inviteCode = user.invite_code ?? "";
  const inviteUrl = `${SITE_URL}/friend/${inviteCode}`;

  return {
    user,
    selfScores,
    friendEvalCount,
    friendAvgScores,
    friendNames,
    friendMessages,
    minnaContext,
    inviteCode,
    inviteUrl,
    threshold: REPORT_FRIEND_THRESHOLD,
    unlocked,
    friendCharacter,
  };
}
