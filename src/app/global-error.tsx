"use client";

import { ErrorScreenBeacon } from "@/components/ErrorScreenBeacon";
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
        <ErrorScreenBeacon
          kind="global_error"
          extra={{
            chunk: chunkError,
            error_name: (error.name || "Error").slice(0, 60),
            digest: error.digest ? error.digest.slice(0, 60) : null,
          }}
        />
        <GlobalErrorBody
          chunkError={chunkError}
          onRetry={() => (chunkError ? window.location.reload() : reset())}
        />
      </body>
    </html>
  );
}
