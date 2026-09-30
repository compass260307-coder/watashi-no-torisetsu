"use client";
import { useUiCopy } from "@/i18n/ui/use-ui-copy";
import Link from "next/link";

export function KoreanPurchaseLegalNotice({
  className = "",
}: {
  className?: string;
}) {
  const copy = useUiCopy("ko").koreanLegal;
  return (
    <p
      className={`text-[11px] leading-[1.75] text-[#77798B] ${className}`.trim()}
    >
      {copy.before} <Link href="/ko/terms" className="font-bold underline underline-offset-2">{copy.terms}</Link>,{" "}
      <Link href="/ko/privacy" className="font-bold underline underline-offset-2">{copy.privacy}</Link>,{" "}
      <Link href="/ko/legal/commerce" className="font-bold underline underline-offset-2">{copy.commerce}</Link>{copy.after}
    </p>
  );
}
