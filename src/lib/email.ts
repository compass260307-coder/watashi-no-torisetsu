// プレミアム化 v3 Day 6: Resend ラッパー
//
// Resend SDK の薄いラッパー。env (RESEND_API_KEY, RESEND_FROM_EMAIL) 未設定や
// 送信失敗時は console.error に残してアプリは落とさない (return void で握りつぶし)。
// Slack alert / 監視は Day 10 で別途。
//
// テンプレ方針 (T3-5 ブランド): 絵文字なし、和の上品さ、装飾は余白・タイポで。
// HTML + plain text を両方送る (受信側のクライアント・spam フィルタ対応)。

import { Resend } from "resend";

const SITE_NAME = "ワタシのトリセツ";

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
