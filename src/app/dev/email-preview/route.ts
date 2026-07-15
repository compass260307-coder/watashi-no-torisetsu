import { renderDetailedReportHtml } from "@/lib/email";

/**
 * 購入完了メールのローカル確認用プレビュー。
 * 本番では内容を返さず、メール送信や実ユーザーデータにも触れない。
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const token = "EXAMPLE_TOKEN";

  return new Response(
    renderDetailedReportHtml({
      reportUrl: `${origin}/report/${token}`,
      pdfUrl: `${origin}/report/${token}/pdf`,
      meUrl: `${origin}/me/${token}`,
      greetingName: "わかん",
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
