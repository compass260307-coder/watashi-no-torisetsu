type KakaoTextShareArgs = {
  objectType: "text";
  text: string;
  link: {
    mobileWebUrl: string;
    webUrl: string;
  };
};

type KakaoGlobal = {
  isInitialized?: () => boolean;
  Share?: {
    sendDefault?: (args: KakaoTextShareArgs) => void;
  };
};

export type KakaoShareResult = "kakao" | "native" | "copy" | "unavailable";

function getKakao(): KakaoGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Kakao?: KakaoGlobal }).Kakao ?? null;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

export async function shareToKakaoTalk({
  text,
  url,
  fallbackCopy,
}: {
  text: string;
  url: string;
  fallbackCopy?: () => boolean | Promise<boolean>;
}): Promise<KakaoShareResult> {
  const shareText = text.trim() || url;
  const kakao = getKakao();

  if (kakao?.Share?.sendDefault && kakao.isInitialized?.()) {
    try {
      kakao.Share.sendDefault({
        objectType: "text",
        text: shareText,
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      });
      return "kakao";
    } catch {
      // SDK が読めていても未登録ドメイン等で失敗することがあるため、下の経路へ落とす。
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text: shareText, url });
      return "native";
    } catch (error) {
      if (isAbortError(error)) return "unavailable";
    }
  }

  if (fallbackCopy) {
    return (await fallbackCopy()) ? "copy" : "unavailable";
  }

  return "unavailable";
}
