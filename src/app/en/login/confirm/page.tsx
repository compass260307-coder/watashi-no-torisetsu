import type { Metadata } from "next";
import {
  LoginConfirmPageContent,
  type LoginConfirmSearchParams,
} from "@/app/login/confirm/LoginConfirmPageContent";

type PageProps = { searchParams: Promise<LoginConfirmSearchParams> };

export const metadata: Metadata = {
  title: { absolute: "Confirm sign-in | Alice Diagnosis" },
  robots: { index: false, follow: false },
};

export default function EnglishLoginConfirmPage({ searchParams }: PageProps) {
  return (
    <LoginConfirmPageContent searchParams={searchParams} localeOverride="en" />
  );
}
