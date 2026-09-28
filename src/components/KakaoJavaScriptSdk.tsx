"use client";

import Script from "next/script";
import {
  initializeKakaoSdk,
  KAKAO_SDK_INTEGRITY,
  KAKAO_SDK_SCRIPT_ID,
  KAKAO_SDK_SRC,
} from "@/lib/kakao-share";

export function KakaoJavaScriptSdk() {
  const javascriptKey =
    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY?.trim() ?? "";

  if (!javascriptKey) return null;

  return (
    <Script
      id={KAKAO_SDK_SCRIPT_ID}
      src={KAKAO_SDK_SRC}
      integrity={KAKAO_SDK_INTEGRITY}
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onReady={() => {
        initializeKakaoSdk(javascriptKey);
      }}
    />
  );
}
