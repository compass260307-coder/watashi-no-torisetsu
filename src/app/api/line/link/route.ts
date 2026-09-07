// LIFFからのLINE連携API。IDトークンをLINE公式verify endpointで検証してから、
// URLトークンに紐づく診断ユーザーとLINE userIdを連携する。

import { NextRequest, NextResponse } from "next/server";

import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { quickReplies, pushLineMessages } from "@/lib/line";
import { lineAliceChatEnabled } from "@/lib/line-alice";
import { recordLineEvent } from "@/lib/line-events";
import {
  consumeLineLinkCode,
  lineLinkSuccessMessage,
} from "@/lib/line-linking";
import { checkOrigin } from "@/lib/origin-check";

export const runtime = "nodejs";

type LineIdTokenClaims = {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const origin = checkOrigin(request);
  if (!origin.ok) {
    return json(
      { error: "forbidden_origin", message: "この画面からは連携できません。" },
      403,
    );
  }

  const loginChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!loginChannelId) {
    return json(
      {
        error: "not_configured",
        message: "LINE連携は現在準備中です。少し時間をおいてお試しください。",
      },
      503,
    );
  }

  const parsed = await readJsonObject(request, 8 * 1024);
  if (!parsed.ok) {
    return json(
      { error: "invalid_body", message: "送信内容を確認できませんでした。" },
      parsed.status,
    );
  }
  const code = parsed.value.code;
  const idToken = parsed.value.idToken;
  const force = parsed.value.force === true;
  if (
    typeof code !== "string" ||
    !/^[A-Za-z0-9_-]{32}$/.test(code) ||
    typeof idToken !== "string" ||
    idToken.length < 32 ||
    idToken.length > 4096
  ) {
    return json(
      { error: "invalid_request", message: "連携情報が正しくありません。" },
      400,
    );
  }

  const rateLimit = await consumeRateLimit(request, {
    scope: "line-liff-link-ip",
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return json(
      {
        error: "rate_limited",
        message: "試行回数が多いようです。しばらく時間をおいてお試しください。",
      },
      429,
    );
  }

  const verifyBody = new URLSearchParams({
    id_token: idToken,
    client_id: loginChannelId,
  });
  let verifyResponse: Response;
  try {
    verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[line/link] LINE ID token verification failed", error);
    return json(
      {
        error: "line_verify_failed",
        message: "LINEで本人確認ができませんでした。もう一度お試しください。",
      },
      503,
    );
  }
  const claims = (await verifyResponse.json().catch(() => ({}))) as LineIdTokenClaims;
  const lineUserId = claims.sub;
  if (
    !verifyResponse.ok ||
    claims.iss !== "https://access.line.me" ||
    claims.aud !== loginChannelId ||
    typeof claims.exp !== "number" ||
    claims.exp <= Math.floor(Date.now() / 1000) ||
    typeof lineUserId !== "string" ||
    !/^U[0-9a-f]{32}$/i.test(lineUserId)
  ) {
    return json(
      {
        error: "invalid_id_token",
        message: "LINEのログイン情報を確認できませんでした。もう一度お試しください。",
      },
      401,
    );
  }

  const result = await consumeLineLinkCode({
    code,
    kind: "liff",
    lineUserId,
    force,
    source: "liff",
  });

  if (result.status === "conflict") {
    return json(
      {
        error: "already_linked_to_another_user",
        message:
          "このLINEは別の診断結果と連携済みです。新しい診断結果へ切り替えますか？",
        currentLink: result.currentLink,
      },
      409,
    );
  }
  if (result.status === "not_found") {
    return json(
      { error: "code_not_found", message: "連携情報が見つかりませんでした。" },
      404,
    );
  }
  if (result.status === "expired") {
    return json(
      {
        error: "code_expired",
        message: "連携の有効期限が切れました。結果ページからもう一度お試しください。",
      },
      410,
    );
  }
  if (result.status === "used") {
    return json(
      {
        error: "code_used",
        message: "この連携情報はすでに使用されています。",
      },
      409,
    );
  }
  if (result.status === "error" || !result.user) {
    return json(
      {
        error: "link_failed",
        message: "連携がうまくいきませんでした。少し時間をおいてお試しください。",
      },
      503,
    );
  }

  const newlyLinked = result.status === "linked";
  if (newlyLinked) {
    await recordLineEvent({
      eventName: "line_link_completed",
      metadata: {
        kind: "liff",
        switched: result.switched,
      },
      ownerToken: result.user.ownerToken,
    });

    const chatEnabled = lineAliceChatEnabled();
    await pushLineMessages(lineUserId, [
      {
        type: "text",
        text: lineLinkSuccessMessage({
          displayName: result.user.displayName,
          switched: result.switched,
          chatEnabled,
        }),
        ...(chatEnabled
          ? { quickReply: quickReplies("今日の占い", "診断結果") }
          : {}),
      },
    ]);
  }

  return json({
    linked: true,
    switched: result.switched,
    alreadyLinked: result.status === "already_linked",
  });
}
