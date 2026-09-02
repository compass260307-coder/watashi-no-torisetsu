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

import {
  hashLineLinkCode,
  quickReplies,
  replyLineMessages,
  startLineLoadingAnimation,
  verifyLineSignature,
  type LineFlexMessage,
  type LineWebhookBody,
  type LineWebhookEvent,
} from "@/lib/line";
import {
  countTodayLineUserMessages,
  generateLineAliceReply,
  lineAliceChatEnabled,
  lineFreeDailyLimit,
  type LineAliceUser,
} from "@/lib/line-alice";
import {
  buildLinePlusCheckoutUrl,
  buildLinePlusPageUrl,
  hasActiveLinePlus,
  linePlusDailyLimit,
  linePlusEnabled,
} from "@/lib/line-plus";
import {
  deterministicLineEventId,
  hasLineEventOnce,
  recordLineEvent,
  recordLineEventOnce,
} from "@/lib/line-events";
import {
  FORTUNE_THEMES,
  generateThemeFortune,
  getOrCreateDailyFortune,
  type FortuneTheme,
} from "@/lib/line-fortune";
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
    "▶ Alice Plus(月480円・いつでも解約できます)",
    "　1日の上限なしのおしゃべり+恋愛運・友達運・勉強運の深掘り占い",
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
    default:
      return;
  }
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
  | "menu";

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

  // ミッション報酬: 友達回答が1件以上ある無料ユーザーは、深掘り占いを1回だけ無料開放。
  // recordLineEventOnce (決定的ID挿入) が請求ロックを兼ねるので二重配布はない
  let giftClaimed = false;
  if (!isPlus) {
    const { count } = await supabaseAdmin
      .from("friend_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= 1) {
      giftClaimed = await recordLineEventOnce({
        eventName: "line_mission_reward",
        key: userId,
        metadata: { user_id: userId, line_user_id: lineUserId, theme },
      });
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
          "▶ Alice Plus(月480円・いつでも解約できます)",
          "　あなたとの会話を覚えたうえで、恋愛運・友達運・勉強運を占います+おしゃべり上限なし",
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
    if (giftClaimed) {
      await supabaseAdmin
        .from("events")
        .delete()
        .eq("id", deterministicLineEventId("line_mission_reward", userId));
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
          "使い方はかんたん。ふだんの友達と同じように、そのまま話しかけてください。",
          "今日あったこと、もやもやしていること、なんでも大丈夫です。",
          "",
          "下のメニューからは、こんなこともできます。",
          "・今日の占い — あなたに合わせた今日のひとこと (1日1回)",
          "・診断結果 — 自己診断と友達診断をいつでも読み返す",
          "・友達に招待 — 友達診断のリンクをそのまま転送",
          "",
          `無料では1日${lineFreeDailyLimit()}通までお話しできます。上限なしで話したい人には Alice Plus (月480円) もありますよ。`,
        ].join("\n"),
        quickReply: quickReplies("今日の占い", "診断結果", "プラン"),
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
            "気になるテーマは、下のボタンから深く見られますよ。",
          ].join("\n"),
          quickReply: quickReplies("恋愛運", "友達運", "勉強運"),
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

  if (command === "mission") {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("invite_code")
      .eq("id", userId)
      .maybeSingle();
    const { count } = await supabaseAdmin
      .from("friend_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const answers = count ?? 0;
    const rewardUsed = await hasLineEventOnce("line_mission_reward", userId);
    const inviteUrl = user?.invite_code
      ? `${resolveSiteUrl()}/friend/${user.invite_code}`
      : resolveSiteUrl();

    if (rewardUsed) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: [
            "🎯 ミッション: クリア済みです🎉",
            "次のミッションは、いま準備しています。始まったらここでお知らせしますね。",
            "",
            "友達の回答は何人分でも集められますよ。招待リンクはこちら。",
            inviteUrl,
          ].join("\n"),
          quickReply: quickReplies("今日の占い", "診断結果"),
        },
      ]);
      return;
    }
    if (answers >= 1) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: [
            "🎯 ミッション達成!すごい、友達の回答が届いていますよ🎉",
            "お祝いに、Alice Plus特典の深掘り占いを1回プレゼントします🎁",
            "",
            "下のボタンから、好きなテーマを選んでくださいね。",
          ].join("\n"),
          quickReply: quickReplies("恋愛運", "友達運", "勉強運"),
        },
      ]);
      return;
    }
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "🎯 ミッション: 友達診断に友達を1人招待しよう!",
          "友達の回答が届いたら、お祝いにAlice Plus特典の深掘り占い(恋愛運・友達運・勉強運)を1回プレゼント🎁",
          "",
          "この招待リンクを、そのまま友達に送ってみてください。",
          inviteUrl,
          "",
          "回答が届いたら、もう一度「ミッション」って送ってくださいね。",
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
    if (!linePlusEnabled()) {
      await replyLineMessages(replyToken, [
        {
          type: "text",
          text: "Alice Plusは、いま準備を進めています。始まったら、ここでまっさきにお知らせしますね。",
        },
      ]);
      return;
    }
    const isPlus = await hasActiveLinePlus(userId);
    if (isPlus) {
      // 管理 (確認・解約) は1タップでも早く着くよう直で Billing Portal 行き
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
    await replyLineMessages(replyToken, [
      {
        type: "text",
        text: [
          "Alice Plusのご案内ですね。",
          "",
          "💎 Plus(月480円)でできること",
          "・1日の上限なしで、好きなだけおしゃべり",
          "・恋愛運・友達運・勉強運の深掘り占い(あなたとの会話を覚えて占います)",
          "",
          "▶ はじめてみる(いつでも解約できます)",
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

// 「メニュー」= 全機能一覧のFlexページ。物理ボタンを増やさず、新機能はまずここに足す
// (よく押されるようになったらリッチメニュー本体へ昇格させる運用・2026-09-02 オーナー方針)
function menuSection(
  label: string,
  items: string[],
): Array<Record<string, unknown>> {
  return [
    {
      type: "text",
      text: label,
      size: "xs",
      weight: "bold",
      color: "#5B5BEF",
      margin: "xl",
    },
    ...items.map((item) => ({
      type: "button",
      height: "sm",
      style: "secondary",
      color: "#F3F0FF",
      margin: "sm",
      action: { type: "message", label: item, text: item },
    })),
  ];
}

function buildMenuFlexMessage(): LineFlexMessage {
  return {
    type: "flex",
    altText: "メニュー | できること一覧",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "メニュー",
            weight: "bold",
            size: "lg",
            color: "#2E2E5C",
          },
          {
            type: "text",
            text: "やりたいことを、タップしてくださいね",
            size: "xs",
            color: "#9494B8",
            margin: "sm",
          },
          ...menuSection("🔮 うらなう", [
            "今日の占い",
            "恋愛運",
            "友達運",
            "勉強運",
          ]),
          ...menuSection("💬 はなす", ["Aliceと話す"]),
          ...menuSection("📖 じぶんを知る", ["診断結果"]),
          ...menuSection("👥 ひろげる", ["友達に招待", "ミッション"]),
          ...menuSection("⚙️ その他", ["使い方", "プラン", "お問い合わせ"]),
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
  const nowIso = new Date().toISOString();

  // 条件付き UPDATE で消費まで一撃 (二重送信・使い回しに対して原子的)
  const { data: consumed, error } = await supabaseAdmin
    .from("line_link_codes")
    .update({ consumed_at: nowIso, consumed_by_line_user_id: lineUserId })
    .eq("code_hash", hashLineLinkCode(code))
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("user_id")
    .maybeSingle();

  if (error) {
    console.error("[line/webhook] link code consume failed", {
      message: error.message,
    });
    await replyLineMessages(replyToken, [
      { type: "text", text: LINK_ERROR_MESSAGE },
    ]);
    return;
  }
  if (!consumed) {
    await replyLineMessages(replyToken, [
      { type: "text", text: LINK_INVALID_MESSAGE },
    ]);
    return;
  }

  const { error: linkError } = await supabaseAdmin.from("line_accounts").upsert(
    { line_user_id: lineUserId, user_id: consumed.user_id, linked_at: nowIso },
    { onConflict: "line_user_id" },
  );
  if (linkError) {
    console.error("[line/webhook] account link upsert failed", {
      message: linkError.message,
    });
    await replyLineMessages(replyToken, [
      { type: "text", text: LINK_ERROR_MESSAGE },
    ]);
    return;
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("display_name, owner_token")
    .eq("id", consumed.user_id)
    .maybeSingle();
  const name = (user?.display_name ?? "").trim();

  await recordLineEvent({
    eventName: "line_link_completed",
    metadata: { line_user_id: lineUserId, user_id: consumed.user_id },
    ownerToken: user?.owner_token ?? null,
  });

  await replyLineMessages(replyToken, [
    {
      type: "text",
      text: [
        `連携できました。${name ? `${name}さん` : "あなた"}のトリセツ、たしかに受け取りました。`,
        lineAliceChatEnabled()
          ? "これで、あなたに合わせてお話しできます。さっそく、今日あったことでも聞かせてくださいね。"
          : "ここでお話しできる準備が整ったら、まっさきにお知らせしますね。",
      ].join("\n"),
      ...(lineAliceChatEnabled()
        ? { quickReply: quickReplies("今日の占い", "診断結果") }
        : {}),
    },
  ]);
}

