"use client";

import { useEffect } from "react";
import { ErrorScreenBeacon } from "@/components/ErrorScreenBeacon";
import { AppErrorScreen } from "@/components/ErrorScreens";
import { isChunkLoadError } from "@/lib/chunk-load-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <ErrorScreenBeacon
        kind="error"
        extra={{
          chunk: chunkError,
          error_name: (error.name || "Error").slice(0, 60),
          digest: error.digest ? error.digest.slice(0, 60) : null,
        }}
      />
      <AppErrorScreen
        chunkError={chunkError}
        onRetry={() => (chunkError ? window.location.reload() : reset())}
      />
    </>
  );
}
