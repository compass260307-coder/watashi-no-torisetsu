import { NextResponse } from "next/server";

export async function GET() {
  const adminKey = process.env.ADMIN_KEY;
  return NextResponse.json({
    hasAdminKey: !!adminKey,
    length: adminKey?.length ?? 0,
    firstTwo: adminKey?.slice(0, 2) ?? "",
    lastTwo: adminKey?.slice(-2) ?? "",
  });
}
