"use client";

import TopHeader from "./TopHeader";
import type { ComponentProps } from "react";

// TOP prioritizes diagnosis. Its optional direct purchase downloads the dialog
// only when opened; completed diagnoses warm the result purchase funnel instead.
export default function TopPurchaseHeader({ locale = "ja" }: Pick<ComponentProps<typeof TopHeader>, "locale">) {
  return <TopHeader locale={locale} preloadPurchaseOnIntent={false} />;
}
