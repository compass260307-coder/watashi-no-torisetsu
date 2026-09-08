// プレミアム化 v3 Day 6: Resend ラッパー
//
// Resend SDK の薄いラッパー。env (RESEND_API_KEY, RESEND_FROM_EMAIL) 未設定や
// 送信失敗時は console.error に残してアプリは落とさない (return void で握りつぶし)。
// Slack alert / 監視は Day 10 で別途。
//
// テンプレ方針 (T3-5 ブランド): 絵文字なし、和の上品さ、装飾は余白・タイポで。
// HTML + plain text を両方送る (受信側のクライアント・spam フィルタ対応)。

import { Resend } from "resend";
import {
  FULL_ACCESS_PRICE_JPY,
  FULL_ACCESS_PRICE_KRW,
  HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS,
  PREMIUM_BUNDLE_PRICE_JPY,
  PREMIUM_BUNDLE_PRICE_KRW,
  SELF_REPORT_PRICE_JPY,
  SELF_REPORT_PRICE_KRW,
  type AccessProduct,
} from "@/lib/access-products";
import { resolveSiteUrl } from "./site-url";

const SITE_NAME = "ワタシのトリセツ";
const KO_SITE_NAME = "나의 사용설명서";
const LINE_ADD_FRIEND_URL = "https://line.me/R/ti/p/%40867domoo";
const SITE_URL =
  resolveSiteUrl();
type EmailLocale = "ja" | "ko";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping send");
    return null;
  }
  return new Resend(apiKey);
}

function getFromAddress(siteName = SITE_NAME): string | null {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    console.warn("[email] RESEND_FROM_EMAIL not configured; skipping send");
    return null;
  }
  // 表示名付きで送る (受信側で「ワタシのトリセツ <noreply@...>」と表示)
  return `${siteName} <${from}>`;
}

interface SendMagicLinkArgs {
  to: string;
  magicLinkUrl: string;
  locale?: EmailLocale;
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
  const locale = args.locale ?? "ja";
  const siteName = locale === "ko" ? KO_SITE_NAME : SITE_NAME;
  const resend = getResendClient();
  const from = getFromAddress(siteName);
  if (!resend || !from) return;

  try {
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject:
        locale === "ko"
          ? `${KO_SITE_NAME} - 로그인 링크`
          : `${SITE_NAME} - ログインリンク`,
      html: renderHtml(args.magicLinkUrl, locale),
      text: renderText(args.magicLinkUrl, locale),
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

interface SendDetailedReportArgs {
  to: string;
  ownerToken: string;
  ownerName?: string | null;
  locale?: EmailLocale;
  product?: AccessProduct;
  destinyFeaturesIncluded?: boolean;
  hoshiyomiChatIncluded?: boolean;
  hoshiyomiChatCredits?: number;
  tarotFeaturesIncluded?: boolean;
  friendFeaturesIncluded?: boolean;
  purchaseAmountJpy?: number | null;
  purchaseAmountMinor?: number | null;
}

/**
 * 詳細レポートお届けメール (フルアクセス購入特典)。
 *
 * Stripe Webhook (checkout.session.completed / product=full_access) から送信。
 * 自己診断とPDFに加え、購入世代に応じて
 * 運命の設計図・専属占い師・タロットの案内も同封する。
 *   - 「解放された自己診断結果を見る」= /me/[ownerToken] または /ko/me/[ownerToken]
 *   - 「完全版 PDF をダウンロード」= /report/[ownerToken]/pdf
 * どちらも token ベースの永続 URL。ゲスト決済 (診断前) でも診断完了後に
 * 同じリンクが本人のタイプの内容になる。
 * 送信失敗時は console.error で記録、void で握りつぶし (Webhook を壊さない)。
 */
export async function sendDetailedReportEmail(
  args: SendDetailedReportArgs,
): Promise<void> {
  const locale = args.locale ?? "ja";
  const product = args.product ?? "full_access";
  const siteName = locale === "ko" ? KO_SITE_NAME : SITE_NAME;
  const resend = getResendClient();
  const from = getFromAddress(siteName);
  if (!resend || !from) return;

  const greetingName = (args.ownerName ?? "").trim();
  const token = encodeURIComponent(args.ownerToken);
  const meUrl = `${SITE_URL}${locale === "ko" ? "/ko" : ""}/me/${token}`;
  const pdfUrl = `${SITE_URL}/report/${token}/pdf${locale === "ko" ? "?locale=ko" : ""}`;
  const unmeiUrl = `${SITE_URL}${locale === "ko" ? "/ko" : ""}/unmei`;
  const hoshiyomiUrl = `${SITE_URL}${locale === "ko" ? "/ko" : ""}/hoshiyomi`;
  const subject =
    locale === "ko"
      ? product === "self_report"
        ? `【${KO_SITE_NAME}】학생 플랜이 열렸어요`
        : product === "premium_bundle"
          ? `【${KO_SITE_NAME}】프리미엄 코스가 열렸어요`
          : `【${KO_SITE_NAME}】완전판 리포트를 보내 드립니다`
      : product === "self_report"
        ? `【${SITE_NAME}】学生向けプランを解放しました`
        : product === "premium_bundle"
          ? `【${SITE_NAME}】全部入りを解放しました`
          : `【${SITE_NAME}】完全版レポートをお届けします`;

  try {
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject,
      html:
        locale === "ko"
          ? renderDetailedReportHtmlKo({
              pdfUrl,
              meUrl,
              unmeiUrl,
              hoshiyomiUrl,
              greetingName,
              product,
              destinyFeaturesIncluded: args.destinyFeaturesIncluded,
              hoshiyomiChatIncluded: args.hoshiyomiChatIncluded,
              hoshiyomiChatCredits: args.hoshiyomiChatCredits,
              tarotFeaturesIncluded: args.tarotFeaturesIncluded,
              friendFeaturesIncluded: args.friendFeaturesIncluded,
              purchaseAmountMinor: args.purchaseAmountMinor,
            })
          : renderDetailedReportHtml({
              pdfUrl,
              meUrl,
              unmeiUrl,
              hoshiyomiUrl,
              greetingName,
              product,
              destinyFeaturesIncluded: args.destinyFeaturesIncluded,
              hoshiyomiChatIncluded: args.hoshiyomiChatIncluded,
              hoshiyomiChatCredits: args.hoshiyomiChatCredits,
              tarotFeaturesIncluded: args.tarotFeaturesIncluded,
              friendFeaturesIncluded: args.friendFeaturesIncluded,
              purchaseAmountMinor: args.purchaseAmountMinor,
              purchaseAmountJpy: args.purchaseAmountJpy,
            }),
      text:
        locale === "ko"
          ? renderDetailedReportTextKo({
              pdfUrl,
              meUrl,
              unmeiUrl,
              hoshiyomiUrl,
              greetingName,
              product,
              destinyFeaturesIncluded: args.destinyFeaturesIncluded,
              hoshiyomiChatIncluded: args.hoshiyomiChatIncluded,
              hoshiyomiChatCredits: args.hoshiyomiChatCredits,
              tarotFeaturesIncluded: args.tarotFeaturesIncluded,
              friendFeaturesIncluded: args.friendFeaturesIncluded,
            })
          : renderDetailedReportText({
              pdfUrl,
              meUrl,
              unmeiUrl,
              hoshiyomiUrl,
              greetingName,
              product,
              destinyFeaturesIncluded: args.destinyFeaturesIncluded,
              hoshiyomiChatIncluded: args.hoshiyomiChatIncluded,
              hoshiyomiChatCredits: args.hoshiyomiChatCredits,
              tarotFeaturesIncluded: args.tarotFeaturesIncluded,
              friendFeaturesIncluded: args.friendFeaturesIncluded,
            }),
    });
    if (result.error) {
      console.error("[email] sendDetailedReportEmail Resend error:", result.error);
    }
  } catch (err) {
    console.error("[email] sendDetailedReportEmail exception:", err);
  }
}

// =========================================================================
// テンプレ (絵文字なし、明朝体ベースのインライン CSS で和の上品さ)
// =========================================================================

function renderHtml(url: string, locale: EmailLocale): string {
  if (locale === "ko") return renderMagicLinkHtmlKo(url);
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

function renderText(url: string, locale: EmailLocale): string {
  if (locale === "ko") {
    return [
      `${KO_SITE_NAME} - 로그인 링크`,
      "",
      `아래 링크를 열면 ${KO_SITE_NAME}의 내 데이터에 로그인할 수 있어요.`,
      "",
      url,
      "",
      "이 링크는 1시간 뒤 만료되며 한 번만 사용할 수 있어요.",
      "",
      "요청한 적이 없다면 이 메일을 무시해 주세요.",
      "",
      "--",
      KO_SITE_NAME,
    ].join("\n");
  }
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

function renderMagicLinkHtmlKo(url: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${KO_SITE_NAME} - 로그인 링크</title></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;color:#2A2520;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 16px;"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E8E1D5;border-radius:12px;padding:40px 32px;"><tr><td>
        <p style="margin:0 0 24px;font-size:11px;letter-spacing:0.2em;color:#A89E8E;text-align:center;">WATASHI NO TORISETSU</p>
        <h1 style="margin:0 0 28px;font-size:22px;font-weight:700;line-height:1.5;text-align:center;color:#2A2520;">로그인 링크를 보내 드립니다</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.85;">아래 버튼을 누르면 ${KO_SITE_NAME}의 내 데이터에 로그인할 수 있어요.</p>
        <p style="margin:0 0 32px;text-align:center;"><a href="${url}" style="display:inline-block;padding:14px 36px;background:#2A2520;color:#FAF7F2;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">로그인하기</a></p>
        <p style="margin:0 0 24px;font-size:13px;line-height:1.85;color:#6B6359;">이 링크는 <strong>1시간</strong> 뒤 만료되며 한 번만 사용할 수 있어요.<br />버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.</p>
        <p style="margin:0 0 32px;font-size:12px;line-height:1.65;color:#A89E8E;word-break:break-all;">${url}</p>
        <hr style="border:none;border-top:1px solid #E8E1D5;margin:32px 0;" />
        <p style="margin:0;font-size:12px;line-height:1.8;color:#A89E8E;">요청한 적이 없다면 이 메일을 무시해 주세요.</p>
      </td></tr></table>
      <p style="margin:24px 0 0;font-size:11px;color:#A89E8E;">${KO_SITE_NAME}</p>
    </td></tr></table>
  </body>
</html>`;
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
// 詳細レポートお届けメールのテンプレ
// =========================================================================

interface DetailedReportTemplateArgs {
  pdfUrl: string;
  meUrl: string;
  unmeiUrl?: string;
  hoshiyomiUrl?: string;
  greetingName: string;
  product?: AccessProduct;
  destinyFeaturesIncluded?: boolean;
  hoshiyomiChatIncluded?: boolean;
  hoshiyomiChatCredits?: number;
  tarotFeaturesIncluded?: boolean;
  friendFeaturesIncluded?: boolean;
  purchaseAmountJpy?: number | null;
  purchaseAmountMinor?: number | null;
}

// export はテンプレプレビュー (scripts/preview-report-email.ts) 用
export function renderDetailedReportHtml(args: DetailedReportTemplateArgs): string {
  const greeting = args.greetingName
    ? `${escapeHtml(args.greetingName)}さん、こんにちは。`
    : "こんにちは。";
  const isSelfReport = args.product === "self_report";
  const isPremiumBundle = args.product === "premium_bundle";
  const hasUnmei = args.destinyFeaturesIncluded ?? isPremiumBundle;
  // 占い師チャットは設計図と独立 (完全版にも付く)。未指定は旧来どおり設計図に追従。
  const hasHoshiyomi = args.hoshiyomiChatIncluded ?? hasUnmei;
  const hoshiyomiChatCredits =
    args.hoshiyomiChatCredits ?? HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS;
  const hasTarot = args.tarotFeaturesIncluded ?? isPremiumBundle;
  const hasFriendFeatures = args.friendFeaturesIncluded ?? false;
  const showLineInvitation = !isSelfReport;
  const heroImageUrl = `${SITE_URL}${
    isPremiumBundle
      ? "/mascot/unmei-hero.png"
      : isSelfReport
        ? "/checkout-fullaccess.png"
        : "/mascot/hoshiyomi-alice-writing-transparent.png"
  }`;
  const heroImageAlt = isSelfReport
    ? "自己分析レポート"
    : isPremiumBundle
      ? "全部入りレポート"
      : "占いをするAlice";
  const reportName = isSelfReport
    ? "ワタシのトリセツ 学生向けプラン"
    : isPremiumBundle
      ? "ワタシのトリセツ 全部入り"
      : "ワタシのトリセツ 性格レポート完全版";
  const pdfLabel = isSelfReport ? "自己分析PDF" : "完全版PDF";
  const defaultPurchaseAmount = isSelfReport
    ? SELF_REPORT_PRICE_JPY
    : isPremiumBundle
      ? PREMIUM_BUNDLE_PRICE_JPY
      : FULL_ACCESS_PRICE_JPY;
  const purchasePrice = `¥${(
    args.purchaseAmountJpy ?? defaultPurchaseAmount
  ).toLocaleString("ja-JP")}`;
  const purchaseItems = isSelfReport
    ? `<tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">自己診断結果のロックされた9セクションをすべて解放</td>
                        </tr>
                        <tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">16ページ以上の自己分析PDF</td>
                        </tr>
                        ${hasFriendFeatures ? `<tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">2人目以降の友達診断結果もすべて解放</td>
                        </tr>
                        <tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">何度でも作り直せる友達診断分析PDF</td>
                        </tr>` : ""}`
    : `<tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">キャリア・成長の深掘り</td>
                        </tr>
                        <tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">友達ひとりずつの本音</td>
                        </tr>
                        <tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">シーン別の相性</td>
                        </tr>${
                          hasUnmei
                            ? `<tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">あなた専用の運命の設計図</td>
                        </tr>`
                            : ""
                        }${
                          hasHoshiyomi
                            ? `<tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">あなたの専属占い師とのチャット${hoshiyomiChatCredits}回分</td>
                        </tr>`
                            : ""
                        }${
                          hasTarot
                            ? `<tr>
                          <td valign="top" style="width:22px;padding:3px 0 9px;color:#5B5BEF;font-size:15px;font-weight:800;">&#10003;</td>
                          <td style="padding:0 0 9px;font-size:15px;line-height:1.75;color:#5A5A6E;">Aliceのタロット占い3種類をすべて解放</td>
                        </tr>`
                            : ""
                        }`;

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${isSelfReport ? "自己分析レポート" : "完全版レポート"}をお届けします</title>
    <style>
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 0 !important; }
        .email-card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
        .email-content { padding: 36px 24px !important; }
        .cta-link { display: block !important; min-width: 0 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#F3F3F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif;color:#2E2E5C;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ご購入いただいた${isSelfReport ? "自己分析レポート" : "完全版レポート"}の準備ができました。自己診断結果と${pdfLabel}をご利用いただけます。
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F3F3F7;">
      <tr>
        <td class="email-shell" align="center" style="padding:32px 16px;">
          <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background:#FFFFFF;border:1px solid #E4E4F0;border-radius:18px;overflow:hidden;">
            <tr>
              <td class="email-content" style="padding:48px 46px 44px;">
                <p style="margin:0 0 22px;text-align:center;font-size:15px;font-weight:800;line-height:1.6;letter-spacing:0.12em;color:#2E2E5C;">
                  ワタシのトリセツ
                </p>
                <p style="margin:0 0 36px;text-align:center;">
                  <img src="${heroImageUrl}" width="420" alt="${heroImageAlt}" style="display:inline-block;width:420px;max-width:100%;height:auto;border:0;border-radius:14px;" />
                </p>

                <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#2E2E5C;">
                  ${greeting}
                </p>
                <p style="margin:0 0 30px;font-size:15px;line-height:1.9;color:#5A5A6E;">
                  ご購入ありがとうございます。<br />
                  「${reportName}」のご用意ができました。購入いただいた内容は、下のボタンからいつでもご覧いただけます。${showLineInvitation ? " また、LINEでAliceとのおしゃべりや毎日の占いを楽しめる「Alice Plus」も体験できます。" : ""}
                </p>

                ${showLineInvitation ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;background:#F0FBF4;border:1px solid #CDEFD9;border-radius:14px;">
                  <tr>
                    <td style="padding:26px 24px;text-align:center;">
                      <h2 style="margin:0 0 20px;font-size:20px;font-weight:800;line-height:1.55;color:#2E2E5C;">LINEでAlice Plusを体験しよう</h2>
                      <a class="cta-link" href="${LINE_ADD_FRIEND_URL}" style="display:block;padding:15px 18px;background:#06C755;color:#FFFFFF;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:1.4;border-radius:999px;box-shadow:0 4px 0 #04933F;">LINEでAlice Plusを体験する&nbsp; &#8594;</a>
                    </td>
                  </tr>
                </table>` : ""}

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 32px;">
                  <tr>
                    <td align="center" style="padding:0 0 14px;">
                      <a class="cta-link" href="${args.meUrl}" style="display:block;padding:15px 18px;background:#5B5BEF;color:#FFFFFF;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:1.4;border-radius:999px;box-shadow:0 4px 0 #4A4AD9;">解放された自己診断結果を見る&nbsp; &#8594;</a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0;">
                      <a class="cta-link" href="${args.pdfUrl}" style="display:block;padding:15px 18px;background:#2E2E5C;color:#FFFFFF;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:1.4;border-radius:999px;box-shadow:0 4px 0 #1B1B3E;">${pdfLabel}をダウンロード&nbsp; &#8594;</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 32px;font-size:15px;line-height:1.85;color:#5A5A6E;">
                  自己診断結果はサイト上で確認でき、${isSelfReport ? "自己分析レポート" : "完全版レポート"}はPDFで保存・印刷できます。どちらのリンクも、いつでも繰り返しご利用いただけます。
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 34px;background:#F3F2FF;border-radius:14px;">
                  <tr>
                    <td style="padding:28px 28px 26px;">
                      <h2 style="margin:0 0 14px;font-size:22px;font-weight:800;line-height:1.55;color:#2E2E5C;">ご購入内容</h2>
                      <p style="margin:0 0 4px;font-size:15px;font-weight:700;line-height:1.75;color:#2E2E5C;">${reportName}</p>
                      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#5A5A6E;">${purchasePrice}（税込・買い切り）</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        ${purchaseItems}
                      </table>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px;font-size:15px;line-height:1.85;color:#7A7A92;">
                  ※ 購入時点で診断がお済みでない場合は、診断完了後にこのメールのリンクを開いてください。あなたのタイプに合わせた内容へ更新されます。
                </p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.85;color:#5A5A6E;">
                  リンク・PDF・返金についてお困りの場合は、<a href="mailto:support@watashi-torisetsu.com" style="color:#5B5BEF;text-decoration:underline;">support@watashi-torisetsu.com</a> までご連絡ください。
                </p>
                <p style="margin:0;font-size:15px;line-height:1.85;color:#5A5A6E;">
                  それでは、あなただけのトリセツをお楽しみください。<br />
                  <strong style="color:#2E2E5C;">ワタシのトリセツ運営チーム</strong>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:22px 0 0;font-size:15px;line-height:1.7;color:#8A8AA3;">&copy; ${SITE_NAME}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderDetailedReportText(args: DetailedReportTemplateArgs): string {
  const greeting = args.greetingName
    ? `${args.greetingName}さん、こんにちは。`
    : "こんにちは。";
  const isSelfReport = args.product === "self_report";
  const isPremiumBundle = args.product === "premium_bundle";
  const hasUnmei = args.destinyFeaturesIncluded ?? isPremiumBundle;
  // 占い師チャットは設計図と独立 (完全版にも付く)。未指定は旧来どおり設計図に追従。
  const hasHoshiyomi = args.hoshiyomiChatIncluded ?? hasUnmei;
  const hoshiyomiChatCredits =
    args.hoshiyomiChatCredits ?? HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS;
  const hasTarot = args.tarotFeaturesIncluded ?? isPremiumBundle;
  const hasFriendFeatures = args.friendFeaturesIncluded ?? false;
  const showLineInvitation = !isSelfReport;
  const reportName = isSelfReport
    ? "ワタシのトリセツ 学生向けプラン"
    : isPremiumBundle
      ? "ワタシのトリセツ 全部入り"
      : "ワタシのトリセツ 性格レポート完全版";
  const purchaseItems = isSelfReport
    ? [
        "・自己診断結果のロックされた9セクションをすべて解放",
        "・16ページ以上の自己分析PDF",
        ...(hasFriendFeatures
          ? [
              "・2人目以降の友達診断結果もすべて解放",
              "・何度でも作り直せる友達診断分析PDF",
            ]
          : []),
      ]
    : [
        "・キャリア・成長の深掘り",
        "・友達ひとりずつの本音",
        "・シーン別の相性",
        ...(hasUnmei ? ["・あなた専用の運命の設計図"] : []),
        ...(hasHoshiyomi
          ? [`・あなたの専属占い師とのチャット${hoshiyomiChatCredits}回分`]
          : []),
        ...(hasTarot ? ["・Aliceのタロット占い3種類をすべて解放"] : []),
      ];
  const defaultPurchaseAmount = isSelfReport
    ? SELF_REPORT_PRICE_JPY
    : isPremiumBundle
      ? PREMIUM_BUNDLE_PRICE_JPY
      : FULL_ACCESS_PRICE_JPY;
  const purchasePrice = `¥${(
    args.purchaseAmountJpy ?? defaultPurchaseAmount
  ).toLocaleString("ja-JP")}`;
  return [
    greeting,
    "",
    "ご購入ありがとうございます。",
    `「${reportName}」のご用意ができました。`,
    `購入いただいた内容は、下のリンクからいつでもご覧いただけます。${showLineInvitation ? " また、LINEでAliceとのおしゃべりや毎日の占いを楽しめる「Alice Plus」も体験できます。" : ""}`,
    ...(showLineInvitation
      ? [
          "",
          "【LINEでAlice Plusを体験しよう】",
          "",
          "■ LINEでAlice Plusを体験する",
          LINE_ADD_FRIEND_URL,
        ]
      : []),
    "",
    "■ 解放された自己診断結果を見る",
    args.meUrl,
    "",
    `■ ${isSelfReport ? "自己分析PDF" : "完全版PDF"}をダウンロード`,
    args.pdfUrl,
    "",
    `自己診断結果はサイト上で確認でき、${isSelfReport ? "自己分析レポート" : "完全版レポート"}はPDFで保存・印刷できます。`,
    "どちらのリンクも、いつでも繰り返しご利用いただけます。",
    "",
    "【ご購入内容】",
    reportName,
    `${purchasePrice}（税込・買い切り）`,
    ...purchaseItems,
    "",
    "※ 購入時点で診断がお済みでない場合は、診断完了後にこのメールのリンクを開いてください。",
    "あなたのタイプに合わせた内容へ更新されます。",
    "",
    "リンク・PDF・返金についてお困りの場合は、support@watashi-torisetsu.com までご連絡ください。",
    "",
    "それでは、あなただけのトリセツをお楽しみください。",
    "",
    "--",
    `${SITE_NAME}運営チーム`,
  ].join("\n");
}

// export は /dev/email-preview 用
export function renderDetailedReportHtmlKo(
  args: DetailedReportTemplateArgs,
): string {
  const greeting = args.greetingName
    ? `${escapeHtml(args.greetingName)}님, 안녕하세요.`
    : "안녕하세요.";
  const isSelfReport = args.product === "self_report";
  const isPremiumBundle = args.product === "premium_bundle";
  const hasDestinyFeatures =
    args.destinyFeaturesIncluded ?? isPremiumBundle;
  const hasHoshiyomiChat = args.hoshiyomiChatIncluded ?? hasDestinyFeatures;
  const hoshiyomiChatCredits =
    args.hoshiyomiChatCredits ?? HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS;
  const hasTarot = args.tarotFeaturesIncluded ?? isPremiumBundle;
  const hasFriendFeatures = args.friendFeaturesIncluded ?? false;
  const heroImageUrl = `${SITE_URL}${
    isPremiumBundle
      ? "/mascot/unmei-hero.png"
      : isSelfReport
        ? "/checkout-fullaccess.png"
        : "/mascot/hoshiyomi-alice-writing-transparent.png"
  }`;
  const heroImageAlt = isSelfReport
    ? "자기 분석 리포트"
    : isPremiumBundle
      ? "프리미엄 리포트"
      : "점을 보는 Alice";
  const reportName = isSelfReport
    ? "나의 사용설명서 학생 플랜"
    : isPremiumBundle
      ? "나의 사용설명서 프리미엄 코스"
      : "나의 사용설명서 완전판 코스";
  const price =
    args.purchaseAmountMinor ??
    (isSelfReport
      ? SELF_REPORT_PRICE_KRW
      : isPremiumBundle
        ? PREMIUM_BUNDLE_PRICE_KRW
        : FULL_ACCESS_PRICE_KRW);
  const items = isSelfReport
    ? `✓ 자기 진단 결과의 잠긴 9개 섹션 전체 해제<br />✓ 16페이지 이상의 자기 분석 PDF${hasFriendFeatures ? "<br />✓ 두 번째 친구부터의 친구 진단 결과 전체 해제<br />✓ 몇 번이든 다시 만들 수 있는 친구 분석 PDF" : ""}`
    : `✓ 자기 진단 결과의 잠긴 9개 섹션 전체 해제<br />✓ 16페이지 이상의 자기 분석 완전판 PDF<br />✓ 두 번째 친구부터의 친구 진단 결과 전체 해제<br />✓ 친구가 늘 때마다 다시 만들 수 있는 친구 진단 PDF<br />✓ 연애 파트너 궁합 분석${hasDestinyFeatures ? `<br />✓ 한국어 운명의 설계도` : ""}${hasHoshiyomiChat ? `<br />✓ 나만의 전담 점성술사 채팅 ${hoshiyomiChatCredits}회` : ""}${hasTarot ? "<br />✓ Alice의 타로 세 종류 모두 해제" : ""}`;

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${reportName}</title>
  </head>
  <body style="margin:0;padding:0;background:#F3F3F7;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;color:#2E2E5C;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F3F3F7;"><tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background:#FFFFFF;border:1px solid #E4E4F0;border-radius:18px;overflow:hidden;"><tr><td style="padding:48px 46px 44px;">
        <p style="margin:0 0 22px;text-align:center;font-size:15px;font-weight:800;line-height:1.6;letter-spacing:0.08em;color:#2E2E5C;">${KO_SITE_NAME}</p>
        <p style="margin:0 0 36px;text-align:center;"><img src="${heroImageUrl}" width="420" alt="${heroImageAlt}" style="display:inline-block;width:420px;max-width:100%;height:auto;border:0;border-radius:14px;" /></p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#2E2E5C;">${greeting}</p>
        <p style="margin:0 0 30px;font-size:15px;line-height:1.9;color:#5A5A6E;">구매해 주셔서 감사합니다.<br />‘${reportName}’가 준비되었어요. 아래 버튼에서 언제든 다시 확인할 수 있어요.</p>
        <p style="margin:0 0 14px;"><a href="${args.meUrl}" style="display:block;padding:15px 18px;background:#5B5BEF;color:#FFFFFF;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:1.4;border-radius:999px;">잠금 해제된 상세 결과 보기&nbsp; &#8594;</a></p>
        <p style="margin:0 0 18px;"><a href="${args.pdfUrl}" style="display:block;padding:15px 18px;background:#2E2E5C;color:#FFFFFF;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:1.4;border-radius:999px;">자기 분석 완전판 PDF 다운로드&nbsp; &#8594;</a></p>
        ${hasDestinyFeatures && args.unmeiUrl ? `<p style="margin:0 0 18px;"><a href="${args.unmeiUrl}" style="display:block;padding:15px 18px;background:#9A6A24;color:#FFFFFF;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:1.4;border-radius:999px;">운명의 설계도 만들기&nbsp; &#8594;</a></p>` : ""}
        ${hasHoshiyomiChat && args.hoshiyomiUrl ? `<p style="margin:0 0 18px;"><a href="${args.hoshiyomiUrl}" style="display:block;padding:15px 18px;background:#5B5BEF;color:#FFFFFF;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:1.4;border-radius:999px;">나만의 전담 점성술사와 대화하기&nbsp; &#8594;</a></p>` : ""}
        <p style="margin:0 0 30px;font-size:15px;line-height:1.85;color:#5A5A6E;">상세 결과는 웹에서 확인하고, 완전판 리포트는 PDF로 저장하거나 인쇄할 수 있어요. 두 링크 모두 언제든 다시 이용할 수 있어요.</p>
        <div style="margin:0 0 30px;padding:26px 28px;background:#F3F2FF;border-radius:14px;">
          <h2 style="margin:0 0 12px;font-size:21px;font-weight:800;line-height:1.5;color:#2E2E5C;">구매 내용</h2>
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;line-height:1.75;color:#2E2E5C;">${reportName}</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#5A5A6E;">₩${price.toLocaleString("ko-KR")} · 1회 결제</p>
          <p style="margin:0;font-size:15px;line-height:1.9;color:#5A5A6E;">${items}</p>
        </div>
        <div style="margin:0 0 30px;padding:24px 26px;background:#FFF9EC;border:1px solid #F0DFC0;border-radius:14px;">
          <h2 style="margin:0 0 12px;font-size:19px;font-weight:800;line-height:1.5;color:#2E2E5C;">계약·환불 정보</h2>
          <p style="margin:0;font-size:14px;line-height:1.9;color:#5A5A6E;"><strong>판매자:</strong> 후타미 류노스케(나의 사용설명서 운영팀) · 일본<br /><strong>제공 시기:</strong> 결제 확인 후 즉시 잠금 해제 및 디지털 콘텐츠 제공<br /><strong>환불:</strong> 결제일로부터 30일 이내 전액 환불 요청 가능<br /><strong>신청 방법:</strong> 결제 이메일, 결제일과 상품명을 적어 support@watashi-torisetsu.com으로 요청<br /><strong>처리 일정:</strong> 유효한 요청 확인 후 3영업일 이내 환불 절차 시작. 결제 수단 반영은 카드사·결제 회사 일정에 따라 더 걸릴 수 있음<br /><strong>미성년자:</strong> 법정대리인 동의 없이 체결한 계약은 관련 법령에 따라 본인 또는 법정대리인이 취소할 수 있음</p>
        </div>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.85;color:#7A7A92;">결제할 때 아직 진단을 완료하지 않았다면 진단을 마친 뒤 이 메일의 링크를 다시 열어 주세요. 내 유형에 맞는 내용으로 표시됩니다.</p>
        <p style="margin:0 0 18px;font-size:13px;line-height:1.85;color:#7A7A92;"><a href="${SITE_URL}/ko/terms" style="color:#5B5BEF;text-decoration:underline;">이용약관</a>&nbsp; · &nbsp;<a href="${SITE_URL}/ko/privacy" style="color:#5B5BEF;text-decoration:underline;">개인정보처리방침</a>&nbsp; · &nbsp;<a href="${SITE_URL}/ko/legal/commerce" style="color:#5B5BEF;text-decoration:underline;">판매 및 환불 안내</a></p>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.85;color:#5A5A6E;">결과 링크, PDF 또는 환불과 관련해 도움이 필요하면 <a href="mailto:support@watashi-torisetsu.com" style="color:#5B5BEF;text-decoration:underline;">support@watashi-torisetsu.com</a>으로 연락해 주세요.</p>
        <p style="margin:0;font-size:15px;line-height:1.85;color:#5A5A6E;">나만의 사용설명서를 천천히 확인해 보세요.<br /><strong style="color:#2E2E5C;">나의 사용설명서 운영팀</strong></p>
      </td></tr></table>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#8A8AA3;">&copy; ${KO_SITE_NAME}</p>
    </td></tr></table>
  </body>
</html>`;
}

function renderDetailedReportTextKo(
  args: DetailedReportTemplateArgs,
): string {
  const greeting = args.greetingName
    ? `${args.greetingName}님, 안녕하세요.`
    : "안녕하세요.";
  const isSelfReport = args.product === "self_report";
  const isPremiumBundle = args.product === "premium_bundle";
  const hasDestinyFeatures =
    args.destinyFeaturesIncluded ?? isPremiumBundle;
  const hasHoshiyomiChat = args.hoshiyomiChatIncluded ?? hasDestinyFeatures;
  const hoshiyomiChatCredits =
    args.hoshiyomiChatCredits ?? HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS;
  const hasTarot = args.tarotFeaturesIncluded ?? isPremiumBundle;
  const hasFriendFeatures = args.friendFeaturesIncluded ?? false;
  const reportName = isSelfReport
    ? "나의 사용설명서 학생 플랜"
    : isPremiumBundle
      ? "나의 사용설명서 프리미엄 코스"
      : "나의 사용설명서 완전판 코스";
  const price =
    args.purchaseAmountMinor ??
    (isSelfReport
      ? SELF_REPORT_PRICE_KRW
      : isPremiumBundle
        ? PREMIUM_BUNDLE_PRICE_KRW
        : FULL_ACCESS_PRICE_KRW);
  const items = isSelfReport
    ? [
        "・자기 진단 결과의 잠긴 9개 섹션 전체 해제",
        "・16페이지 이상의 자기 분석 PDF",
        ...(hasFriendFeatures
          ? [
              "・두 번째 친구부터의 친구 진단 결과 전체 해제",
              "・몇 번이든 다시 만들 수 있는 친구 분석 PDF",
            ]
          : []),
      ]
    : [
        "・자기 진단 결과의 잠긴 9개 섹션 전체 해제",
        "・16페이지 이상의 자기 분석 완전판 PDF",
        "・두 번째 친구부터의 친구 진단 결과 전체 해제",
        "・친구가 늘 때마다 다시 만들 수 있는 친구 진단 PDF",
        "・연애 파트너 궁합 분석",
        ...(hasDestinyFeatures ? ["・한국어 운명의 설계도"] : []),
        ...(hasHoshiyomiChat
          ? [`・나만의 전담 점성술사 채팅 ${hoshiyomiChatCredits}회`]
          : []),
        ...(hasTarot ? ["・Alice의 타로 세 종류 모두 해제"] : []),
      ];
  return [
    greeting,
    "",
    "구매해 주셔서 감사합니다.",
    `‘${reportName}’가 준비되었어요.`,
    "",
    "■ 잠금 해제된 상세 결과 보기",
    args.meUrl,
    "",
    "■ 자기 분석 완전판 PDF 다운로드",
    args.pdfUrl,
    ...(hasDestinyFeatures && args.unmeiUrl
      ? ["", "■ 운명의 설계도 만들기", args.unmeiUrl]
      : []),
    ...(hasHoshiyomiChat && args.hoshiyomiUrl
      ? ["", "■ 나만의 전담 점성술사와 대화하기", args.hoshiyomiUrl]
      : []),
    "",
    "상세 결과는 웹에서 확인하고, 완전판 리포트는 PDF로 저장하거나 인쇄할 수 있어요.",
    "두 링크 모두 언제든 다시 이용할 수 있어요.",
    "",
    "【구매 내용】",
    reportName,
    `₩${price.toLocaleString("ko-KR")} · 1회 결제`,
    ...items,
    "",
    "【계약·환불 정보】",
    "판매자: 후타미 류노스케(나의 사용설명서 운영팀) · 일본",
    "제공 시기: 결제 확인 후 즉시 잠금 해제 및 디지털 콘텐츠 제공",
    "환불: 결제일로부터 30일 이내 전액 환불 요청 가능",
    "신청 방법: 결제 이메일, 결제일과 상품명을 적어 support@watashi-torisetsu.com으로 요청",
    "처리 일정: 유효한 요청 확인 후 3영업일 이내 환불 절차 시작. 결제 수단 반영은 카드사·결제 회사 일정에 따라 더 걸릴 수 있음",
    "미성년자: 법정대리인 동의 없이 체결한 계약은 관련 법령에 따라 본인 또는 법정대리인이 취소할 수 있음",
    "",
    "결제할 때 아직 진단을 완료하지 않았다면 진단을 마친 뒤 링크를 다시 열어 주세요.",
    "",
    `이용약관: ${SITE_URL}/ko/terms`,
    `개인정보처리방침: ${SITE_URL}/ko/privacy`,
    `판매 및 환불 안내: ${SITE_URL}/ko/legal/commerce`,
    "",
    "도움이 필요하면 support@watashi-torisetsu.com으로 연락해 주세요.",
    "",
    "--",
    "나의 사용설명서 운영팀",
  ].join("\n");
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
