import type { Metadata } from "next";
import Link from "next/link";

import { NumbersDaily } from "@/components/internal/NumbersDaily";
import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "数値（月の推移）",
  robots: { index: false, follow: false },
};

export default async function InternalNumbersDailyPage() {
  const user = await getSession();
  if (!(await isInternalDashboardViewer(user))) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-white px-6 text-center text-[#0f1419]">
        <p className="text-sm leading-relaxed text-[#45505b]">
          このページは、許可されたアカウントでログインしているときだけ表示されます。
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-[#0f1419] px-4 py-2 text-sm font-bold text-white"
        >
          ログインする
        </Link>
      </main>
    );
  }

  return <NumbersDaily />;
}
