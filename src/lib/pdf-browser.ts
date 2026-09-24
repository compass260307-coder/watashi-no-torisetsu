import "server-only";

import puppeteer from "puppeteer-core";

type LaunchOptions = Parameters<typeof puppeteer.launch>[0];

// @sparticuz/chromium と同じバージョンの pack tar。Next.js の file tracing で
// package 内の bin/ が含まれなかったときだけ利用する。
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

// 別プロセスが同じ /tmp/chromium を展開中の場合にも耐えられるよう、展開にかかる
// 数秒を十分に覆う。ETXTBSY 以外の起動失敗はリトライしない。
const EXECUTABLE_BUSY_RETRY_DELAYS_MS = [250, 750, 1_500, 3_000, 5_000] as const;

let linuxLaunchOptionsPromise: Promise<LaunchOptions> | null = null;

function isExecutableBusyError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    if ((error as { code?: unknown }).code === "ETXTBSY") return true;
  }
  return error instanceof Error && error.message.includes("ETXTBSY");
}

async function resolveLinuxLaunchOptions(): Promise<LaunchOptions> {
  const chromium = (await import("@sparticuz/chromium")).default;
  let executablePath: string;

  try {
    executablePath = await chromium.executablePath();
  } catch (bundledBinaryError) {
    // Turbopack の file tracing で package 内の bin/ が含まれない場合は、同じ
    // バージョンの pack tar を取得する。Promise は下の single-flight で共有される
    // ため、同一プロセスの並行リクエストが重複ダウンロード・展開することはない。
    console.warn(
      "[pdf-browser] Bundled Chromium unavailable; using remote pack",
      { bundledBinaryError },
    );
    executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
  }

  return {
    args: chromium.args,
    executablePath,
    headless: true,
  };
}

async function getLaunchOptions(): Promise<LaunchOptions> {
  if (process.platform !== "linux") {
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    return { executablePath, headless: true };
  }

  // Fluid Compute は1プロセスで複数リクエストを処理する。ライブラリは展開開始時に
  // /tmp/chromium を作成するため、別リクエストが未完成ファイルを実行すると
  // spawn ETXTBSY になる。解決・展開Promiseを共有し、完了前の起動を防ぐ。
  linuxLaunchOptionsPromise ??= resolveLinuxLaunchOptions().catch((error) => {
    // 一時的なダウンロード・展開失敗を次のリクエストで再試行できるようにする。
    linuxLaunchOptionsPromise = null;
    throw error;
  });

  return linuxLaunchOptionsPromise;
}

/**
 * Chromium のコールドスタート展開を single-flight 化してから起動する。
 * 別プロセスとの /tmp 競合で spawn ETXTBSY が返った場合だけ待って再試行し、
 * 設定不備などの恒久エラーは即座に呼び出し元へ返す。
 */
export async function launchPdfBrowser() {
  const options = await getLaunchOptions();

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
