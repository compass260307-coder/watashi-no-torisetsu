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
  baseIdOf,
  type ThirtyTwoTypeId,
} from "./thirty-two-types";
import { sixteenTypes } from "./sixteen-types";
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
// friend_perceptions の perceived_type_id (16タイプ base) + N軸 ('N'/'R') から
// 32タイプ ID を組み立て、シェア連動ゲートの answered スロットの“顔”に使う。
// 不正/未知のタイプは null を返し、呼び出し側で頭文字プレースホルダにフォールバックさせる。
function buildPerceivedFace(
  typeIdBase: string | null | undefined,
  nAxis: string | null | undefined,
): { type32: ThirtyTwoTypeId | null; imageSrc: string | null } {
  const base = (typeIdBase ?? "").trim();
  const n = (nAxis ?? "").trim().toUpperCase();
  if (!base || (n !== "N" && n !== "R")) {
    return { type32: null, imageSrc: null };
  }
  const type32 = `${base}__${n}` as ThirtyTwoTypeId;
  // base が既知の16タイプでなければ画像パスが壊れるので弾く。
  if (!sixteenTypes[baseIdOf(type32)]) {
    return { type32: null, imageSrc: null };
  }
  return { type32, imageSrc: preferCutImage(thirtyTwoImagePath(type32)) };
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
   * ひとことメッセージの全文。無ければ空文字。
   * 2026-07-20: メッセージは無料コンテンツ (タブの吹き出しで表示) になったため
   * 全文を載せる (旧: 課金個別ページ向けの leak 塞ぎで 1 行プレビューのみだった)。
   */
  message: string;
  /**
   * 「その友達から見たあなた」の 32 タイプ (perceived_type_id + N軸)。
   * シェア連動ゲートの answered スロットの“顔”に使う。不正/欠損時は null。
   */
  perceivedType32: ThirtyTwoTypeId | null;
  /** perceivedType32 のキャラ画像 (透過版優先)。null なら顔なし (頭文字にフォールバック)。 */
  perceivedImageSrc: string | null;
  /**
   * 評価者自身も診断済みユーザーなら users.id。相性ループ (answered→/aisho) の
   * CTA 可否判定に使う (有りのときだけ「この人との相性を見る」を出す)。
   */
  perceiverUserId: string | null;
  /**
   * その友達“本人”の32型 (perceiver_user_id → users.scores から算出)。
   * 相性ループ Path1 (/aisho?b=) に使う。友達が自己診断済み & リンク済みのときだけ非null。
   * ※現状 friend-answer は perceiver_user_id を書かないため実データは常に null (Path2)。
   */
  friendOwnType32: ThirtyTwoTypeId | null;
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
  /**
   * いま診断中 (回答開始したが未完了) の友達の近似人数。
   * events の friend_answer_started / friend_answer_completed から直近ウィンドウで概算。
   * 厳密ではない (best-effort、失敗時 0)。シェア連動ゲートの pending スロットに使う。
   */
  pendingFriendCount: number;
  inviteCode: string;
  inviteUrl: string;
  threshold: number;
  /** friendEvalCount >= threshold かつ 友達平均あり。他己ページのロック解除条件。 */
  unlocked: boolean;
  /** 友達平均から算出した「みんなから見たキャラ」(unlocked 時のみ非null)。 */
  friendCharacter: FriendCharacter | null;
  /** 本人“自身”の32型 (自己スコアから算出)。相性ループ Path1 の /aisho?a= に使う。無ければ null。 */
  ownerType32: ThirtyTwoTypeId | null;
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
    .select(
      "id, perceived_scores, perceiver_name, perceiver_user_id, perceived_type_id, perceived_modifier_n_r, qualitative_data, created_at",
    )
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

  // 相性ループ Path1 用: answered 友達“本人”の32型 (perceiver_user_id → users.scores)。
  // ※現状 friend-answer は perceiver_user_id を書かないため perceiverIds は常に空 = スキップ。
  const perceiverIds = Array.from(
    new Set(
      rows
        .map((r) => (r.perceiver_user_id as string | null) ?? null)
        .filter((v): v is string => !!v),
    ),
  );
  const friendOwnTypeById = new Map<string, ThirtyTwoTypeId>();
  if (perceiverIds.length > 0) {
    const { data: friendUsers } = await supabaseAdmin
      .from("users")
      .select("id, scores")
      .in("id", perceiverIds);
    for (const u of friendUsers ?? []) {
      const scores = (u.scores ?? {}) as Partial<
        Record<BigFiveDimension, number>
      >;
      if (Object.keys(scores).length > 0) {
        friendOwnTypeById.set(u.id as string, classifyThirtyTwoType(scores));
      }
    }
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
      const face = buildPerceivedFace(
        r.perceived_type_id as string | null,
        r.perceived_modifier_n_r as string | null,
      );
      return {
        perceptionId: r.id as string,
        name: ((r.perceiver_name as string | null) ?? "").trim() || "ともだち",
        perceivedScores,
        mutual,
        hasMessage: fullMessage.trim().length > 0,
        // メッセージは無料コンテンツ (タブの吹き出し) になったため全文を載せる。
        message: fullMessage.trim(),
        perceivedType32: face.type32,
        perceivedImageSrc: face.imageSrc,
        perceiverUserId: (r.perceiver_user_id as string | null) ?? null,
        friendOwnType32: (() => {
          const pid = (r.perceiver_user_id as string | null) ?? null;
          return pid ? friendOwnTypeById.get(pid) ?? null : null;
        })(),
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

  // 本人“自身”の32型 (自己スコアから)。相性ループ Path1 の /aisho?a= に使う。
  const ownerType32: ThirtyTwoTypeId | null =
    Object.keys(selfScores).length > 0
      ? classifyThirtyTwoType(selfScores)
      : null;

  const inviteCode = user.invite_code ?? "";
  const inviteUrl = `${SITE_URL}/friend/${inviteCode}`;

  // 「診断中」の近似人数 (best-effort)。events の friend_answer_started のうち、
  // 直近 PENDING_WINDOW_MIN 分・同 session が friend_answer_completed していない = まだ回答中、
  // と見なす。厳密な突合ではないので誤差はある (失敗時 0)。
  const pendingFriendCount = await countPendingFriendDiagnoses(
    inviteCode,
    friendEvalCount,
    REPORT_FRIEND_THRESHOLD,
  );

  return {
    user,
    selfScores,
    friendEvalCount,
    friendAvgScores,
    friendNames,
    friendMessages,
    friends,
    minnaContext,
    pendingFriendCount,
    inviteCode,
    inviteUrl,
    threshold: REPORT_FRIEND_THRESHOLD,
    unlocked,
    friendCharacter,
    ownerType32,
  };
}

// 「診断中」判定の直近ウィンドウ (分)。これより前に開始して未完了なら離脱扱いで数えない。
const PENDING_WINDOW_MIN = 30;

/**
 * events から「いま診断中」の友達の近似人数を出す (best-effort)。
 *   直近 PENDING_WINDOW_MIN 分の friend_answer_started の distinct session のうち、
 *   同ウィンドウで friend_answer_completed していない session 数を pending とみなす。
 * 厳密な session 突合ではないため誤差あり。events 取得失敗・列欠損時は 0。
 *
 * さらに残り空きスロット (threshold - answered) を上限にクランプし、
 * 解放間近で pending が過剰表示されないようにする。
 */
async function countPendingFriendDiagnoses(
  inviteCode: string,
  answeredCount: number,
  threshold: number,
): Promise<number> {
  if (!inviteCode) return 0;
  const remainingSlots = Math.max(0, threshold - answeredCount);
  if (remainingSlots === 0) return 0;
  try {
    const sinceIso = new Date(
      Date.now() - PENDING_WINDOW_MIN * 60_000,
    ).toISOString();
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("event_name, session_id, created_at")
      .eq("invite_code", inviteCode)
      .in("event_name", ["friend_answer_started", "friend_answer_completed"])
      .gte("created_at", sinceIso);
    if (error || !data) return 0;

    const started = new Set<string>();
    const completed = new Set<string>();
    for (const row of data) {
      const sid = (row.session_id as string | null) ?? "";
      if (!sid) continue;
      if (row.event_name === "friend_answer_completed") completed.add(sid);
      else started.add(sid);
    }
    let pending = 0;
    for (const sid of started) if (!completed.has(sid)) pending += 1;
    return Math.min(pending, remainingSlots);
  } catch {
    return 0;
  }
}
