// プレミアム化 v3 Day 6: Resend ラッパー
//
// Resend SDK の薄いラッパー。env (RESEND_API_KEY, RESEND_FROM_EMAIL) 未設定や
// 送信失敗時は console.error に残してアプリは落とさない (return void で握りつぶし)。
// Slack alert / 監視は Day 10 で別途。
//
// テンプレ方針 (T3-5 ブランド): 絵文字なし、和の上品さ、装飾は余白・タイポで。
// HTML + plain text を両方送る (受信側のクライアント・spam フィルタ対応)。

import { Resend } from "resend";
import { resolveSiteUrl } from "./site-url";

const SITE_NAME = "ワタシのトリセツ";
const SITE_URL =
  resolveSiteUrl();

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping send");
    return null;
  }
  return new Resend(apiKey);
}

function getFromAddress(): string | null {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    console.warn("[email] RESEND_FROM_EMAIL not configured; skipping send");
    return null;
  }
  // 表示名付きで送る (受信側で「ワタシのトリセツ <noreply@...>」と表示)
  return `${SITE_NAME} <${from}>`;
}

interface SendMagicLinkArgs {
  to: string;
  magicLinkUrl: string;
}

/**
 * マジックリンクメールを送信。
 *
 * 失敗時 (Resend API エラー、env 未設定) は console.error で記録し void return。
 * 呼び出し側は成功・失敗に関わらず enumeration 対策のため同じレスポンスを返す。
 */
export async function sendMagicLinkEmail(
  args: SendMagicLinkArgs,
): Promise<void> {
  const resend = getResendClient();
  const from = getFromAddress();
  if (!resend || !from) return;

  try {
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject: `${SITE_NAME} - ログインリンク`,
      html: renderHtml(args.magicLinkUrl),
      text: renderText(args.magicLinkUrl),
    });
    if (result.error) {
      console.error("[email] Resend send error:", result.error);
    }
  } catch (err) {
    console.error("[email] Resend exception:", err);
  }
}

interface SendFriendPerceptionArgs {
  to: string;
  perceiverName: string;
  ownerName: string | null;
  ownerToken: string;
  perceptionType: string;
  perceptionModifierLabel?: string | null;
}

/**
 * 友達評価到着通知メール (Day 11)。
 *
 * 友達 (perceiverName) が target (owner) を評価したときに owner.email へ送信。
 * 永続 URL は /me/[ownerToken]、リンクで詳細確認できる。
 * 旧 LINE 通知 sendFriendPerceptionReceivedMessage の Web ファースト等価。
 */
export async function sendFriendPerceptionEmail(
  args: SendFriendPerceptionArgs,
): Promise<void> {
  const resend = getResendClient();
  const from = getFromAddress();
  if (!resend || !from) return;

  const ownerDisplay = (args.ownerName ?? "").trim() || "あなた";
  const meUrl = `${SITE_URL}/me/${encodeURIComponent(args.ownerToken)}`;
  const subject = `${args.perceiverName}さんから新しい印象が届きました`;

  try {
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject,
      html: renderFriendPerceptionHtml({
        meUrl,
        perceiverName: args.perceiverName,
        ownerDisplay,
        perceptionType: args.perceptionType,
        perceptionModifierLabel: args.perceptionModifierLabel ?? null,
      }),
      text: renderFriendPerceptionText({
        meUrl,
        perceiverName: args.perceiverName,
        ownerDisplay,
        perceptionType: args.perceptionType,
        perceptionModifierLabel: args.perceptionModifierLabel ?? null,
      }),
    });
    if (result.error) {
      console.error(
        "[email] sendFriendPerceptionEmail Resend error:",
        result.error,
      );
    }
  } catch (err) {
    console.error("[email] sendFriendPerceptionEmail exception:", err);
  }
}

interface SendTrisetsuCompleteArgs {
  to: string;
  ownerToken: string;
  ownerName?: string | null;
  title?: string | null;
}

/**
 * 統合トリセツ生成完了メール。
 *
* 永続 URL は /me/[ownerToken] (Day 9 で旧 /result/[ownerToken] から統一)。
 * 送信失敗時は console.error で記録、void で握りつぶし (Webhook を壊さない)。
 */
export async function sendTrisetsuCompleteEmail(
  args: SendTrisetsuCompleteArgs,
): Promise<void> {
  const resend = getResendClient();
  const from = getFromAddress();
  if (!resend || !from) return;

  const greetingName = (args.ownerName ?? "").trim();
  const resultUrl = `${SITE_URL}/me/${encodeURIComponent(args.ownerToken)}`;
  const subject = `${SITE_NAME}が完成しました`;

  try {
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject,
      html: renderTrisetsuCompleteHtml({
        resultUrl,
        greetingName,
        title: args.title ?? null,
      }),
      text: renderTrisetsuCompleteText({
        resultUrl,
        greetingName,
        title: args.title ?? null,
      }),
    });
    if (result.error) {
      console.error("[email] sendTrisetsuCompleteEmail Resend error:", result.error);
    }
  } catch (err) {
    console.error("[email] sendTrisetsuCompleteEmail exception:", err);
  }
}

// =========================================================================
// テンプレ (絵文字なし、明朝体ベースのインライン CSS で和の上品さ)
// =========================================================================

function renderHtml(url: string): string {
  // インライン CSS のみ (Gmail / iOS Mail / Outlook の互換性確保)。
  // serif フォント指定で和の質感、十分な余白で読みやすさ。
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SITE_NAME} - ログインリンク</title>
  </head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;color:#2A2520;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E8E1D5;border-radius:12px;padding:40px 32px;">
            <tr>
              <td>
                <p style="margin:0 0 24px;font-size:11px;letter-spacing:0.2em;color:#A89E8E;text-align:center;">WATASHI NO TORISETSU</p>
                <h1 style="margin:0 0 28px;font-size:22px;font-weight:600;line-height:1.5;text-align:center;color:#2A2520;">ログインリンクをお送りします</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.85;">
                  下のボタンから、${SITE_NAME}の自分のデータにアクセスできます。
                </p>
                <p style="margin:0 0 32px;text-align:center;">
                  <a href="${url}" style="display:inline-block;padding:14px 36px;background:#2A2520;color:#FAF7F2;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.05em;border-radius:999px;">ログインする</a>
                </p>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.85;color:#6B6359;">
                  このリンクは <strong>1 時間</strong> で失効します。<br />
                  一度使うと再利用できません。
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.85;color:#6B6359;">
                  ボタンが押せない場合は、以下の URL をブラウザに貼り付けてください。
                </p>
                <p style="margin:0 0 32px;font-size:12px;line-height:1.65;color:#A89E8E;word-break:break-all;">
                  ${url}
                </p>
                <hr style="border:none;border-top:1px solid #E8E1D5;margin:32px 0;" />
                <p style="margin:0;font-size:12px;line-height:1.8;color:#A89E8E;">
                  心当たりがない場合は、このメールは無視してください。<br />
                  第三者があなたのメールアドレスを誤って入力した可能性があります。
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:11px;color:#A89E8E;">${SITE_NAME}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(url: string): string {
  return [
    `${SITE_NAME} - ログインリンク`,
    "",
    `${SITE_NAME}の自分のデータにアクセスするには、以下の URL を開いてください。`,
    "",
    url,
    "",
    "このリンクは 1 時間で失効します。一度使うと再利用できません。",
    "",
    "心当たりがない場合は、このメールは無視してください。",
    "第三者があなたのメールアドレスを誤って入力した可能性があります。",
    "",
    `--`,
    SITE_NAME,
  ].join("\n");
}

// =========================================================================
// Trisetsu 完成通知メールのテンプレ
// =========================================================================

interface TrisetsuCompleteTemplateArgs {
  resultUrl: string;
  greetingName: string;
  title: string | null;
}

function renderTrisetsuCompleteHtml(
  args: TrisetsuCompleteTemplateArgs,
): string {
  const greeting = args.greetingName
    ? `${escapeHtml(args.greetingName)}さん、`
    : "";
  const titleLine = args.title
    ? `<p style="margin:0 0 12px;font-size:18px;font-weight:600;line-height:1.6;text-align:center;color:#2A2520;">${escapeHtml(args.title)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SITE_NAME}が完成しました</title>
  </head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;color:#2A2520;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E8E1D5;border-radius:12px;padding:40px 32px;">
            <tr>
              <td>
                <p style="margin:0 0 24px;font-size:11px;letter-spacing:0.2em;color:#A89E8E;text-align:center;">WATASHI NO TORISETSU</p>
                <h1 style="margin:0 0 28px;font-size:22px;font-weight:600;line-height:1.55;text-align:center;color:#2A2520;">真のトリセツが完成しました</h1>
                ${titleLine}
                <p style="margin:0 0 20px;font-size:15px;line-height:1.85;">
                  ${greeting}ご購入ありがとうございます。<br />
                  友達の眼を通して作られた、あなただけの取扱説明書をお届けします。
                </p>
                <p style="margin:0 0 32px;text-align:center;">
                  <a href="${args.resultUrl}" style="display:inline-block;padding:14px 36px;background:#2A2520;color:#FAF7F2;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.05em;border-radius:999px;">トリセツを開く</a>
                </p>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.85;color:#6B6359;">
                  <strong>このリンクは永続的にアクセスできます。</strong><br />
                  ブックマークしておくと、いつでも読み返せます。<br />
                  PDF として保存することもできます。
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.85;color:#6B6359;">
                  ボタンが押せない場合は、以下の URL をブラウザに貼り付けてください。
                </p>
                <p style="margin:0 0 32px;font-size:12px;line-height:1.65;color:#A89E8E;word-break:break-all;">
                  ${args.resultUrl}
                </p>
                <hr style="border:none;border-top:1px solid #E8E1D5;margin:32px 0;" />
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#2A2520;">別の端末からアクセスするには</p>
                <p style="margin:0;font-size:12px;line-height:1.85;color:#6B6359;">
                  ${SITE_NAME}のトップから「ログインリンクを送る」を選び、このメールアドレスを入力してください。新しい端末にもログインリンクが届きます。
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:11px;color:#A89E8E;">${SITE_NAME}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderTrisetsuCompleteText(
  args: TrisetsuCompleteTemplateArgs,
): string {
  const greeting = args.greetingName ? `${args.greetingName}さん、` : "";
  const lines = [`${SITE_NAME}が完成しました`, ""];
  if (args.title) {
    lines.push(args.title, "");
  }
  lines.push(
    `${greeting}ご購入ありがとうございます。`,
    "友達の眼を通して作られた、あなただけの取扱説明書をお届けします。",
    "",
    "■ トリセツを開く",
    args.resultUrl,
    "",
    "このリンクは永続的にアクセスできます。",
    "ブックマークしておくと、いつでも読み返せます。",
    "PDF として保存することもできます。",
    "",
    "■ 別の端末からアクセスするには",
    `${SITE_NAME}のトップから「ログインリンクを送る」を選び、`,
    "このメールアドレスを入力してください。",
    "新しい端末にもログインリンクが届きます。",
    "",
    `--`,
    SITE_NAME,
  );
  return lines.join("\n");
}

// =========================================================================
// 友達評価到着通知メールのテンプレ
// =========================================================================

interface FriendPerceptionTemplateArgs {
  meUrl: string;
  perceiverName: string;
  ownerDisplay: string;
  perceptionType: string;
  perceptionModifierLabel: string | null;
}

function renderFriendPerceptionHtml(
  args: FriendPerceptionTemplateArgs,
): string {
  // XSS 対策: perceiverName / ownerDisplay / perceptionType / perceptionModifierLabel
  // はユーザー入力 / 派生計算ラベルが入る。escapeHtml を通す。
  const perceiverName = escapeHtml(args.perceiverName);
  const ownerDisplay = escapeHtml(args.ownerDisplay);
  const perceptionType = escapeHtml(args.perceptionType);
  const modifierLabel = args.perceptionModifierLabel
    ? escapeHtml(args.perceptionModifierLabel)
    : "";
  const modifierLine = modifierLabel
    ? `<p style="margin:0 0 12px;font-size:13px;color:#6B6359;text-align:center;">${modifierLabel}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${perceiverName}さんから新しい印象が届きました</title>
  </head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;color:#2A2520;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E8E1D5;border-radius:12px;padding:40px 32px;">
            <tr>
              <td>
                <p style="margin:0 0 24px;font-size:11px;letter-spacing:0.2em;color:#A89E8E;text-align:center;">WATASHI NO TORISETSU</p>
                <h1 style="margin:0 0 24px;font-size:21px;font-weight:600;line-height:1.6;text-align:center;color:#2A2520;">新しい印象が届きました</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.85;">
                  ${perceiverName}さんから、${ownerDisplay}さんへの新しい印象が届きました。
                </p>
                <div style="margin:0 0 28px;padding:20px 16px;background:#FAF7F2;border:1px solid #E8E1D5;border-radius:8px;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.15em;color:#A89E8E;">PERCEIVED TYPE</p>
                  <p style="margin:0 0 4px;font-size:17px;font-weight:600;line-height:1.6;color:#2A2520;">${perceptionType}</p>
                  ${modifierLine}
                </div>
                <p style="margin:0 0 32px;text-align:center;">
                  <a href="${args.meUrl}" style="display:inline-block;padding:14px 36px;background:#2A2520;color:#FAF7F2;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.05em;border-radius:999px;">マイ図鑑で詳しく見る</a>
                </p>
                <p style="margin:0 0 20px;font-size:13px;line-height:1.85;color:#6B6359;">
                  友達ごとに違う「眼」が集まると、もっと立体的な自分が見えてきます。
                  <br />
                  3 人以上の眼で見てもらうと「真のトリセツ」も作れます。
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.85;color:#6B6359;">
                  ボタンが押せない場合は、以下の URL をブラウザに貼り付けてください。
                </p>
                <p style="margin:0;font-size:12px;line-height:1.65;color:#A89E8E;word-break:break-all;">
                  ${args.meUrl}
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:11px;color:#A89E8E;">${SITE_NAME}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderFriendPerceptionText(
  args: FriendPerceptionTemplateArgs,
): string {
  const lines = [
    `${args.perceiverName}さんから新しい印象が届きました`,
    "",
    `${args.perceiverName}さんから、${args.ownerDisplay}さんへの新しい印象が届きました。`,
    "",
    "■ 友達から見たあなた",
    `タイプ: ${args.perceptionType}`,
  ];
  if (args.perceptionModifierLabel) {
    lines.push(`雰囲気: ${args.perceptionModifierLabel}`);
  }
  lines.push(
    "",
    "■ マイ図鑑で詳しく見る",
    args.meUrl,
    "",
    "友達ごとに違う「眼」が集まると、もっと立体的な自分が見えてきます。",
    "3 人以上の眼で見てもらうと「真のトリセツ」も作れます。",
    "",
    "--",
    SITE_NAME,
  );
  return lines.join("\n");
}

// HTML テンプレ内で文字を埋め込む際の最低限のエスケープ。
// owner name や title はユーザー入力 (display_name) / AI 生成テキストが入る可能性あり。
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
