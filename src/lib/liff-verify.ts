// LIFF ID トークンを LINE Verify API で検証する共通ヘルパー。
// 我々が発行している LIFF アプリの LINE Login Channel ID 一覧 (env から動的収集)
// で順次 verify を試みて、最初に通ったものを受理する。

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

const LIFF_CHANNEL_IDS = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_LIFF_ID,
      process.env.NEXT_PUBLIC_LIFF_ID_SHARE,
      process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT,
    ]
      .filter((id): id is string => Boolean(id))
      .map((id) => id.split("-")[0]),
  ),
);

export type LiffVerifiedClaims = {
  sub: string;
};

export async function verifyLiffIdToken(
  idToken: string,
): Promise<LiffVerifiedClaims | null> {
  if (LIFF_CHANNEL_IDS.length === 0) {
    console.error("[liff-verify] no LIFF channel IDs configured");
    return null;
  }
  for (const channelId of LIFF_CHANNEL_IDS) {
    try {
      const res = await fetch(LINE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          id_token: idToken,
          client_id: channelId,
        }).toString(),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { sub?: unknown };
      if (typeof data.sub === "string" && data.sub.length > 0) {
        return { sub: data.sub };
      }
    } catch (err) {
      console.warn(
        "[liff-verify] error for channel",
        channelId,
        String(err),
      );
    }
  }
  return null;
}

// Authorization: Bearer <id_token> ヘッダーから verify 済 sub を取り出す。
// 失敗時は null。
export async function verifyBearer(
  request: Request,
): Promise<LiffVerifiedClaims | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) return null;
  return verifyLiffIdToken(idToken);
}
