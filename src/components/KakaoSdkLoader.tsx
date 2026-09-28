"use client";

import Script from "next/script";

const KAKAO_SDK_VERSION = "2.8.1";
const KAKAO_SDK_INTEGRITY =
  "sha384-OL+ylM/iuPLtW5U3XcvLSGhE8JzReKDank5InqlHGWPhb4140/yrBw0bg0y7+C9J";
const KAKAO_SDK_SRC = `https://t1.kakaocdn.net/kakao_js_sdk/${KAKAO_SDK_VERSION}/kakao.min.js`;

type KakaoGlobal = {
  init?: (key: string) => void;
  isInitialized?: () => boolean;
};

function getKakao(): KakaoGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Kakao?: KakaoGlobal }).Kakao ?? null;
}

export function KakaoSdkLoader() {
  const javascriptKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;

  if (!javascriptKey) return null;

  return (
    <Script
      id="kakao-javascript-sdk"
      src={KAKAO_SDK_SRC}
      strategy="afterInteractive"
      integrity={KAKAO_SDK_INTEGRITY}
      crossOrigin="anonymous"
      onLoad={() => {
        const kakao = getKakao();
        if (!kakao?.init || kakao.isInitialized?.()) return;
        kakao.init(javascriptKey);
      }}
    />
  );
}
