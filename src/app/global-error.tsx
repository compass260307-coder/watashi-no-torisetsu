"use client";

import { GlobalErrorBody } from "@/components/GlobalErrorBody";
import { isChunkLoadError } from "@/lib/chunk-load-error";

// global-error.tsx は root layout の外側で発火する。
// ここでは next/font 等が使えないため最小限のインライン CSS のみ。
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  console.error(error);
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>
        <GlobalErrorBody
          chunkError={chunkError}
          onRetry={() => (chunkError ? window.location.reload() : reset())}
        />
      </body>
    </html>
  );
}
