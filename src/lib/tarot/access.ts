import "server-only";

import { redirect } from "next/navigation";
import { hasTarotAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";

export type TarotAccessState = Readonly<{
  purchased: boolean;
  ownerToken: string | null;
}>;

export async function getTarotAccessState(): Promise<TarotAccessState> {
  const session = await getSession();
  return {
    purchased: session?.id ? await hasTarotAccess(session.id) : false,
    ownerToken: session?.owner_token ?? null,
  };
}

export function redirectToTarotPaywall(
  locale: "ja" | "ko" | "en" | "id",
  ownerToken: string | null,
): never {
  const localePrefix =
    locale === "ko"
      ? "/ko"
      : locale === "en"
        ? "/en"
        : locale === "id"
          ? "/id"
          : "";
  const returnPath = ownerToken
    ? `${localePrefix}/me/${encodeURIComponent(ownerToken)}`
    : localePrefix || "/";
  redirect(`${returnPath}#unlock-tarot`);
}

/**
 * タロットページを購入済みユーザーだけに限定する。
 * 未購入は自分の結果ページ（未診断はトップ）へ戻し、
 * BottomNav にタロット用の課金モーダルを開かせる。
 */
export async function requireTarotAccess(locale: "ja" | "ko" | "en" | "id") {
  const access = await getTarotAccessState();
  if (access.purchased) return;
  redirectToTarotPaywall(locale, access.ownerToken);
}
