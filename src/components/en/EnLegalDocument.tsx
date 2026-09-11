import Link from "next/link";
import type { ReactNode } from "react";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";

export default function EnLegalDocument({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-[#2E2E5C]">
      <EnSiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 pb-4 pt-14">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </div>
        <article className="mx-auto max-w-3xl px-5 py-8">
          <div className="prose-legal text-[#2E2E5C]">{children}</div>
        </article>
        <div className="mx-auto mt-4 max-w-3xl border-t border-gray-200 px-5 pb-12 pt-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <Link href="/en" className="font-bold text-[#5B5BEF] hover:underline">Back to home</Link>
            <Link href="/en/about" className="text-gray-500 hover:underline">About the service</Link>
          </div>
        </div>
      </main>
      <EnSiteFooter />
    </div>
  );
}
