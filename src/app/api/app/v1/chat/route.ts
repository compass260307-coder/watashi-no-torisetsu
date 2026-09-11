export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The native Alice app is not being released. Keep this endpoint as a hard
 * stop so neither production nor development requests can reach AI Gateway.
 */
export function POST() {
  return Response.json(
    {
      code: "app_chat_retired",
      message: "アプリ版の対話機能は提供していません。",
      retryable: false,
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
