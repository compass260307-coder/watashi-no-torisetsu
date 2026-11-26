// エラー画面が出た回数の記録 (event_name = "error_screen_shown")。
//
// 何を残すか:
// - kind: どの画面か
// - page: URL の最初の区切りだけ ("/me" "/tako" "/diagnosis" など)。結果ページの URL には本人だけが
//   知る鍵が入っているので、URL 全体は残さない
// - そのほか、画面ごとの補足 (chunk / digest / error_name / has_result)。エラーの本文は残さない
//   (入力内容などが混ざるおそれがあるため)
//
// 送り方は trackViaApi (lib/track.ts の説明を参照)。件数の少ない記録なので、1件ずつ API へ送る。

import { trackViaApi } from "@/lib/track";

export type ErrorScreenKind =
  | "error" // 通常のエラー画面 (app/error.tsx)
  | "global_error" // 最上位のエラー画面 (app/global-error.tsx)
  | "not_found" // 404
  | "result_not_found" // 結果ページ・友達診断ページの URL で該当する結果が無い
  | "purchase_unverified" // 購入を確認できなかった (/purchase-complete)
  | "paid_unlock_timeout"; // 購入後、約60秒たっても反映されなかった

const LOCALES = new Set(["ko", "en", "id"]);

/** URL の最初の区切りだけを返す (言語の区切りは飛ばす)。例: /ko/me/xxxx → "/me"、/ → "/"。 */
export function pageGroup(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const first = LOCALES.has(parts[0] ?? "") ? parts[1] : parts[0];
  if (!first) return "/";
  // 想定外に長い・記号の多い区切り (でたらめな URL) は、そのまま残さない。
  return /^[a-z0-9-]{1,30}$/.test(first) ? `/${first}` : "/other";
}

export function reportErrorScreen(
  kind: ErrorScreenKind,
  extra: Record<string, string | number | boolean | null> = {},
) {
  try {
    trackViaApi("error_screen_shown", {
      kind,
      page: pageGroup(window.location.pathname),
      ...extra,
    });
  } catch {
    // 記録の失敗で画面を止めない
  }
}
