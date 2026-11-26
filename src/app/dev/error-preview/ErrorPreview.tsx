"use client";

import { AppErrorScreen } from "@/components/ErrorScreens";
import { GlobalErrorBody } from "@/components/GlobalErrorBody";

export function ErrorPreview({ chunk, global }: { chunk: boolean; global: boolean }) {
  const onRetry = () => window.location.reload();
  return global ? (
    <GlobalErrorBody chunkError={chunk} onRetry={onRetry} />
  ) : (
    <AppErrorScreen chunkError={chunk} onRetry={onRetry} />
  );
}
