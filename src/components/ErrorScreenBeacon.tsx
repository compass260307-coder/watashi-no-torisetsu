"use client";

import { useEffect, useRef } from "react";
import { reportErrorScreen, type ErrorScreenKind } from "@/lib/error-screen-tracking";

/** 画面が出たときに1回だけ、エラー画面の表示を記録する (何も描かない)。 */
export function ErrorScreenBeacon({
  kind,
  extra,
}: {
  kind: ErrorScreenKind;
  extra?: Record<string, string | number | boolean | null>;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    reportErrorScreen(kind, extra);
    // 出た瞬間の1回だけ送る。あとから extra が変わっても送り直さない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
