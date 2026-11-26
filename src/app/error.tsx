"use client";

import { useEffect } from "react";
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
    <AppErrorScreen
      chunkError={chunkError}
      onRetry={() => (chunkError ? window.location.reload() : reset())}
    />
  );
}
