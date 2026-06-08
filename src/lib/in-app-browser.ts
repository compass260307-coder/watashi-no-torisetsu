// SNS アプリ内ブラウザ (WebView) 判定。
//
// 目的: LINE / Instagram / Facebook / X(Twitter) / TikTok などのアプリ内ブラウザだと
// localStorage が分離・破棄されやすく、診断結果が保存されない/エラーになることがある。
// 検出して Safari/Chrome での利用を促すモーダルを出すために使う。
//
// 判定は UA 文字列のアプリ固有トークンの部分一致 (各アプリが実際に付与する大文字小文字)。

export type InAppBrowser = "LINE" | "Instagram" | "Facebook" | "X" | "TikTok";

/**
 * UA から SNS アプリ内ブラウザを判定する。該当なし (通常の Safari/Chrome 等) は null。
 * SSR でも安全に呼べるよう ua は引数で受け取る (呼び出し側で navigator.userAgent を渡す)。
 */
export function detectInAppBrowser(
  ua: string | undefined | null,
): InAppBrowser | null {
  if (!ua) return null;

  // LINE: "...Line/12.0.0" のように "Line/" を含む
  if (ua.includes("Line/")) return "LINE";

  // Instagram: UA に "Instagram" を含む
  if (ua.includes("Instagram")) return "Instagram";

  // Facebook / Messenger: "FBAN" / "FBAV" / "FB_IAB"
  if (ua.includes("FBAN") || ua.includes("FBAV") || ua.includes("FB_IAB")) {
    return "Facebook";
  }

  // TikTok: "BytedanceWebview" / "musical_ly" / "TikTok"
  if (
    ua.includes("BytedanceWebview") ||
    ua.includes("musical_ly") ||
    ua.includes("TikTok")
  ) {
    return "TikTok";
  }

  // X / Twitter: in-app WebView の UA は "Twitter" トークンを含む
  if (ua.includes("Twitter")) return "X";

  return null;
}
