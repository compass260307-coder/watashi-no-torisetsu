import type { Metadata } from "next";
import { LoginConfirmPageContent, type LoginConfirmSearchParams } from "@/app/login/confirm/LoginConfirmPageContent";

export const metadata: Metadata = { title: { absolute: "Konfirmasi masuk | Alice Test" }, robots: { index: false, follow: false } };

export default function IndonesianLoginConfirmPage({ searchParams }: { searchParams: Promise<LoginConfirmSearchParams> }) {
  return <LoginConfirmPageContent searchParams={searchParams} localeOverride="id" />;
}
