// Alice Plus (LINE) Phase 1: Messaging API webhook。
//
// 受けるイベント:
//   follow   - 友だち追加 → line_accounts upsert + 挨拶/連携案内
//   message  - 6桁の連携コードなら users と紐付け。連携済みユーザーのテキストは
//              Alice 会話 (LINE_ALICE_CHAT_ENABLED=true のとき・無料枠は日次制限)。
//              未連携・フラグOFF時は案内応答
//   unfollow - ブロック → unfollowed_at 記録
//
// LINE Developers 側の設定: Webhook URL = <site>/api/line/webhook・Webhook ON・
// 応答メッセージ OFF。検証リクエスト (events: []) にも 200 を返す。

import { NextRequest, NextResponse } from "next/server";

import { consumeIdentifierRateLimit } from "@/lib/api-security";

import {
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
  countTodayLineUserMessages,
  generateLineAliceReply,
  lineAliceChatEnabled,
  lineFreeDailyLimit,
  type LineAliceUser,
} from "@/lib/line-alice";
import {
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
import { LINE_PLUS_PLANS } from "@/lib/line-plus-products";
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
  getOrCreateDailyFortune,
  type FortuneTheme,
} from "@/lib/line-fortune";
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

const DAILY_LIMIT_MESSAGE = [
  "今日お話しできる分は、ここまでみたいです。また明日、話の続きを聞かせてくださいね。",
  "(もっとたっぷり話せるAlice Plusも、いま準備しています)",
].join("\n");

// Plus受付中の無料枠超過。案内リンクは本人のline_user_idで署名して毎回作る。
// 構成はオーナー指定の参考例に合わせる: 共感→安心→有料/無料の2択→どちらでも味方
function dailyLimitMessageWithPlus(
  lineUserId: string,
  name: string | null,
): string {
  return [
    `ごめんなさい${name ? `、${name}さん` : ""}。今日の無料でお話しできる分(${lineFreeDailyLimit()}通)を使い切っちゃいました😢`,
    "でも安心してくださいね。明日になれば、また続きをお話しできますよ。",
    "",
    "💎 いますぐ続きを話したい人はこちら",
    `▶ Alice Plus(月${LINE_PLUS_PLANS.monthly.priceYen.toLocaleString("ja-JP")}円・初回登録のみ1週間無料)`,
    "　無料枠を超えてたっぷりおしゃべり+深掘り占い(恋愛・友達・勉強)+タロット占い",
    buildLinePlusPageUrl(lineUserId),
    "",
    "🔮 無料のまま楽しみたい人はこちら",
    "▶「今日の占い」と送ってみてください",
    "　毎日1回の占いは、ずっと無料です",
    "",
    "どちらを選んでも、わたしが最後までちゃんと聞きますからね🌙",
  ].join("\n");
}

const PLUS_DAILY_LIMIT_MESSAGE = [
  "今日はたくさんお話しできて、うれしかったです。わたしも少しおやすみしますね。",
  "また明日、続きを聞かせてください。",
].join("\n");

const LINE_PLUS_MONTHLY_PRICE_LABEL =
  LINE_PLUS_PLANS.monthly.priceYen.toLocaleString("ja-JP");

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
          ? quickReplies("今日の占い", "診断結果")
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
    await handleLineCommand(command, lineUserId, replyToken, account.user_id);
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

  await handleAliceChat(lineUserId, replyToken, account.user_id, rawText);
}

async function handleAliceChat(
  lineUserId: string,
  replyToken: string,
  userId: string,
  text: string,
): Promise<void> {
  const used = await countTodayLineUserMessages(lineUserId);
  if (used >= lineFreeDailyLimit()) {
    // Plus加入者は無料枠を素通し。安全弁 (既定100通/日) だけ残す
    const isPlus = await hasActiveLinePlus(userId);
    if (!isPlus) {
      if (linePlusEnabled()) {
        // 名前呼びのための1クエリ。上限に当たったときしか走らない
        const { data: limited } = await supabaseAdmin
          .from("users")
          .select("display_name")
          .eq("id", userId)
          .maybeSingle();
        const name = (limited?.display_name ?? "").trim() || null;
        await replyLineMessages(replyToken, [
          {
            type: "text",
            text: dailyLimitMessageWithPlus(lineUserId, name),
            quickReply: quickReplies("今日の占い"),
          },
        ]);
      } else {
        await replyLineMessages(replyToken, [
          { type: "text", text: DAILY_LIMIT_MESSAGE },
        ]);
      }
      return;
    }
    if (used >= linePlusDailyLimit()) {
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

// リッチメニューv3のボタンはこのキーワードをそのままトークに送る
// (上段:「自分のタイプ」「占いで遊ぶ」「使い方」/ 下段:「Alice Plus」「ミッション」「メニュー」「お問い合わせ」)
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
  | "tarot";

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
  if (["aliceと話す", "アリスと話す"].includes(normalized)) {
    return "talk";
  }
  if (["占いで遊ぶ", "今日の占い", "占い", "うらない"].includes(normalized)) {
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
  if (["タロット占い", "タロット", "たろっと"].includes(normalized)) {
    return "tarot";
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
    const { data: viewer } = await supabaseAdmin
      .from("users")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const name = (viewer?.display_name ?? "").trim();
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          `${name ? `${name}さん、` : ""}${FORTUNE_THEMES[theme].label}が気になるんですね…!テーマ別の深掘り占いは、Alice Plusの特典なんです。`,
          "",
          "💎 深掘り占いを試したい人はこちら",
          `▶ Alice Plus(月${LINE_PLUS_MONTHLY_PRICE_LABEL}円・初回登録のみ1週間無料)`,
          "　診断結果や最近の会話をふまえて、恋愛運・友達運・勉強運を占います+タロット+無料枠を超えてたっぷりおしゃべり",
          buildLinePlusPageUrl(lineUserId),
          "",
          "🔮 無料のまま楽しみたい人はこちら",
          "▶「今日の占い」は、これからも毎日無料で届けますね",
          "",
          "急がなくて大丈夫。気になったときが、いいタイミングですよ🌙",
        ].join("\n"),
        quickReply: quickReplies("今日の占い"),
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

// JSTの時間帯 (0-23時)
function jstHour(now: Date = new Date()): number {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
}

function talkStarterMessage(): string {
  const hour = jstHour();
  if (hour >= 5 && hour < 11) {
    return [
      "おはようございます!きてくれてうれしいな。",
      "今日はどんな1日になりそうですか?予定のことでも、いまの気分でも、聞かせてください。",
    ].join("\n");
  }
  if (hour >= 11 && hour < 17) {
    return [
      "こんにちは。ひと息つく時間ですか?",
      "今日ここまでで、ちょっと気になったことや、誰かに言いたかったこと、ありませんか。",
    ].join("\n");
  }
  if (hour >= 17 && hour < 23) {
    return [
      "おかえりなさい。今日はどんな1日でしたか?",
      "楽しかったことでも、もやもやでも、どちらでも。ゆっくり聞きますよ。",
    ].join("\n");
  }
  return [
    "こんな時間まで、おつかれさまです。",
    "眠れない夜は、頭の中にあることをそのまま吐き出しちゃうのもいいですよ。なんでもどうぞ。",
  ].join("\n");
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
      { type: "text", text: talkStarterMessage() },
    ]);
    return;
  }

  if (command === "menu") {
    await replyLineMessages(replyToken, [buildMenuFlexMessage()]);
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
          "🔮 占いで遊ぶ — 今日の占い・タロット",
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
      const fortune = await getOrCreateDailyFortune({
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
            "🔮 今日の占い",
            "",
            fortune,
            "",
            "気になるテーマは、下のボタンから深く見られますよ。タロットも引けます🃏",
          ].join("\n"),
          quickReply: quickReplies("恋愛運", "友達運", "勉強運", "タロット占い"),
        },
      ]);
    } catch (caught) {
      console.error("[line/webhook] fortune failed", {
        message: caught instanceof Error ? caught.message : String(caught),
      });
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "ごめんなさい、星がうまく読めませんでした…。少し時間をおいて、もう一度試してみてください。",
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
          "Alice Plusのご案内ですね。",
          "",
          `💎 Plus(月${LINE_PLUS_MONTHLY_PRICE_LABEL}円・初回登録のみ1週間無料)でできること`,
          "・無料の1日分を超えて、たっぷりおしゃべり",
          "・恋愛運・友達運・勉強運の深掘り占い(あなたとの会話を覚えて占います)",
          "・タロット占い(3枚から直感で今日の1枚を引く)",
          "",
          "▶ 月額Plusを見る(いつでも解約できます)",
          buildLinePlusPageUrl(lineUserId),
          "",
          "🔮 無料のままでも",
          `・1日${lineFreeDailyLimit()}通のおしゃべりと、毎日の「今日の占い」はずっと無料です`,
          "",
          "どちらでも、わたしはあなたの味方ですからね🌙",
        ].join("\n"),
        quickReply: quickReplies("今日の占い"),
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

// ============ タロット占い (Alice Plus限定・インタラクティブ1枚引き) ============
//
// 「タロット占い」→ 裏向き3枚のFlexピッカー → postback で選んだ位置のカードを公開。
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
    altText: "タロット占い | 気になる1枚を選んでください",
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
            text: "🃏 今日の1枚",
            weight: "bold",
            size: "md",
            color: "#FFD97A",
            align: "center",
          },
          {
            type: "text",
            text: "聞きたいことを心に浮かべて、気になるカードを1枚選んでください",
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
        text: "タロット占いは、いま準備を進めています。始まったら、ここでお知らせしますね。",
      },
    ]);
    return;
  }
  await replyLineMessages(replyToken, [
    {
      type: "text",
      text: [
        "🃏 タロット占いは、Alice Plusの特典なんです。裏向きの3枚から、あなたの直感で今日の1枚を選ぶ占いですよ。",
        "",
        "💎 引いてみたい人はこちら",
        `▶ Alice Plus(月${LINE_PLUS_MONTHLY_PRICE_LABEL}円・初回登録のみ1週間無料)`,
        "　タロット占い+恋愛運・友達運・勉強運の深掘り占い+無料枠を超えてたっぷりおしゃべり",
        buildLinePlusPageUrl(lineUserId),
        "",
        "🔮 無料のまま楽しみたい人はこちら",
        "▶「今日の占い」は、これからも毎日無料で届けますね",
        "",
        "急がなくて大丈夫。気になったときが、いいタイミングですよ🌙",
      ].join("\n"),
      quickReply: quickReplies("今日の占い"),
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
          "今日の1枚は、もう引いていますよ🃏",
          "",
          formatLineTarotReading(drawn.card),
        ].join("\n"),
        quickReply: quickReplies("恋愛運", "友達運", "勉強運"),
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
          "今日の1枚は、最初に選んだこのカードですよ🃏",
          "",
          formatLineTarotReading(card),
        ].join("\n"),
        quickReply: quickReplies("恋愛運", "友達運", "勉強運"),
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
      quickReply: quickReplies("恋愛運", "友達運", "勉強運"),
    },
  ]);
}

// 「メニュー」= 全機能一覧のFlex。物理ボタンを増やさず、新機能はまずここに足す
// (よく押されるようになったらリッチメニュー本体へ昇格させる運用・2026-09-02 オーナー方針)。
// 2列グリッドで縦を詰め、ページ系(タイプ/ミッション/プラン)はLIFF直リンク混載。

function menuLiffUrl(dest: string): string | null {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}?dest=${dest}` : null;
}

// Flex標準ボタンはラベルを太字にできないため、タップ可能な角丸ボックス+
// 太字テキストでセルを自作する (色・太さ・角丸を自由に制御できる)
function menuCell(
  label: string,
  action: Record<string, unknown>,
  options: { primary?: boolean } = {},
): Record<string, unknown> {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: options.primary ? "#5B5BEF" : "#EDEAFB",
    cornerRadius: "10px",
    paddingTop: "12px",
    paddingBottom: "12px",
    flex: 1,
    action,
    contents: [
      {
        type: "text",
        text: label,
        weight: "bold",
        size: "sm",
        color: options.primary ? "#FFFFFF" : "#2E2E5C",
        align: "center",
      },
    ],
  };
}

function menuMsgButton(
  label: string,
  keyword: string,
): Record<string, unknown> {
  return menuCell(label, { type: "message", label, text: keyword });
}

// ページ系はその場でサイトを開く (LIFF未設定時はキーワード送信にフォールバック)
function menuPageButton(
  label: string,
  dest: string,
  fallbackKeyword: string,
): Record<string, unknown> {
  const uri = menuLiffUrl(dest);
  if (!uri) return menuMsgButton(label, fallbackKeyword);
  return menuCell(label, { type: "uri", label, uri });
}

function menuRow(
  ...buttons: Array<Record<string, unknown>>
): Record<string, unknown> {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    margin: "sm",
    contents: buttons,
  };
}

function buildMenuFlexMessage(): LineFlexMessage {
  return {
    type: "flex",
    altText: "メニュー | できること一覧",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#241A4F",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "✦ MENU ✦",
            size: "xxs",
            weight: "bold",
            color: "#FFD97A",
            align: "center",
          },
          {
            type: "text",
            text: "メニュー",
            size: "lg",
            weight: "bold",
            color: "#FFFFFF",
            align: "center",
            margin: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          menuRow(
            menuCell(
              "Aliceと話す",
              { type: "message", label: "Aliceと話す", text: "Aliceと話す" },
              { primary: true },
            ),
          ),
          menuRow(
            menuMsgButton("今日の占い", "今日の占い"),
            menuMsgButton("タロット", "タロット占い"),
          ),
          menuRow(
            menuMsgButton("恋愛運", "恋愛運"),
            menuMsgButton("友達運", "友達運"),
          ),
          menuRow(
            menuMsgButton("勉強運", "勉強運"),
            menuPageButton("診断結果", "me", "診断結果"),
          ),
          menuRow(
            menuPageButton("ミッション", "missions", "ミッション"),
            menuPageButton("プラン", "plus", "プラン"),
          ),
          menuRow(
            menuMsgButton("使い方", "使い方"),
            menuMsgButton("お問い合わせ", "お問い合わせ"),
          ),
        ],
      },
    },
  };
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
        ? { quickReply: quickReplies("今日の占い", "診断結果") }
        : {}),
    },
  ]);
}
