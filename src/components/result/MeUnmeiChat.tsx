"use client";

import UnmeiClient from "@/components/uranai/UnmeiClient";
import type { AppResultLocale } from "@/i18n/result";
import {
  ME_UNMEI_CHAT_INTRO_EN,
  ME_UNMEI_CHAT_INTRO_ID,
  ME_UNMEI_CHAT_INTRO_JA,
  ME_UNMEI_CHAT_INTRO_KO,
} from "@/i18n/unmei";

/** Loaded by MeUnmeiChatLauncher only after opening the optional chat. */
export function MeUnmeiChat({
  ownerToken,
  product,
  locale,
  previewMode,
  onReady,
}: {
  ownerToken: string | null;
  product: "full_access" | "premium_bundle";
  locale: AppResultLocale;
  previewMode: boolean;
  onReady: () => void;
}) {
  return (
    <UnmeiClient
      initialState="no_birth"
      purchase={{ ownerToken, product }}
      locale={locale}
      previewMode={previewMode}
      intro={
        locale === "id"
          ? ME_UNMEI_CHAT_INTRO_ID
          : locale === "en"
            ? ME_UNMEI_CHAT_INTRO_EN
            : locale === "ko"
              ? ME_UNMEI_CHAT_INTRO_KO
              : ME_UNMEI_CHAT_INTRO_JA
      }
      hideHeaderStars
      onReady={onReady}
    />
  );
}
