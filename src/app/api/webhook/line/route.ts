import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { messagingApi } from "@line/bot-sdk";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  sendWelcomeMessage,
  sendGenericWelcome,
  replyToLine,
} from "@/lib/line-notify";

export const runtime = "nodejs";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

// リッチメニュー「準備中」セルの機能名マッピング
const FEATURE_NAMES: Record<string, string> = {
  scene_pages: "シーン別ページ",
  footprints: "私の足跡",
};

function verifySignature(rawBody: string, signature: string): boolean {
  if (!CHANNEL_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  // タイミング攻撃対策で timingSafeEqual を使用
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type LineEvent = {
  type: string;
  source?: { userId?: string };
  [key: string]: unknown;
};

async function handleFollowEvent(lineUserId: string): Promise<void> {
  // Phase 3-β A-3 (論点 5 a): follow / 再 follow いずれの場合も
  // notification_preferences を全 ON で UPSERT する。
  // - 初回 follow → 新規 INSERT (全 ON)
  // - 再 follow (unfollow → 再追加) → 既存行が全 OFF になっているため、ここで全 ON に戻す
  // 失敗しても welcome 送信側を止めない (webhook 200 維持原則)。
  const nowIso = new Date().toISOString();
  const { error: prefsError } = await supabaseAdmin
    .from("notification_preferences")
    .upsert(
      {
        line_user_id: lineUserId,
        enable_welcome: true,
        enable_diagnosis_complete: true,
        enable_friend_perception: true,
        enable_reminder: true,
        enable_broadcast: true,
        updated_at: nowIso,
      },
      { onConflict: "line_user_id" },
    );
  if (prefsError) {
    console.error(
      "[webhook follow] notification_preferences upsert error:",
      prefsError,
    );
    // 続行 (welcome 送信は別経路で価値があるため止めない)
  }

  // line_users で紐付けレコードを検索
  const { data, error } = await supabaseAdmin
    .from("line_users")
    .select("owner_token, welcome_sent_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (error) {
    console.error("[webhook follow] line_users lookup error:", error);
    return;
  }

  if (!data) {
    // 紐付けなし: LIFF 経由せず直接 bot 追加したユーザー → 汎用 welcome
    await sendGenericWelcome(lineUserId);
    return;
  }

  if (data.welcome_sent_at) {
    // 既に送信済み (純粋な再起動 push / 別端末再追加等) → 重複送信スキップ
    // 注: 後述 handleUnfollowEvent が unfollow 時に welcome_sent_at を NULL に戻すため、
    //     「unfollow → 再 follow」フローでは welcome は **再送される** (リセット体験)。
    console.log(
      "[webhook follow] welcome already sent, skipping for",
      lineUserId.slice(0, 8),
    );
    return;
  }

  // 紐付けあり + welcome 未送信 → 個人化 welcome 送信
  // sendWelcomeMessage は内部で welcome_sent_at を更新する
  const result = await sendWelcomeMessage(
    data.owner_token as string,
    lineUserId,
  );
  if (!result.success) {
    console.error(
      "[webhook follow] sendWelcomeMessage failed:",
      result.statusCode,
      result.error,
    );
  }
}

// Phase 3-β A-3 (論点 5 a): unfollow 受信時のリセット処理
// - line_users.welcome_sent_at を NULL に戻し、次の follow で welcome 再送できるようにする
// - notification_preferences の全カラムを false に UPDATE (= 通知停止)
//   ※ 行が存在しないユーザーは何もしない (follow を一度も通っていない異常系)
// - 物理削除はしない (再 follow 時のスムーズな復旧のため)
async function handleUnfollowEvent(lineUserId: string): Promise<void> {
  const nowIso = new Date().toISOString();

  // 1. welcome_sent_at リセット
  const { error: welcomeResetError } = await supabaseAdmin
    .from("line_users")
    .update({ welcome_sent_at: null })
    .eq("line_user_id", lineUserId);
  if (welcomeResetError) {
    console.error(
      "[webhook unfollow] line_users.welcome_sent_at reset error:",
      welcomeResetError,
    );
    // 続行 (片方失敗しても他方を試す)
  }

  // 2. notification_preferences 全カラム OFF (行があれば)
  const { error: prefsOffError } = await supabaseAdmin
    .from("notification_preferences")
    .update({
      enable_welcome: false,
      enable_diagnosis_complete: false,
      enable_friend_perception: false,
      enable_reminder: false,
      enable_broadcast: false,
      updated_at: nowIso,
    })
    .eq("line_user_id", lineUserId);
  if (prefsOffError) {
    console.error(
      "[webhook unfollow] notification_preferences disable error:",
      prefsOffError,
    );
  }

  console.log(
    "[webhook unfollow] processed for",
    lineUserId.slice(0, 8),
  );
}

function buildComingSoonFlex(
  feature: string,
  featureName: string,
): messagingApi.Message {
  return {
    type: "flex",
    altText: `${featureName}は準備中です🐧`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `${featureName}は準備中です🐧`,
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "もうすぐここに追加します。完成したらお知らせを受け取りますか?",
            size: "sm",
            color: "#666666",
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "postback",
              label: "お知らせを受け取る",
              data: `action=optin&feature=${feature}`,
              displayText: "お知らせを受け取る",
            },
            style: "primary",
            color: "#FF6B9C",
            height: "md",
          },
        ],
      },
    },
  };
}

async function handleComingSoon(
  replyToken: string,
  feature: string,
): Promise<void> {
  const featureName = FEATURE_NAMES[feature];
  if (!featureName) {
    console.warn("[webhook postback] unknown feature for coming_soon:", feature);
    return;
  }
  await replyToLine(replyToken, [buildComingSoonFlex(feature, featureName)], {
    kind: "coming_soon",
    feature,
  });
}

async function handleOptin(
  replyToken: string,
  lineUserId: string,
  feature: string,
): Promise<void> {
  const featureName = FEATURE_NAMES[feature];
  if (!featureName) {
    console.warn("[webhook postback] unknown feature for optin:", feature);
    return;
  }

  // unique(line_user_id, feature) のため重複は ignoreDuplicates でスキップ
  const { error } = await supabaseAdmin
    .from("feature_optins")
    .upsert(
      { line_user_id: lineUserId, feature },
      { onConflict: "line_user_id,feature", ignoreDuplicates: true },
    );

  if (error) {
    console.error("[webhook postback] feature_optins upsert error:", error);
    await replyToLine(
      replyToken,
      [
        {
          type: "text",
          text: "エラーが発生しました。少し時間をおいて再試行してください🐧",
        },
      ],
      { kind: "optin_error", feature },
    );
    return;
  }

  await replyToLine(
    replyToken,
    [
      {
        type: "text",
        text: `登録完了!${featureName}がリリースされたらお知らせします🐧`,
      },
    ],
    { kind: "optin_complete", feature },
  );
}

async function handlePostbackEvent(
  replyToken: string,
  lineUserId: string | undefined,
  data: string,
): Promise<void> {
  const params = new URLSearchParams(data);
  const action = params.get("action");
  const feature = params.get("feature");

  if (action === "coming_soon" && feature) {
    await handleComingSoon(replyToken, feature);
    return;
  }

  if (action === "optin" && feature) {
    if (!lineUserId) {
      console.warn("[webhook postback] optin without lineUserId");
      return;
    }
    await handleOptin(replyToken, lineUserId, feature);
    return;
  }

  console.log("[webhook postback] unknown data, skipping:", data);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature || !verifySignature(rawBody, signature)) {
    console.warn("[webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[webhook] JSON parse error:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = payload.events ?? [];

  // LINE は at-least-once 配信。各イベントのエラーは個別に握り潰し、200 を返す
  for (const event of events) {
    try {
      if (event.type === "follow") {
        const userId = event.source?.userId;
        if (userId) {
          await handleFollowEvent(userId);
        }
      } else if (event.type === "unfollow") {
        // Phase 3-β A-3: unfollow リセット (welcome_sent_at / notification_preferences)
        const userId = event.source?.userId;
        if (userId) {
          await handleUnfollowEvent(userId);
        }
      } else if (event.type === "postback") {
        const replyToken = (event as { replyToken?: unknown }).replyToken;
        const postback = (event as { postback?: { data?: unknown } }).postback;
        const data = postback?.data;
        if (typeof replyToken === "string" && typeof data === "string") {
          await handlePostbackEvent(replyToken, event.source?.userId, data);
        }
      }
      // message / beacon 等は将来必要になったら追加
    } catch (err) {
      console.error("[webhook] event handling error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
