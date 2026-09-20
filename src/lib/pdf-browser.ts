import "server-only";

import puppeteer from "puppeteer-core";

type LaunchOptions = Parameters<typeof puppeteer.launch>[0];

const EXECUTABLE_BUSY_RETRY_DELAYS_MS = [150, 450] as const;

function isExecutableBusyError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    if ((error as { code?: unknown }).code === "ETXTBSY") return true;
  }
  return error instanceof Error && error.message.includes("ETXTBSY");
}

/**
 * @sparticuz/chromium はコールドスタート時に /tmp へ展開されるため、同一環境で
 * 展開と起動が重なると spawn ETXTBSY が一時的に返ることがある。その場合だけ
 * 短く待って再試行し、設定不備など恒久エラーは即座に呼び出し元へ返す。
 */
export async function launchPdfBrowser(options: LaunchOptions) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await puppeteer.launch(options);
    } catch (error) {
      const retryDelay = EXECUTABLE_BUSY_RETRY_DELAYS_MS[attempt];
      if (retryDelay === undefined || !isExecutableBusyError(error)) {
        throw error;
      }
      console.warn("[pdf-browser] Chromium executable busy; retrying launch", {
        attempt: attempt + 1,
        retryDelay,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}
