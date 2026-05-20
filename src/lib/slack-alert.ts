// 失敗時 Slack 通知ヘルパー (任意)
// SLACK_WEBHOOK_URL が未設定なら console.error にフォールバック。
// MVP 段階: 自動返金は無し、運営者が Slack で気づいて手動対応する想定。

export async function sendSlackAlert(
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    // フォールバック: server logs に残す
    console.error("[slack-alert]", message, context ?? "");
    return;
  }
  try {
    const body = {
      text: message,
      attachments:
        context && Object.keys(context).length > 0
          ? [
              {
                color: "#cc0033",
                text: "```\n" + JSON.stringify(context, null, 2) + "\n```",
                mrkdwn_in: ["text"],
              },
            ]
          : undefined,
    };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[slack-alert] post failed:", err, message);
  }
}
