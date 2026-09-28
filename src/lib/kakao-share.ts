import { withRef } from "./acquisition-link";
import { KO_DEFAULT_OG_IMAGE_PATH } from "./og-images";

type KakaoTextShareArgs = {
  objectType: "text";
  text: string;
  link: {
    mobileWebUrl: string;
    webUrl: string;
  };
  buttonTitle?: string;
};

type KakaoFeedShareArgs = {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: KakaoTextShareArgs["link"];
  };
  buttons: { title: string; link: KakaoTextShareArgs["link"] }[];
};

type KakaoGlobal = {
  init?: (javascriptKey: string) => void;
  isInitialized?: () => boolean;
  Share?: {
    sendDefault?: (args: KakaoTextShareArgs | KakaoFeedShareArgs) => void;
  };
};

// `kakao` means the SDK was invoked, not that a message was delivered.
export type KakaoShareResult = "kakao" | "native" | "copy" | "cancelled" | "unavailable";

export const KO_FRIEND_INVITE_TEXT =
  "네가 보는 나는 어떤 사람인지 궁금해! 30개의 질문에 답하고, 내가 보는 나와 비교해 줘.";

export function kakaoShareFeedback(result: KakaoShareResult): string {
  switch (result) {
    case "kakao": return "카카오톡에서 친구를 선택해 보내 주세요.";
    case "native": return "공유 메뉴로 전달했어요. 선택한 앱에서 전송을 확인해 주세요.";
    case "copy": return "링크를 복사했어요. 카카오톡에서 친구에게 붙여 넣어 주세요.";
    case "cancelled": return "";
    case "unavailable": return "공유를 열지 못했어요. 링크 복사나 QR 코드를 이용해 주세요.";
  }
}

export function kakaoShareMetadata(result: KakaoShareResult) {
  return {
    requested_channel: "kakao",
    share_method: result,
    share_status: result === "kakao" ? "requested" : result === "copy" ? "copied" : result,
  };
}

export const KAKAO_SDK_SCRIPT_ID = "kakao-javascript-sdk";
export const KAKAO_SDK_SRC =
  "https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js";
export const KAKAO_SDK_INTEGRITY =
  "sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy";

let kakaoSdkLoadPromise: Promise<KakaoGlobal | null> | null = null;

function getKakao(): KakaoGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Kakao?: KakaoGlobal }).Kakao ?? null;
}

function getJavascriptKey(): string {
  return process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY?.trim() ?? "";
}

export function initializeKakaoSdk(
  javascriptKey = getJavascriptKey(),
): KakaoGlobal | null {
  if (!javascriptKey) return null;

  const kakao = getKakao();
  if (!kakao?.init || !kakao.isInitialized) return null;

  try {
    if (!kakao.isInitialized()) {
      kakao.init(javascriptKey);
    }

    return kakao.isInitialized() ? kakao : null;
  } catch {
    return null;
  }
}

function ensureKakaoSdk(): Promise<KakaoGlobal | null> {
  const initialized = initializeKakaoSdk();
  if (initialized) return Promise.resolve(initialized);
  if (typeof document === "undefined" || !getJavascriptKey()) {
    return Promise.resolve(null);
  }
  if (kakaoSdkLoadPromise) return kakaoSdkLoadPromise;

  const loadPromise = new Promise<KakaoGlobal | null>((resolve) => {
    let settled = false;
    let timeoutId = 0;
    const settle = (kakao: KakaoGlobal | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(kakao);
    };
    const finish = () => settle(initializeKakaoSdk());
    const fail = () => settle(null);
    const existing = document.getElementById(
      KAKAO_SDK_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    timeoutId = window.setTimeout(fail, 8000);

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      window.setTimeout(() => {
        const kakao = initializeKakaoSdk();
        if (kakao) settle(kakao);
      }, 0);
      return;
    }

    const script = document.createElement("script");
    script.id = KAKAO_SDK_SCRIPT_ID;
    script.src = KAKAO_SDK_SRC;
    script.integrity = KAKAO_SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  });
  const cachedPromise = loadPromise.then((kakao) => {
    if (!kakao) kakaoSdkLoadPromise = null;
    return kakao;
  });
  kakaoSdkLoadPromise = cachedPromise;

  return cachedPromise;
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
  buttonTitle = "자세히 보기",
}: {
  text: string;
  url: string;
  fallbackCopy?: (url: string) => boolean | Promise<boolean>;
  buttonTitle?: string;
}): Promise<KakaoShareResult> {
  const shareText = text.trim() || url;
  // Invoke share APIs in the click handler's call stack. Waiting for a network
  // load here can lose the user activation required by mobile sharing/popups.
  // The Korean layout preloads the SDK; a cold click gets an immediate fallback.
  const kakao = initializeKakaoSdk();
  if (!kakao) void ensureKakaoSdk();

  if (kakao?.Share?.sendDefault && kakao.isInitialized?.()) {
    try {
      const link = { mobileWebUrl: url, webUrl: url };
      const parsedUrl = new URL(url);
      const isFriendInvite = /^\/ko\/friend\/[^/]+\/?$/.test(parsedUrl.pathname);
      kakao.Share.sendDefault(isFriendInvite ? {
        objectType: "feed",
        content: {
          title: "친구인 네가 보는 나는?",
          description: shareText,
          imageUrl: new URL(KO_DEFAULT_OG_IMAGE_PATH, parsedUrl.origin).toString(),
          link,
        },
        buttons: [{ title: "친구 진단 시작하기", link }],
      } : {
        objectType: "text",
        text: shareText,
        buttonTitle,
        link,
      });
      return "kakao";
    } catch {
      // SDK が読めていても未登録ドメイン等で失敗することがあるため、下の経路へ落とす。
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const nativeUrl = withRef(url, "native");
      await navigator.share({ text: shareText.replaceAll(url, nativeUrl), url: nativeUrl });
      return "native";
    } catch (error) {
      if (isAbortError(error)) return "cancelled";
    }
  }

  if (fallbackCopy) {
    try {
      return (await fallbackCopy(withRef(url, "copy"))) ? "copy" : "unavailable";
    } catch {
      return "unavailable";
    }
  }

  return "unavailable";
}
