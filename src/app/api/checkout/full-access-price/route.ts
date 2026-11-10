import { NextRequest, NextResponse } from "next/server";
import { isSafeOpaqueToken, readJsonObject } from "@/lib/api-security";
import { hasSelfReportAccess } from "@/lib/entitlements";
import { fullAccessQuoteForMarket } from "@/lib/full-access-pricing";
import { fullAccessMarketForRequest, resolveFullAccessBuyer } from "@/lib/full-access-checkout-server";
import { checkOrigin } from "@/lib/origin-check";

const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function POST(request: NextRequest) {
  const origin = checkOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: origin.error }, { ...noStore, status: 403 });

  const body = await readJsonObject(request, 512);
  if (!body.ok) return NextResponse.json({ error: body.error }, { ...noStore, status: body.status });

  const ownerToken = body.value.owner_token ?? "";
  if (ownerToken !== "" && !isSafeOpaqueToken(ownerToken)) {
    return NextResponse.json({ error: "Invalid owner token" }, { ...noStore, status: 400 });
  }

  const market = fullAccessMarketForRequest(request);
  let koreanSelfReport = false;
  if (market === "ko" && body.value.locale === "ko") {
    try {
      const buyer = await resolveFullAccessBuyer(request, ownerToken);
      koreanSelfReport = buyer ? await hasSelfReportAccess(buyer.id) : false;
    } catch {
      return NextResponse.json({ error: "Price temporarily unavailable" }, { ...noStore, status: 503 });
    }
  }
  return NextResponse.json(fullAccessQuoteForMarket(market, koreanSelfReport), noStore);
}
