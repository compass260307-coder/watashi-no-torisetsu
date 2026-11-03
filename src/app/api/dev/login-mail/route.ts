import { NextRequest, NextResponse } from "next/server";
import { isLoginMailPreview, previewMails, getPreviewMail, consumePreviewLink, PREVIEW_RESULT } from "@/lib/login-mail-preview";
import { renderLoginEmailHtml } from "@/lib/login-email";
import { requestOrigin } from "@/lib/request-origin";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!isLoginMailPreview(request)) return new NextResponse(null, { status: 404 });
  const link = request.nextUrl.searchParams.get("link");
  if (link) return NextResponse.redirect(new URL(consumePreviewLink(link) ? PREVIEW_RESULT : "/login?login_error=invalid_or_expired", requestOrigin(request)));
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const mail = getPreviewMail(id);
    if (!mail) return new NextResponse(null, { status: 404 });
    const dest = mail.kind === "welcome" ? "/diagnosis" : `/api/dev/login-mail?link=${mail.token}`;
    const html = renderLoginEmailHtml(new URL(dest, requestOrigin(request)).href, "ja", { kind: mail.kind, code: mail.code ?? undefined });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  return NextResponse.json({ mails: previewMails() }, { headers: { "Cache-Control": "no-store" } });
}
