import type { Metadata } from "next";
import {
  LoginConfirmPageContent,
  type LoginConfirmSearchParams,
} from "@/app/login/confirm/LoginConfirmPageContent";

type PageProps = {
  searchParams: Promise<LoginConfirmSearchParams>;
};

export const metadata: Metadata = {
  title: "로그인 확인 | 나의 사용설명서",
  robots: { index: false, follow: false },
};

export default async function KoreanLoginConfirmPage({
  searchParams,
}: PageProps) {
  return (
    <LoginConfirmPageContent
      searchParams={searchParams}
      localeOverride="ko"
    />
  );
}
