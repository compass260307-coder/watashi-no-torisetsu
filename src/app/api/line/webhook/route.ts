// Alice Plus (LINE) Phase 1: Messaging API webhook。
//
// 受けるイベント:
//   follow   - 友だち追加 → line_accounts upsert + 挨拶/連携案内
//   message  - 6桁の連携コードなら users と紐付け。連携済みユーザーのテキストは
//              Alice 会話 (LINE_ALICE_CHAT_ENABLED=true のとき・無料枠は全期間制限)。
//              未連携・フラグOFF時は案内応答
//   unfollow - ブロック → unfollowed_at 記録
//
// LINE Developers 側の設定: Webhook URL = <site>/api/line/webhook・Webhook ON・
// 応答メッセージ OFF。検証リクエスト (events: []) にも 200 を返す。

import { NextRequest, NextResponse } from "next/server";

import { consumeIdentifierRateLimit } from "@/lib/api-security";

import {
  matchAliceConversationStarter,
  quickReplies,
  replyLineMessages,
  startLineLoadingAnimation,
  verifyLineSignature,
  type LineFlexMessage,
  type LineWebhookBody,
  type LineWebhookEvent,
} from "@/lib/line";
import {
  consumeLineLinkCode,
  lineLinkSuccessMessage,
} from "@/lib/line-linking";
import {
  countAllLineUserMessages,
  countTodayLineUserMessages,
  generateLineAliceReply,
  lineAliceChatEnabled,
  lineFreeTotalLimit,
  type LineAliceUser,
} from "@/lib/line-alice";
import {
  buildLineLoveFootprintsPageUrl,
  buildLineMissionsPageUrl,
  buildLinePlusCheckoutUrl,
  buildLinePlusPageUrl,
  findActiveLinePlusPass,
  findManageableLinePlusSubscription,
  hasActiveLinePlus,
  hasLifetimeLinePlus,
  linePlusDailyLimit,
  linePlusEnabled,
} from "@/lib/line-plus";
import {
  deterministicLineEventId,
  getLineEventOnce,
  hasLineEventOnce,
  recordLineEvent,
  recordLineEventOnce,
} from "@/lib/line-events";
import {
  fortuneStreak,
  hasTalkedToAlice,
  LINE_FRIEND_MISSION_TIERS,
  LINE_SOCIAL_MISSION_NETWORKS,
} from "@/lib/line-missions";
import {
  FORTUNE_THEMES,
  generateThemeFortune,
  getOrCreateDailyLoveFortune,
  type FortuneTheme,
} from "@/lib/line-fortune";
import {
  createResultFromLineAishoSession,
  deleteLineAishoSession,
  formatLineAishoBirthDate,
  loadLineAishoSession,
  normalizeLineAishoBirthDate,
  parseLineAishoRelationship,
  startLineAishoSession,
  updateLineAishoSession,
  type LineAishoSession,
} from "@/lib/line-aisho-session";
import {
  LINE_TAROT_CARDS,
  dealLineTarotArrangement,
  formatLineTarotReading,
  jstTarotDateKey,
  type LineTarotCard,
} from "@/lib/line-tarot";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
// LINE の replyToken は受信から約1分有効。生成が長引いた場合も打ち切る
export const maxDuration = 60;

const WELCOME_MESSAGE = [
  "はじめまして、Aliceです。",
  "ここは、あなたの診断結果をもとに、毎日すこしずつ話せる場所になっていきます。",
  "",
  "診断が済んでいる人は、結果ページの「LINE連携」で出てくる6桁のコードを、このトークにそのまま送ってください。",
  "",
  "診断がまだの人は、こちらからどうぞ。",
  resolveSiteUrl(),
].join("\n");

const WELCOME_BACK_MESSAGE = [
  "おかえりなさい。Aliceです。",
  "あなたのトリセツは、ちゃんと覚えていますよ。また、ここでお話ししましょう。",
].join("\n");

const LINK_INVALID_MESSAGE = [
  "このコードは確認できませんでした。有効期限(10分)が切れているかもしれません。",
  "結果ページの「LINE連携」からもう一度コードを発行して、送り直してみてくださいね。",
].join("\n");

const LINK_ERROR_MESSAGE =
  "ごめんなさい、いま連携がうまくいきませんでした。少し時間をおいて、もう一度コードを送ってみてください。";

const PLACEHOLDER_LINKED_MESSAGE = [
  "メッセージありがとうございます。",
  "あなたとゆっくりお話しできるように、いま準備を進めています。始まったら、ここでお知らせしますね。",
].join("\n");

const PLACEHOLDER_UNLINKED_MESSAGE = [
  "メッセージありがとうございます。",
  "診断結果と連携すると、あなたに合わせてお話しできるようになります。",
  "結果ページの「LINE連携」から6桁のコードを発行して、このトークに送ってくださいね。",
  "",
  "診断がまだの人はこちらから。",
  resolveSiteUrl(),
].join("\n");

const FREE_LIMIT_MESSAGE = [
  `お試し分の${lineFreeTotalLimit()}通を使い切りました🌙`,
  "(もっとたっぷり話せるAlice Plusも、いま準備しています)",
].join("\n");

// Plus受付中の無料枠超過。案内リンクは本人のline_user_idで署名して毎回作る。
function freeLimitMessageWithPlus(lineUserId: string): string {
  return [
    `お試し分の${lineFreeTotalLimit()}通を使い切りました🌙`,
    "",
    "続きを話すなら、Alice Plusへ。",
    "",
    "▶ Alice Plusはこちら",
    buildLinePlusPageUrl(lineUserId),
  ].join("\n");
}

const PLUS_DAILY_LIMIT_MESSAGE = [
  "今日はたくさんお話しできて、うれしかったです。わたしも少しおやすみしますね。",
  "また明日、続きを聞かせてください。",
].join("\n");

const NON_TEXT_MESSAGE =
  "ごめんなさい、スタンプや画像はまだ読み取れなくて…。文字でお話ししてもらえるとうれしいです。";

const GENERATION_ERROR_MESSAGE =
  "ごめんなさい、いまうまく言葉にできませんでした。少し時間をおいて、もう一度話しかけてみてください。";

export async function POST(request: NextRequest) {
  if (!process.env.LINE_CHANNEL_SECRET) {
    console.error("[line/webhook] LINE_CHANNEL_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // 200 を返さないと LINE 側が同一イベントをリトライし続けるため、
  // イベント単位で握りつぶして常に 200 を返す。
  for (const event of body.events ?? []) {
    try {
      await handleEvent(event);
    } catch (error) {
      console.error("[line/webhook] event handling failed", {
        type: event.type,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineWebhookEvent): Promise<void> {
  switch (event.type) {
    case "follow":
      await handleFollow(event);
      return;
    case "unfollow":
      await handleUnfollow(event);
      return;
    case "message":
      await handleMessage(event);
      return;
    case "postback":
      await handlePostback(event);
      return;
    default:
      return;
  }
}

// Flexボタン (タロットのカード選択) の postback。data 形式: "tarot:pick:<0-2>"
async function handlePostback(event: LineWebhookEvent): Promise<void> {
  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!lineUserId || !replyToken) return;
  const match = /^tarot:pick:([0-2])$/.exec(event.postback?.data ?? "");
  if (!match) return;

  const { data: account } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!account?.user_id) {
    await replyLineMessages(replyToken, [
      { type: "text", text: PLACEHOLDER_UNLINKED_MESSAGE },
    ]);
    return;
  }
  await handleTarotPick(
    lineUserId,
    replyToken,
    account.user_id,
    Number(match[1]),
  );
}

async function handleFollow(event: LineWebhookEvent): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("line_accounts").upsert(
    { line_user_id: lineUserId, followed_at: nowIso, unfollowed_at: null },
    { onConflict: "line_user_id" },
  );
  if (error) {
    console.error("[line/webhook] follow upsert failed", {
      message: error.message,
    });
  }

  await recordLineEvent({
    eventName: "line_follow",
    metadata: { line_user_id: lineUserId, relink: Boolean(existing?.user_id) },
  });

  if (event.replyToken) {
    const linked = Boolean(existing?.user_id);
    await replyLineMessages(event.replyToken, [
      {
        type: "text",
        text: linked ? WELCOME_BACK_MESSAGE : WELCOME_MESSAGE,
        quickReply: linked
          ? quickReplies("今日の恋模様", "Aliceに恋愛相談")
          : quickReplies("使い方"),
      },
    ]);
  }
}

async function handleUnfollow(event: LineWebhookEvent): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const { error } = await supabaseAdmin.from("line_accounts").upsert(
    { line_user_id: lineUserId, unfollowed_at: new Date().toISOString() },
    { onConflict: "line_user_id" },
  );
  if (error) {
    console.error("[line/webhook] unfollow upsert failed", {
      message: error.message,
    });
  }
  await recordLineEvent({
    eventName: "line_unfollow",
    metadata: { line_user_id: lineUserId },
  });
}

async function handleMessage(event: LineWebhookEvent): Promise<void> {
  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!lineUserId || !replyToken) return;

  const isText = event.message?.type === "text";
  const rawText = isText ? (event.message?.text ?? "").trim() : "";

  if (isText) {
    const normalized = normalizeCodeCandidate(rawText);
    if (/^\d{6}$/.test(normalized)) {
      await handleLinkCode(lineUserId, replyToken, normalized);
      return;
    }
  }

  // リッチメニューのボタン (メッセージ送信型) とキーワードの受け皿。
  // 完全一致のみ拾い、通常の会話文をコマンド扱いしない
  const command = isText ? matchLineCommand(rawText) : null;

  // お問合せ・使い方・メニューは未連携 (診断前) の友だちにも答える
  if (command === "contact" || command === "help" || command === "menu") {
    await handleLineCommand(command, lineUserId, replyToken, null);
    return;
  }

  const { data: account } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (!account?.user_id) {
    await replyLineMessages(replyToken, [
      { type: "text", text: PLACEHOLDER_UNLINKED_MESSAGE },
    ]);
    return;
  }

  if (command) {
    // 別メニューへ移ったら、途中の出生情報を残さず相性占いを終了する。
    if (command !== "aisho") {
      await deleteLineAishoSession(lineUserId);
    }
    await handleLineCommand(command, lineUserId, replyToken, account.user_id);
    return;
  }
  if (
    isText &&
    rawText &&
    (await handleAishoSessionMessage(
      lineUserId,
      replyToken,
      account.user_id,
      rawText,
    ))
  ) {
    return;
  }
  if (isText) {
    const theme = matchFortuneTheme(rawText);
    if (theme) {
      await handleThemeFortune(
        theme,
        lineUserId,
        replyToken,
        account.user_id,
        rawText,
      );
      return;
    }
  }

  if (!lineAliceChatEnabled()) {
    await replyLineMessages(replyToken, [
      { type: "text", text: PLACEHOLDER_LINKED_MESSAGE },
    ]);
    return;
  }

  if (!isText || !rawText) {
    await replyLineMessages(replyToken, [
      { type: "text", text: NON_TEXT_MESSAGE },
    ]);
    return;
  }

  const conversationStarter = matchAliceConversationStarter(rawText);
  if (conversationStarter) {
    await recordLineEvent({
      eventName: "line_alice_starter_clicked",
      metadata: {
        starter: conversationStarter,
        user_id: account.user_id,
      },
    });
  }

  await handleAliceChat(lineUserId, replyToken, account.user_id, rawText);
}

async function handleAliceChat(
  lineUserId: string,
  replyToken: string,
  userId: string,
  text: string,
): Promise<void> {
  const totalUsed = await countAllLineUserMessages(lineUserId);
  if (totalUsed >= lineFreeTotalLimit()) {
    // Plus加入者は無料枠を素通し。安全弁 (既定100通/日) だけ残す
    const isPlus = await hasActiveLinePlus(userId);
    if (!isPlus) {
      if (linePlusEnabled()) {
        await replyLineMessages(replyToken, [
          {
            type: "text",
            text: freeLimitMessageWithPlus(lineUserId),
          },
        ]);
      } else {
        await replyLineMessages(replyToken, [
          { type: "text", text: FREE_LIMIT_MESSAGE },
        ]);
      }
      return;
    }
    const usedToday = await countTodayLineUserMessages(lineUserId);
    if (usedToday >= linePlusDailyLimit()) {
      await replyLineMessages(replyToken, [
        { type: "text", text: PLUS_DAILY_LIMIT_MESSAGE },
      ]);
      return;
    }
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, display_name, type_id, scores")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) {
    console.error("[line/webhook] linked user lookup failed", {
      message: error?.message ?? "not_found",
    });
    await replyLineMessages(replyToken, [
      { type: "text", text: GENERATION_ERROR_MESSAGE },
    ]);
    return;
  }

  // 生成待ちの「・・・」表示 (返信到着で自動的に消える)
  await startLineLoadingAnimation(lineUserId);
  try {
    const replyText = await generateLineAliceReply({
      lineUserId,
      user: {
        id: user.id,
        display_name: user.display_name ?? null,
        type_id: user.type_id ?? null,
        scores: (user.scores ?? null) as Record<string, number> | null,
      } satisfies LineAliceUser,
      text,
    });
    await replyLineMessages(replyToken, [{ type: "text", text: replyText }]);
  } catch (caught) {
    console.error("[line/webhook] alice reply failed", {
      message: caught instanceof Error ? caught.message : String(caught),
    });
    await replyLineMessages(replyToken, [
      { type: "text", text: GENERATION_ERROR_MESSAGE },
    ]);
  }
}

// ============ ふたりの相性占い (Alice Plus限定・全編チャット) ============
//
// 呼び名 → 関係 → 相手の生年月日 → 本人の生年月日 → 確認、と一問ずつ聞く。
// 複数のwebhookにまたがる途中入力だけline_aisho_sessionsへ30分保持し、鑑定後は即削除する。

const AISHO_RELATIONSHIP_REPLIES = [
  "片思い",
  "恋人",
  "夫婦・長い交際",
  "復縁",
  "その他",
] as const;

const AISHO_ERROR_MESSAGE =
  "ごめんね、いま相性を読み取れなかったみたい。少し時間をおいて、もう一度「相性占い」と送ってみてね。";

async function handleAishoCommand(
  lineUserId: string,
  replyToken: string,
  userId: string,
): Promise<void> {
  const isPlus = await hasActiveLinePlus(userId);
  if (!isPlus) {
    if (!linePlusEnabled()) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "ふたりの相性占いは、いま準備を進めています。始まったら、ここでお知らせするね。",
        },
      ]);
      return;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "ふたりの命式から恋の相性を読み解く「相性占い」は、Alice Plusで楽しめます♡",
          "",
          "▶ Alice Plusはこちら",
          buildLinePlusPageUrl(lineUserId),
        ].join("\n"),
      },
    ]);
    return;
  }

  const started = await startLineAishoSession({ lineUserId, userId });
  if (!started) {
    await replyLineMessages(replyToken, [
      { type: "text", text: AISHO_ERROR_MESSAGE },
    ]);
    return;
  }
  await recordLineEvent({
    eventName: "line_aisho_started",
    metadata: { line_user_id: lineUserId, user_id: userId },
  });
  await replyLineMessages(replyToken, [
    {
      type: "text",
      text: [
        "相性を見たい人がいるんだね。",
        "まず、その人のことをなんて呼べばいい？",
        "",
        "途中でやめたくなったら「やめる」と送ってね。",
      ].join("\n"),
    },
  ]);
}

async function updateAishoOrReplyError(
  session: LineAishoSession,
  step: LineAishoSession["step"],
  data: LineAishoSession["data"],
  replyToken: string,
): Promise<boolean> {
  const updated = await updateLineAishoSession(session, step, data);
  if (!updated) {
    await replyLineMessages(replyToken, [
      { type: "text", text: AISHO_ERROR_MESSAGE },
    ]);
  }
  return updated;
}

async function handleAishoSessionMessage(
  lineUserId: string,
  replyToken: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const session = await loadLineAishoSession(lineUserId);
  if (!session) return false;
  if (session.userId !== userId) {
    await deleteLineAishoSession(lineUserId);
    return false;
  }

  const normalized = text.trim().toLowerCase().replace(/\s+/g, "");
  if (["やめる", "中止", "キャンセル", "cancel"].includes(normalized)) {
    await deleteLineAishoSession(lineUserId);
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: "うん、ここでやめておくね。また気になったら、いつでも「相性占い」と送ってね🌙",
      },
    ]);
    return true;
  }

  if (session.step === "partner_name") {
    const partnerName = text.trim();
    if (!partnerName || partnerName.length > 20 || /[\r\n]/.test(partnerName)) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "その人の呼び名を、20文字以内でひとつだけ教えてね。",
        },
      ]);
      return true;
    }
    const data = { ...session.data, partnerName };
    if (!(await updateAishoOrReplyError(session, "relationship", data, replyToken))) {
      return true;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          `${partnerName}のことだね。`,
          "今のふたりにいちばん近いものを選んでね。",
        ].join("\n"),
        quickReply: quickReplies(...AISHO_RELATIONSHIP_REPLIES),
      },
    ]);
    return true;
  }

  if (session.step === "relationship") {
    const relationship = parseLineAishoRelationship(text);
    if (!relationship) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "今のふたりにいちばん近いものを選んでね。",
          quickReply: quickReplies(...AISHO_RELATIONSHIP_REPLIES),
        },
      ]);
      return true;
    }
    const data = { ...session.data, relationship };
    if (
      !(await updateAishoOrReplyError(
        session,
        "partner_birth_date",
        data,
        replyToken,
      ))
    ) {
      return true;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "ありがとう。",
          `次に、${data.partnerName ?? "その人"}の生年月日を教えて。`,
          "例：2000年1月1日",
        ].join("\n"),
      },
    ]);
    return true;
  }

  if (session.step === "partner_birth_date") {
    const partnerBirthDate = normalizeLineAishoBirthDate(text);
    if (!partnerBirthDate) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: [
            "生年月日をうまく読み取れなかったみたい。",
            "「2000年1月1日」のように送ってみてね。",
          ].join("\n"),
        },
      ]);
      return true;
    }
    const data = { ...session.data, partnerBirthDate };
    if (!(await updateAishoOrReplyError(session, "you_birth_date", data, replyToken))) {
      return true;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          `${data.partnerName ?? "その人"}は${formatLineAishoBirthDate(partnerBirthDate)}だね。`,
          "今度は、あなたの生年月日を教えて。",
          "例：1999年12月24日",
        ].join("\n"),
      },
    ]);
    return true;
  }

  if (session.step === "you_birth_date") {
    const youBirthDate = normalizeLineAishoBirthDate(text);
    if (!youBirthDate) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: [
            "生年月日をうまく読み取れなかったみたい。",
            "「1999年12月24日」のように送ってみてね。",
          ].join("\n"),
        },
      ]);
      return true;
    }
    const data = { ...session.data, youBirthDate };
    if (!(await updateAishoOrReplyError(session, "confirm", data, replyToken))) {
      return true;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "最後に確認させてね。",
          "",
          `あなた：${formatLineAishoBirthDate(youBirthDate)}`,
          `${data.partnerName ?? "お相手"}：${formatLineAishoBirthDate(data.partnerBirthDate!)}`,
          "",
          "これで合ってる？",
        ].join("\n"),
        quickReply: quickReplies("合ってる", "入力し直す"),
      },
    ]);
    return true;
  }

  if (["入力し直す", "やり直す", "違う"].includes(normalized)) {
    const data = {
      partnerName: session.data.partnerName,
      relationship: session.data.relationship,
    };
    if (
      !(await updateAishoOrReplyError(
        session,
        "partner_birth_date",
        data,
        replyToken,
      ))
    ) {
      return true;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: `わかった。まず、${data.partnerName ?? "お相手"}の生年月日をもう一度教えてね。`,
      },
    ]);
    return true;
  }
  if (!["合ってる", "はい", "ok", "これで占う"].includes(normalized)) {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: "生年月日が合っていたら「合ってる」、直したいときは「入力し直す」を選んでね。",
        quickReply: quickReplies("合ってる", "入力し直す"),
      },
    ]);
    return true;
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[line-aisho] user lookup failed", { message: error.message });
  }
  try {
    const result = createResultFromLineAishoSession({
      session,
      youName: user?.display_name?.trim() || "あなた",
    });
    // 鑑定結果を組み立てた時点で出生情報を削除。分析イベントにも保存しない。
    await deleteLineAishoSession(lineUserId);
    await recordLineEvent({
      eventName: "line_aisho_generated",
      metadata: {
        line_user_id: lineUserId,
        user_id: userId,
        relationship: session.data.relationship,
        score: result.score,
        surface: "chat",
      },
    });
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "ふたりの命式を見てみたよ…🌙",
          "",
          `♡ ふたりの相性は ${result.score}%`,
          `「${result.title}」`,
          "",
          result.lead,
          "",
          `${result.charts.you.name}：日主 ${result.charts.you.dayMaster}`,
          `${result.charts.partner.name}：日主 ${result.charts.partner.dayMaster}`,
        ].join("\n"),
      },
      {
        type: "text",
        text: ["♡ 惹かれ合う理由", "", result.sections.attraction].join("\n"),
      },
      {
        type: "text",
        text: [
          "△ すれ違いやすいところ",
          "",
          result.sections.friction,
        ].join("\n"),
      },
      {
        type: "text",
        text: [
          "✦ ふたりに合う伝え方",
          "",
          result.sections.communication,
        ].join("\n"),
      },
      {
        type: "text",
        text: [
          "→ 今のふたりの一歩",
          "",
          result.sections.nextStep,
          "",
          "この結果を見て気になったことがあったら、そのまま聞かせてね。",
          "※四柱推命をもとにしたエンタメ鑑定です。相手の気持ちや未来を断定するものではありません。",
        ].join("\n"),
        quickReply: quickReplies("Aliceに恋愛相談", "別の人を占う"),
      },
    ]);
  } catch (caught) {
    console.error("[line-aisho] generation failed", {
      message: caught instanceof Error ? caught.message : String(caught),
    });
    await replyLineMessages(replyToken, [
      { type: "text", text: AISHO_ERROR_MESSAGE },
    ]);
  }
  return true;
}

// リッチメニューのメッセージ型ボタンは、このキーワードをそのままトークに送る。
// 旧メニューのキーワードも互換のため残す
type LineCommand =
  | "plus"
  | "result"
  | "help"
  | "talk"
  | "fortune"
  | "invite"
  | "contact"
  | "mission"
  | "menu"
  | "tarot"
  | "aisho"
  | "footprints";

function matchLineCommand(text: string): LineCommand | null {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, "");
  if (["プラン", "plus", "aliceplus", "アリスプラス"].includes(normalized)) {
    return "plus";
  }
  if (
    [
      "自分のタイプ",
      "わたしのタイプ",
      "私のタイプ",
      "タイプ",
      "結果",
      "診断結果",
      "わたしの結果",
      "私の結果",
    ].includes(normalized)
  ) {
    return "result";
  }
  if (["使い方", "ヘルプ", "help"].includes(normalized)) {
    return "help";
  }
  if (
    [
      "aliceに恋愛相談",
      "アリスに恋愛相談",
      "恋愛相談",
      "恋の相談",
      "aliceと話す",
      "アリスと話す",
    ].includes(normalized)
  ) {
    return "talk";
  }
  if (
    [
      "今日の恋模様",
      "恋模様",
      "占いで遊ぶ",
      "今日の占い",
      "占い",
      "うらない",
    ].includes(normalized)
  ) {
    return "fortune";
  }
  if (["友達に招待", "招待", "友達診断"].includes(normalized)) {
    return "invite";
  }
  if (["お問合せ", "お問い合わせ", "問い合わせ"].includes(normalized)) {
    return "contact";
  }
  if (["ミッション", "mission"].includes(normalized)) {
    return "mission";
  }
  if (["メニュー", "めにゅー", "menu", "すべての機能"].includes(normalized)) {
    return "menu";
  }
  if (
    ["恋のタロット", "タロット占い", "タロット", "たろっと"].includes(
      normalized,
    )
  ) {
    return "tarot";
  }
  if (
    [
      "相性占い",
      "ふたりの相性占い",
      "相性",
      "あいしょう占い",
      "もう一度占う",
      "別の人を占う",
    ].includes(normalized)
  ) {
    return "aisho";
  }
  if (["恋の足あと", "恋の足跡", "恋愛の足あと", "恋愛の足跡"].includes(normalized)) {
    return "footprints";
  }
  return null;
}

// テーマ別深掘り占い (Plus特典) のキーワード。完全一致のみ
function matchFortuneTheme(text: string): FortuneTheme | null {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, "");
  if (["恋愛運", "恋愛"].includes(normalized)) return "love";
  if (["友達運", "友情運", "人間関係運"].includes(normalized)) return "friend";
  if (["勉強運", "学業運", "仕事運"].includes(normalized)) return "study";
  return null;
}

async function handleThemeFortune(
  theme: FortuneTheme,
  lineUserId: string,
  replyToken: string,
  userId: string,
  requestText: string,
): Promise<void> {
  const isPlus = await hasActiveLinePlus(userId);
  await recordLineEvent({
    eventName: "line_fortune_theme",
    metadata: { theme, plus: isPlus, line_user_id: lineUserId, user_id: userId },
  });

  // ミッション報酬: 友達回答1/3/5人の各節目で深掘り占いを1回ずつ無料開放。
  // recordLineEventOnce (決定的ID挿入) が請求ロックを兼ねるので二重配布はない。
  // 節目キーは /line/missions ページの表示ロジックと対で保つこと
  let giftClaimed = false;
  let giftKey: string | null = null;
  if (!isPlus) {
    const { count } = await supabaseAdmin
      .from("friend_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const answers = count ?? 0;
    for (const tier of LINE_FRIEND_MISSION_TIERS) {
      if (answers < tier.min) break;
      const key = `${userId}${tier.keySuffix}`;
      giftClaimed = await recordLineEventOnce({
        eventName: "line_mission_reward",
        key,
        metadata: {
          user_id: userId,
          line_user_id: lineUserId,
          theme,
          tier: tier.min,
        },
      });
      if (giftClaimed) {
        giftKey = key;
        break;
      }
    }
    // SNS共有ミッション (回答数と独立した節目)。共有済みのSNSごとに1回ずつ配布。
    for (const network of LINE_SOCIAL_MISSION_NETWORKS) {
      if (giftClaimed) break;
      const shared = await hasLineEventOnce(
        "line_mission_sns_shared",
        `${userId}:${network}`,
      );
      if (!shared) continue;
      giftClaimed = await recordLineEventOnce({
        eventName: "line_mission_reward",
        key: `${userId}:${network}`,
        metadata: {
          user_id: userId,
          line_user_id: lineUserId,
          theme,
          tier: network,
        },
      });
      if (giftClaimed) {
        giftKey = `${userId}:${network}`;
      }
    }
    // リテンションミッション (Aliceと話す/占い3日連続)。
    // 達成判定は line-missions.ts・キーはページの表示ロジックと対で保つこと
    if (!giftClaimed && (await hasTalkedToAlice(lineUserId))) {
      giftClaimed = await recordLineEventOnce({
        eventName: "line_mission_reward",
        key: `${userId}:talk`,
        metadata: {
          user_id: userId,
          line_user_id: lineUserId,
          theme,
          tier: "talk",
        },
      });
      if (giftClaimed) {
        giftKey = `${userId}:talk`;
      }
    }
    if (!giftClaimed && (await fortuneStreak(lineUserId)).best >= 3) {
      giftClaimed = await recordLineEventOnce({
        eventName: "line_mission_reward",
        key: `${userId}:streak3`,
        metadata: {
          user_id: userId,
          line_user_id: lineUserId,
          theme,
          tier: "streak3",
        },
      });
      if (giftClaimed) {
        giftKey = `${userId}:streak3`;
      }
    }
  }

  if (!isPlus && !giftClaimed) {
    if (!linePlusEnabled()) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "テーマ別の深掘り占いは、いま準備を進めています。始まったら、ここでお知らせしますね。",
        },
      ]);
      return;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          `「${FORTUNE_THEMES[theme].label}」の深掘り占いは、Alice Plusで楽しめます🔮`,
          "",
          "▶ Alice Plusはこちら",
          buildLinePlusPageUrl(lineUserId),
        ].join("\n"),
      },
    ]);
    return;
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, display_name, type_id, scores")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) {
    await replyLineMessages(replyToken, [
      { type: "text", text: GENERATION_ERROR_MESSAGE },
    ]);
    return;
  }
  // 生成待ちの「・・・」表示 (返信到着で自動的に消える)
  await startLineLoadingAnimation(lineUserId);
  try {
    const fortune = await generateThemeFortune({
      lineUserId,
      user: {
        id: user.id,
        display_name: user.display_name ?? null,
        type_id: user.type_id ?? null,
        scores: (user.scores ?? null) as Record<string, number> | null,
      },
      theme,
      requestText,
    });
    // 他の2テーマをチップで提案 (回遊)
    const otherThemes = (
      Object.keys(FORTUNE_THEMES) as FortuneTheme[]
    ).filter((key) => key !== theme);
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: giftClaimed
          ? `🎁 ミッション達成のプレゼント占いです!\n\n${fortune}`
          : fortune,
        quickReply: quickReplies(
          ...otherThemes.map((key) => FORTUNE_THEMES[key].label),
        ),
      },
    ]);
  } catch (caught) {
    console.error("[line/webhook] theme fortune failed", {
      message: caught instanceof Error ? caught.message : String(caught),
    });
    // プレゼントを消費したのに占いが出せなかったら、ロックを返して再挑戦できるようにする
    if (giftClaimed && giftKey) {
      await supabaseAdmin
        .from("events")
        .delete()
        .eq("id", deterministicLineEventId("line_mission_reward", giftKey));
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: "ごめんなさい、星がうまく読めませんでした…。少し時間をおいて、もう一度試してみてください。",
      },
    ]);
  }
}

async function handleLineCommand(
  command: LineCommand,
  lineUserId: string,
  replyToken: string,
  // contact / help / talk は未連携 (null) でも応答する
  userId: string | null,
): Promise<void> {
  await recordLineEvent({
    eventName: "line_menu_command",
    metadata: { command, line_user_id: lineUserId, user_id: userId },
  });

  if (command === "talk") {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "どうしたの？",
          "どんな恋のことで、心が揺れてるの？",
          "うまくまとまってなくても大丈夫。ゆっくり聞かせて🌙",
        ].join("\n"),
      },
    ]);
    return;
  }

  if (command === "menu") {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: `メニューはこちらから開けます。\n${menuLiffUrl("menu") ?? `${resolveSiteUrl()}/line/menu`}`,
      },
    ]);
    return;
  }

  if (command === "contact") {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "お問い合わせは、こちらのメールで受け付けています。",
          "support@watashi-torisetsu.com",
          "",
          "不具合の報告も、サービスへの要望も、どんなことでも大丈夫です。ぜんぶ運営が読んでいます。",
        ].join("\n"),
      },
    ]);
    return;
  }

  if (command === "help") {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "使い方はかんたん。友達と同じように、そのまま話しかけてください。",
          "今日あったことでも、もやもやでも、なんでもどうぞ🌙",
          "",
          "下のメニューからは:",
          "💗 今日の恋模様 — 1日1回の恋の流れ",
          "💕 相性占い — 生年月日からふたりの相性を見る",
          "📖 自分のタイプ — 診断結果を見返す",
          "🎯 ミッション — 友達を招待してプレゼント",
          "",
          "もっと遊びたい人は、Alice Plusも試してみてくださいね。",
        ].join("\n"),
      },
    ]);
    return;
  }

  // ここから下は連携済み前提 (呼び出し側で保証)。型ガードとして早期return
  if (!userId) return;

  if (command === "aisho") {
    await handleAishoCommand(lineUserId, replyToken, userId);
    return;
  }

  if (command === "footprints") {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "うれしかった日も、迷った夜も。恋の足あとに、そっと残しておけるよ。",
          buildLineLoveFootprintsPageUrl(lineUserId),
        ].join("\n"),
      },
    ]);
    return;
  }

  if (command === "fortune") {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, display_name, type_id, scores")
      .eq("id", userId)
      .maybeSingle();
    if (error || !user) {
      await replyLineMessages(replyToken, [
        { type: "text", text: GENERATION_ERROR_MESSAGE },
      ]);
      return;
    }
    // 初回生成は数秒かかるので「・・・」表示 (キャッシュ時は一瞬で消える)
    await startLineLoadingAnimation(lineUserId);
    try {
      const fortune = await getOrCreateDailyLoveFortune({
        lineUserId,
        user: {
          id: user.id,
          display_name: user.display_name ?? null,
          type_id: user.type_id ?? null,
          scores: (user.scores ?? null) as Record<string, number> | null,
        },
      });
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: [
            "💗 今日の恋模様",
            "",
            fortune,
            "",
            "心に浮かんだ人や言葉があったら、そのまま聞かせてね。",
          ].join("\n"),
          quickReply: quickReplies("Aliceに恋愛相談", "恋のタロット"),
        },
      ]);
    } catch (caught) {
      console.error("[line/webhook] fortune failed", {
        message: caught instanceof Error ? caught.message : String(caught),
      });
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "ごめんなさい、今日は恋の空模様がうまく見えなかったみたい…。少し時間をおいて、もう一度会いにきてね。",
        },
      ]);
    }
    return;
  }

  if (command === "tarot") {
    await handleTarotCommand(lineUserId, replyToken, userId);
    return;
  }

  if (command === "mission") {
    // 詳細はミッションページ (進捗バー+共有ボタン) に集約。メニューは直接URIで開くので
    // ここに来るのはキーワード・メニューFlex経由のみ
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "🎯 ミッションの進み具合は、このページで見られますよ。",
          "友達の回答を集めると、節目ごとに深掘り占いをプレゼントしています🎁",
          buildLineMissionsPageUrl(lineUserId),
        ].join("\n"),
      },
    ]);
    return;
  }

  if (command === "invite") {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("invite_code")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.invite_code) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "ごめんなさい、招待リンクをうまく用意できませんでした。少し時間をおいて試してみてください。",
        },
      ]);
      return;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "友達診断は、友達に何問か答えてもらうと「まわりから見えているあなた」がわかるやつです。",
          "この招待リンクを、そのまま友達に送ってみてください。",
          "",
          `${resolveSiteUrl()}/friend/${user.invite_code}`,
          "",
          "回答が集まったら、わたしと一緒に見てみましょうね。",
        ].join("\n"),
      },
    ]);
    return;
  }

  if (command === "plus") {
    const [subscription, activePass, hasLifetime] = await Promise.all([
      findManageableLinePlusSubscription(lineUserId),
      findActiveLinePlusPass(lineUserId),
      hasLifetimeLinePlus(lineUserId),
    ]);
    if (subscription) {
      // サブスクの管理は1タップでも早く着くよう直でBilling Portalへ。
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: [
            "Alice Plusをご利用中です。いつもありがとうございます。",
            "プランの確認・お支払い方法の変更・解約はこちらからどうぞ。",
            buildLinePlusCheckoutUrl(lineUserId),
          ].join("\n"),
        },
      ]);
      return;
    }
    if (activePass || hasLifetime) {
      // 期間パスと旧無期限プランには管理対象のサブスクがないため、
      // Checkoutへ直送せず利用状況を表示できるLPへ戻す。
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: [
            "Alice Plusをご利用中です。いつもありがとうございます。",
            activePass
              ? "期間パスの利用状況確認や、利用期間の追加はこちらからどうぞ。月額・年額はパス終了後にお申し込みいただけます。"
              : "販売終了済みの無期限プランが有効です。追加のお支払いはありません。",
            buildLinePlusPageUrl(lineUserId),
          ].join("\n"),
        },
      ]);
      return;
    }
    if (!linePlusEnabled()) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "Alice Plusは、いま準備を進めています。始まったら、ここでまっさきにお知らせしますね。",
        },
      ]);
      return;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "Alice Plusでもっと楽しめること✨",
          "",
          "Aliceとたっぷり話せる💬",
          "四柱推命で見る、ふたりの相性占い💕",
          "3枚から選ぶ恋のタロット🃏",
          "",
          "▶ Alice Plusはこちら",
          buildLinePlusPageUrl(lineUserId),
        ].join("\n"),
      },
    ]);
    return;
  }

  // result: 自己診断と友達診断をまとめて返す
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("owner_token")
    .eq("id", userId)
    .maybeSingle();
  if (!user?.owner_token) {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: "ごめんなさい、結果ページをうまく見つけられませんでした。少し時間をおいて試してみてください。",
      },
    ]);
    return;
  }
  const site = resolveSiteUrl();
  await replyLineMessages(replyToken, [
    {
      type: "text",
      text: [
        "あなたの結果は、ここからいつでも読み返せます。",
        "",
        "📖 自己診断 (あなたのトリセツ)",
        `${site}/me/${user.owner_token}`,
        "",
        "👀 友達診断 (まわりから見えているあなた)",
        `${site}/tako/${user.owner_token}`,
        "",
        "友達の回答をもっと集めたいときは、メニューの「友達に招待」からどうぞ。",
      ].join("\n"),
    },
  ]);
}

// ============ 恋のタロット (Alice Plus限定・インタラクティブ1枚引き) ============
//
// 「恋のタロット」→ 裏向き3枚のFlexピッカー → postback で選んだ位置のカードを公開。
// 並びは userId+JST日付で決定的 (dealLineTarotArrangement)・最初に選んだ1枚を
// recordLineEventOnce でロック = その日はどう選び直しても同じカード (儀式性を守る)。
// スクリプト読みなのでAIコストゼロ・無料枠非消費。

const TAROT_DRAW_EVENT = "line_tarot_draw";

function tarotLockKey(userId: string): string {
  return `${userId}:${jstTarotDateKey()}`;
}

function isTarotCard(value: unknown): value is LineTarotCard {
  return typeof value === "string" && value in LINE_TAROT_CARDS;
}

function buildTarotPickerMessage(): LineFlexMessage {
  const backUrl = `${resolveSiteUrl()}/tarot/line/back.jpg`;
  return {
    type: "flex",
    altText: "恋のタロット | 心惹かれる1枚を選んでください",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        backgroundColor: "#241A4F",
        contents: [
          {
            type: "text",
            text: "🃏 恋のタロット",
            weight: "bold",
            size: "md",
            color: "#FFD97A",
            align: "center",
          },
          {
            type: "text",
            text: "いま気になっている恋を心に浮かべて、惹かれるカードを1枚選んでね",
            wrap: true,
            size: "xs",
            color: "#FFFFFFCC",
            align: "center",
            margin: "md",
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "md",
            margin: "lg",
            contents: [0, 1, 2].map((pos) => ({
              type: "image",
              url: backUrl,
              aspectRatio: "2:3",
              aspectMode: "cover",
              size: "full",
              flex: 1,
              action: {
                type: "postback",
                data: `tarot:pick:${pos}`,
                displayText: "この1枚にする",
              },
            })),
          },
        ],
      },
    },
  };
}

async function replyTarotUpsell(
  lineUserId: string,
  replyToken: string,
): Promise<void> {
  if (!linePlusEnabled()) {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: "恋のタロットは、いま準備を進めています。始まったら、ここでお知らせしますね。",
      },
    ]);
    return;
  }
  await replyLineMessages(replyToken, [
    {
      type: "text",
      text: [
        "心惹かれる1枚を選ぶ「恋のタロット」は、Alice Plusで楽しめます🃏",
        "",
        "▶ Alice Plusはこちら",
        buildLinePlusPageUrl(lineUserId),
      ].join("\n"),
    },
  ]);
}

async function handleTarotCommand(
  lineUserId: string,
  replyToken: string,
  userId: string,
): Promise<void> {
  const isPlus = await hasActiveLinePlus(userId);
  if (!isPlus) {
    await replyTarotUpsell(lineUserId, replyToken);
    return;
  }
  const drawn = await getLineEventOnce(TAROT_DRAW_EVENT, tarotLockKey(userId));
  if (isTarotCard(drawn?.card)) {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "今日の恋のカードは、もう引いていますよ🃏",
          "",
          formatLineTarotReading(drawn.card),
        ].join("\n"),
        quickReply: quickReplies("Aliceに恋愛相談", "今日の恋模様"),
      },
    ]);
    return;
  }
  await replyLineMessages(replyToken, [buildTarotPickerMessage()]);
}

async function handleTarotPick(
  lineUserId: string,
  replyToken: string,
  userId: string,
  pos: number,
): Promise<void> {
  const isPlus = await hasActiveLinePlus(userId);
  if (!isPlus) {
    // 解約後に古いピッカーを触ったケースなど
    await replyTarotUpsell(lineUserId, replyToken);
    return;
  }
  const arrangement = dealLineTarotArrangement(userId);
  let card = arrangement[pos] ?? arrangement[0];
  const claimed = await recordLineEventOnce({
    eventName: TAROT_DRAW_EVENT,
    key: tarotLockKey(userId),
    metadata: {
      user_id: userId,
      line_user_id: lineUserId,
      card,
      pos,
      date: jstTarotDateKey(),
    },
  });
  if (!claimed) {
    // 今日はもう引いている: ロック済みのカードを読み直して同じ結果を返す
    const drawn = await getLineEventOnce(TAROT_DRAW_EVENT, tarotLockKey(userId));
    if (isTarotCard(drawn?.card)) card = drawn.card;
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "今日の恋のカードは、最初に選んだこの1枚ですよ🃏",
          "",
          formatLineTarotReading(card),
        ].join("\n"),
        quickReply: quickReplies("Aliceに恋愛相談", "今日の恋模様"),
      },
    ]);
    return;
  }
  const imageUrl = `${resolveSiteUrl()}${LINE_TAROT_CARDS[card].image}`;
  await replyLineMessages(replyToken, [
    {
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    },
    {
      type: "text",
      text: formatLineTarotReading(card),
      quickReply: quickReplies("Aliceに恋愛相談", "今日の恋模様"),
    },
  ]);
}

// トークで「メニュー」と送られた場合の、メニューページへの案内リンク。

function menuLiffUrl(dest: string): string | null {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}?dest=${dest}` : null;
}

// 全角数字・空白・ハイフン混じりでもコードとして受け付ける
function normalizeCodeCandidate(text: string): string {
  return text
    .replace(/[０-９]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
    )
    .replace(/[\s-]/g, "");
}

async function handleLinkCode(
  lineUserId: string,
  replyToken: string,
  code: string,
): Promise<void> {
  const rateLimit = await consumeIdentifierRateLimit(lineUserId, {
    scope: "line-manual-link-attempt",
    limit: 8,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: "連携コードの確認回数が多いため、しばらく時間をおいてからお試しください。",
      },
    ]);
    return;
  }

  // 手入力コードの送信自体を切替への明示的同意として扱う。
  // DB関数内で競合判定・履歴保存・upsert・コード消費を原子的に行う。
  const result = await consumeLineLinkCode({
    code,
    kind: "manual",
    lineUserId,
    force: true,
    source: "manual",
  });

  if (result.status === "error") {
    await replyLineMessages(replyToken, [
      { type: "text", text: LINK_ERROR_MESSAGE },
    ]);
    return;
  }
  if (
    result.status === "not_found" ||
    result.status === "expired" ||
    result.status === "used"
  ) {
    await replyLineMessages(replyToken, [
      { type: "text", text: LINK_INVALID_MESSAGE },
    ]);
    return;
  }
  if (!result.user) {
    await replyLineMessages(replyToken, [
      { type: "text", text: LINK_ERROR_MESSAGE },
    ]);
    return;
  }

  if (result.status === "linked") {
    await recordLineEvent({
      eventName: "line_link_completed",
      metadata: {
        kind: "manual",
        switched: result.switched,
      },
      ownerToken: result.user.ownerToken,
    });
  }

  const chatEnabled = lineAliceChatEnabled();
  await replyLineMessages(replyToken, [
    {
      type: "text",
      text: lineLinkSuccessMessage({
        displayName: result.user.displayName,
        switched: result.switched,
        chatEnabled,
      }),
      ...(chatEnabled
        ? { quickReply: quickReplies("今日の恋模様", "Aliceに恋愛相談") }
        : {}),
    },
  ]);
}
