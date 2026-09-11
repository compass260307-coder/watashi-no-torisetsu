import { GET as generatePdf } from "@/app/report/[token]/pdf/route";

export const maxDuration = 60;
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  url.searchParams.set("locale", "en");
  return generatePdf(new Request(url, request), context);
}
