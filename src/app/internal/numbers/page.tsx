import type { Metadata } from "next";
import Link from "next/link";

import { NumbersDashboard } from "@/components/internal/NumbersDashboard";
import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "数値",
  robots: { index: false, follow: false },
};

export default async function InternalNumbersPage() {
  const user = await getSession();
  if (!(await isInternalDashboardViewer(user))) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-black px-6 text-center text-[#e7e9ea]">
        <p className="text-sm leading-relaxed text-[#8b8f94]">
          このページは、許可されたアカウントでログインしているときだけ表示されます。
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black"
        >
          ログインする
        </Link>
      </main>
    );
  }

  return <NumbersDashboard />;
}
