// Phase 3-β A-5: friend_perceptions テーブルへの書き込み専用ヘルパー。
// B-2 (新 friend-answer API) から呼び出される想定。A-5 単体ではエンドポイントが
// 接続されていないため、純粋にロジック単体として配置。

import { supabaseAdmin } from "./supabase-server";
import type { FriendPerceptionV2, FriendQualitativeData } from "./friend-perception-v2";

export type PerceiverInfo = {
  /** UI で入力 or LINE プロフィールから取得した友達名 (必須) */
  name: string;
  /** 友達自身も診断済 ユーザーなら users.id (任意) */
  userId?: string | null;
  /** LINE 連携済の友達なら line_user_id (任意) */
  lineUserId?: string | null;
  /**
   * T3-3 (B3): PDF 利用同意フラグ。
   * - true: AI 統合トリセツ PDF に名前付きで載せることに同意
   * - false (デフォルト): Web 閲覧のみ可、PDF 化と AI 統合素材化は不可
   * 省略時は false 扱い (オプトイン制)
   */
  pdfConsent?: boolean;
};

export type WriteFriendPerceptionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * 計算済の FriendPerceptionV2 を friend_perceptions テーブルに INSERT する。
 *
 * 設計上の注意:
 * - notified_at は NULL のまま挿入 (D-8 で通知時に UPDATE される)
 * - qualitative_data は perception 引数の qualitativeData を優先、
 *   引数明示があればそちらで上書き
 * - 失敗時は DB エラーメッセージを ok: false で返す (呼び出し側で握り潰し or 再試行)
 *
 * @param targetUserId 評価対象 (owner) の users.id
 * @param friendAnswerId 元 friend_answers.id (削除時 cascade)。新規流入が friend_answers
 *                       を作らない設計に変えるなら null も許容
 * @param perception 計算済 FriendPerceptionV2 (perceiveFromFriendAnswersV2 の戻り値)
 * @param perceiver 評価者情報 (name 必須、user_id / line_user_id 任意)
 * @param qualitativeOverride perception.qualitativeData を上書きしたい場合のみ
 */
export async function writeFriendPerception(
  targetUserId: string,
  friendAnswerId: string | null,
  perception: FriendPerceptionV2,
  perceiver: PerceiverInfo,
  qualitativeOverride?: FriendQualitativeData,
): Promise<WriteFriendPerceptionResult> {
  const qualitative_data =
    qualitativeOverride ?? perception.qualitativeData ?? null;

  const pdfConsent = perceiver.pdfConsent === true;

  const { data, error } = await supabaseAdmin
    .from("friend_perceptions")
    .insert({
      target_user_id: targetUserId,
      perceiver_name: perceiver.name,
      perceiver_user_id: perceiver.userId ?? null,
      perceiver_line_user_id: perceiver.lineUserId ?? null,
      perceived_type_id: perception.typeId,
      perceived_modifier_c_f: perception.cModifier,
      perceived_modifier_n_r: perception.nModifier,
      perceived_full_code: perception.fullCode,
      perceived_modifier_label: perception.modifierLabel,
      perceived_modifier_paragraph: perception.modifierParagraph,
      perceived_scores: perception.scores,
      perceived_facet_scores: perception.facetScores,
      qualitative_data,
      friend_answer_id: friendAnswerId,
      // T3-3: pdf_consent_at は同意時のみ NOW()、未同意は null
      pdf_consent: pdfConsent,
      pdf_consent_at: pdfConsent ? new Date().toISOString() : null,
      // notified_at: 明示せず DB デフォルト (NULL) のまま。D-8 で通知後に UPDATE。
    })
    .select("id")
    .single();

  if (error) {
    console.error("[friend-perception-write] insert error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id as string };
}
