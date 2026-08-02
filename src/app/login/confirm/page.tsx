// マジックリンク・ログイン確認 (v1 衝突検知インタースティシャル) の container。
//
// verify-magic-link が「現デバイスに別アカウント A の Cookie があり、リンク先 B と
// 別 user_id」を検知したとき、サイレント切替を避けてここへ誘導する。

import type { Metadata } from "next";
import {
  LoginConfirmPageContent,
  type LoginConfirmSearchParams,
} from "./LoginConfirmPageContent";

export const metadata: Metadata = {
  title: "ログインの確認",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<LoginConfirmSearchParams>;
}

export default async function LoginConfirmPage({ searchParams }: PageProps) {
  return <LoginConfirmPageContent searchParams={searchParams} />;
}
