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
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
} from "./perception-analysis";
import type { BigFiveDimension } from "./types";

const SITE_URL =
  resolveSiteUrl();

const DIMS: BigFiveDimension[] = ["E", "A", "O", "C", "N"];

// 総合ページの友達メッセージ「チラ見せ」上限文字数。
// PR2 (leak塞ぎ): 全文は総合ページの payload / RSC / View Source に絶対に載せない。
// 課金判定は噛ませず全員この1行プレビューだけを返す (全文が要るのは個別ページ側のみ)。
// フロントの CSS truncate はもう「隠す」役割ではなく単なる整形 (データが既に1行)。
const MESSAGE_PREVIEW_MAX = 40;

function toMessagePreview(message: string | null | undefined): string {
  if (!message) return "";
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  return oneLine.length > MESSAGE_PREVIEW_MAX
    ? oneLine.slice(0, MESSAGE_PREVIEW_MAX) + "…"
    : oneLine;
}

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

// 友達一覧・個別ページ用の評価者1人分サマリ (総合ページ /tako → 個別ページの導線に使う)。
export type FriendSummary = {
  /** friend_perceptions.id (個別ページ /tako/[token]/friend/[perceptionId] のキー)。 */
  perceptionId: string;
  /** 評価者ニックネーム (空は「ともだち」)。 */
  name: string;
  /** その友達が付けた perceived_scores (0-10)。 */
  perceivedScores: Partial<Record<BigFiveDimension, number>>;
  /** 本人自己スコアとの相互理解度 % (0-100)。 */
  mutual: number;
  /** ひとことメッセージ (owner_message) がある友達か。 */
  hasMessage: boolean;
  /**
   * ひとことメッセージの1行プレビュー (最大 MESSAGE_PREVIEW_MAX 文字)。無ければ空文字。
   * 全文はここに載せない (leak塞ぎ)。全文表示は個別ページが別途 owner_message を取得する。
   */
  message: string;
};

export type OwnerReportData = {
  user: OwnerReportUser;
  selfScores: Partial<Record<BigFiveDimension, number>>;
  friendEvalCount: number;
  friendAvgScores: Partial<Record<BigFiveDimension, number>> | null;
  friendNames: string[];
  friendMessages: { name: string; message: string }[];
  /** 評価してくれた全員 (メッセージ有無問わず・相互理解度の高い順)。友達一覧に使う。 */
  friends: FriendSummary[];
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
  //   手紙表示用 friendMessages と、友達一覧用の「メッセージ有りID集合」を同時に作る。
  const friendMessages: { name: string; message: string }[] = [];
  const messageById = new Map<string, string>();
  try {
    const { data: msgRows, error: msgErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id, perceiver_name, owner_message, created_at")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: true });
    if (!msgErr && msgRows) {
      for (const r of msgRows) {
        const message = ((r.owner_message as string | null) ?? "").trim();
        if (message.length > 0) {
          friendMessages.push({
            name:
              ((r.perceiver_name as string | null) ?? "").trim() || "ともだち",
            message,
          });
          messageById.set(r.id as string, message);
        }
      }
    }
  } catch {
    // 列未適用などは無視 (手紙非表示)
  }

  // 友達一覧 (評価者全員・メッセージ有無問わず)。相互理解度の高い順。
  const friends: FriendSummary[] = rows
    .map((r) => {
      const perceivedScores = (r.perceived_scores ?? {}) as Partial<
        Record<BigFiveDimension, number>
      >;
      const mutual = calcMutualUnderstanding(
        buildDimensionGaps(selfScores, perceivedScores),
      );
      const fullMessage = messageById.get(r.id as string) ?? "";
      return {
        perceptionId: r.id as string,
        name: ((r.perceiver_name as string | null) ?? "").trim() || "ともだち",
        perceivedScores,
        mutual,
        // バッジ判定は全文の有無で行う (「メッセージあり」表示は無料)。
        hasMessage: fullMessage.trim().length > 0,
        // ★payload に載せるのは1行プレビューのみ。全文は絶対に載せない (leak塞ぎ)。
        message: toMessagePreview(fullMessage),
      };
    })
    .sort((a, b) => b.mutual - a.mutual);

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
    friends,
    minnaContext,
    inviteCode,
    inviteUrl,
    threshold: REPORT_FRIEND_THRESHOLD,
    unlocked,
    friendCharacter,
  };
}
