import "server-only";
import { hasFullAccess, hasPremiumBundleAccess } from "@/lib/entitlements";
import { deterministicLineEventId } from "@/lib/line-events";
import { quickReplies, type LineOutgoingMessage } from "@/lib/line";
import { buildLineResultUpgradeUrl, buildLineResultUpgradeCheckoutUrl } from "@/lib/line-result-upgrade";
import { LINE_UPGRADE_INTRO, LINE_UPGRADE_RESUME, LINE_UPGRADE_CANCELLED, LINE_UPGRADE_CANCEL, LINE_UPGRADE_OFFER_MESSAGE, lineUpgradeQuestion, lineUpgradePurchaseMessage, lineUpgradePurchaseCard } from "@/lib/line-upgrade-dialogue";
import { LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH, isResultUpgradeReady, normalizeResultUpgradeAnswers, RESULT_UPGRADE_QUESTIONS, type ResultUpgradeRow } from "@/lib/result-upgrade";
import { loadResultUpgradeForUser, resolveResultUpgradeBase } from "@/lib/result-upgrade-server";
import { supabaseAdmin } from "@/lib/supabase-server";

const SESSION_NAME = "line_result_upgrade_chat_session";
const ANSWER_NAME = "line_result_upgrade_chat_answer";
const TTL_MS = 30 * 60_000;
function sessionId(lineUserId: string, userId: string) {
  return deterministicLineEventId(SESSION_NAME, `${lineUserId}:${userId}`);
}
function question(index: number): LineOutgoingMessage[] {
  return [{ type: "text", text: lineUpgradeQuestion(index), quickReply: quickReplies(LINE_UPGRADE_CANCEL) }];
}
function unavailable(): LineOutgoingMessage[] {
  return [{ type: "text", text: "ごめんね、いま回答を保存できなかったみたい。少し待ってから「結果アップグレード」と送ってね。続きからお話しできるよ。" }];
}
async function setActive(lineUserId: string, userId: string, active: boolean) {
  // Control data only. Personal answers remain exclusively in the private result_upgrades table.
  const { error } = await supabaseAdmin.from("events").upsert({
    id: sessionId(lineUserId, userId), event_name: SESSION_NAME, owner_token: null, locale: "ja",
    metadata: { active, expires_at: new Date(Date.now() + TTL_MS).toISOString() },
  }, { onConflict: "id" });
  if (error) throw new Error("LINE upgrade conversation state unavailable");
}
export async function cancelLineUpgradeChat(lineUserId: string, userId: string) {
  const { error } = await supabaseAdmin.from("events").update({ metadata: { active: false } })
    .eq("id", sessionId(lineUserId, userId));
  if (error) throw new Error("LINE upgrade conversation cancel failed");
}
export async function hasLineUpgradeChat(lineUserId: string, userId: string) {
  const { data, error } = await supabaseAdmin.from("events").select("metadata")
    .eq("id", sessionId(lineUserId, userId)).maybeSingle();
  if (error) throw new Error("LINE upgrade conversation lookup failed");
  return data?.metadata?.active === true;
}
async function completion(lineUserId: string, userId: string, paid: boolean): Promise<LineOutgoingMessage[]> {
  await setActive(lineUserId, userId, false);
  if (paid) return [{ type: "text", text: `${lineUpgradePurchaseMessage(true)}\n\n${buildLineResultUpgradeUrl(lineUserId, userId)}` }];
  return [
    { type: "text", text: LINE_UPGRADE_OFFER_MESSAGE },
    lineUpgradePurchaseCard(buildLineResultUpgradeCheckoutUrl(lineUserId, userId)),
  ];
}
// Preserve previously saved answers; the 50-character limit applies to new messages.
function validDraft(row: ResultUpgradeRow) {
  return row.locale === "ja" && Array.isArray(row.answers) && row.answers.length <= RESULT_UPGRADE_QUESTIONS.length &&
    row.answers.every(answer => typeof answer === "string" && answer.trim().length > 0 && answer.length <= 500);
}

export async function startLineUpgradeChat(lineUserId: string, userId: string): Promise<LineOutgoingMessage[]> {
  if (!(await hasFullAccess(userId))) return [{ type: "text", text: "結果アップグレードは、完全版を購入した人向けの追加サービスだよ。Webの診断結果から完全版を購入したあと、またここに来てね。" }];
  let row = await loadResultUpgradeForUser(userId);
  if (!row) {
    const source = await resolveResultUpgradeBase(userId);
    const { error } = await supabaseAdmin.from("result_upgrades").insert({
      user_id: userId, locale: "ja", answers: [], source_type_id: source.sourceTypeId,
      source_character_path: source.sourceCharacterPath, state: "answers_ready",
    });
    if (error && error.code !== "23505") return unavailable();
    row = await loadResultUpgradeForUser(userId);
  }
  if (!row || !validDraft(row)) return [{ type: "text", text: "この診断のアップグレード情報が見つからなかったみたい。購入した診断結果と、このLINEが連携されているか確認してみてね。" }];
  const paid = await hasPremiumBundleAccess(userId);
  if (isResultUpgradeReady(row) || row.state === "generating" || normalizeResultUpgradeAnswers(row.answers)) {
    return completion(lineUserId, userId, paid);
  }
  await setActive(lineUserId, userId, true);
  return [
    { type: "text", text: row.answers.length ? LINE_UPGRADE_RESUME : LINE_UPGRADE_INTRO },
    ...question(row.answers.length),
  ];
}

/** null means ordinary Alice chat; an empty list means an already-handled webhook delivery. */
export async function answerLineUpgradeChat(input: {
  lineUserId: string; userId: string; text: string; messageId?: string;
}): Promise<LineOutgoingMessage[] | null> {
  const { lineUserId, userId, text, messageId } = input;
  const { data: control, error: controlError } = await supabaseAdmin.from("events").select("metadata")
    .eq("id", sessionId(lineUserId, userId)).maybeSingle();
  if (controlError) throw new Error("LINE upgrade conversation lookup failed");
  if (control && messageId) {
    const { data: handled, error } = await supabaseAdmin.from("events").select("id")
      .eq("id", deterministicLineEventId(ANSWER_NAME, `${lineUserId}:${userId}:${messageId}`)).maybeSingle();
    if (error) return unavailable();
    if (handled) return [];
  }
  if (!control?.metadata?.active) return null;
  const expiresAt = Date.parse(control.metadata.expires_at ?? "");
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await cancelLineUpgradeChat(lineUserId, userId);
    return [{ type: "text", text: "少し時間が空いたから、質問はいったん閉じておくね。話してくれたことは保存してあるよ。「結果アップグレード」と送ってくれたら、続きから聞かせてね。" }];
  }
  if (text === LINE_UPGRADE_CANCEL || text === "中止") {
    await cancelLineUpgradeChat(lineUserId, userId);
    return [{ type: "text", text: LINE_UPGRADE_CANCELLED }];
  }
  if (!text.trim() || text.trim().length > LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH) return [{ type: "text", text: `ひとことでも大丈夫だから、1〜${LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH}文字で教えてね。` }];
  if (!(await hasFullAccess(userId))) {
    await cancelLineUpgradeChat(lineUserId, userId);
    return [{ type: "text", text: "完全版の購入が確認できなかったみたい。購入した診断結果と、このLINEが連携されているか確認してみてね。" }];
  }
  const row = await loadResultUpgradeForUser(userId);
  if (!row || !validDraft(row)) return unavailable();
  if (row.state !== "answers_ready" || row.answers.length === RESULT_UPGRADE_QUESTIONS.length) {
    return completion(lineUserId, userId, await hasPremiumBundleAccess(userId));
  }
  if (!messageId) return unavailable();
  const claimId = deterministicLineEventId(ANSWER_NAME, `${lineUserId}:${userId}:${messageId}`);
  const { error: claimError } = await supabaseAdmin.from("events").insert({
    id: claimId, event_name: ANSWER_NAME, owner_token: null, locale: "ja", metadata: {},
  });
  if (claimError?.code === "23505") return [];
  if (claimError) return unavailable();
  const answers = [...row.answers, text.trim()];
  const { data: saved, error } = await supabaseAdmin.from("result_upgrades")
    .update({ answers, updated_at: new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString() })
    .eq("user_id", userId).eq("updated_at", row.updated_at).eq("state", "answers_ready")
    .select("user_id").maybeSingle();
  if (error || !saved) {
    await supabaseAdmin.from("events").delete().eq("id", claimId);
    return unavailable();
  }
  if (answers.length === RESULT_UPGRADE_QUESTIONS.length) {
    return completion(lineUserId, userId, await hasPremiumBundleAccess(userId));
  }
  await setActive(lineUserId, userId, true);
  return question(answers.length);
}
