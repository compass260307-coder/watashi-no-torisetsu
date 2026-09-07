import "server-only";

import { redirect } from "next/navigation";
import { hasTarotAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";

/**
 * タロットページを購入済みユーザーだけに限定する。
 * 未購入は自分の結果ページ（未診断はトップ）へ戻し、
 * BottomNav にタロット用の課金モーダルを開かせる。
 */
export async function requireTarotAccess(locale: "ja" | "ko") {
  const session = await getSession();
  const purchased = session?.id ? await hasTarotAccess(session.id) : false;
  if (purchased) return;

  const localePrefix = locale === "ko" ? "/ko" : "";
  const returnPath = session?.owner_token
    ? `${localePrefix}/me/${encodeURIComponent(session.owner_token)}`
    : localePrefix || "/";
  redirect(`${returnPath}#unlock-tarot`);
}
