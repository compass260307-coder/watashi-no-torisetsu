"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeSwitchPath, type SwitchLocale } from "@/lib/locale-switch";

const LANGUAGES: { locale: SwitchLocale; label: string }[] = [
  { locale: "id", label: "Bahasa Indonesia" },
  { locale: "en", label: "English" },
  { locale: "ja", label: "日本語" },
  { locale: "ko", label: "한국어" },
];

export default function IdSiteHeader() {
  const pathname = usePathname() ?? "/id";

  return (
    <header className="sticky top-0 z-50 border-b border-[#E9E9F2] bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[1180px] items-center gap-5 px-5 sm:px-8">
        <Link href="/id" prefetch={false} className="text-lg font-black text-[#2E2E5C] sm:text-xl">
          Alice Test
        </Link>
        <nav aria-label="Navigasi utama" className="ml-auto flex items-center gap-4 text-sm font-bold text-[#2E2E5C] sm:gap-7 sm:text-base">
          <Link href="/id/diagnosis" prefetch={false} className="hover:text-[#5B5BEF]">Tes</Link>
          <Link href="/id/types" prefetch={false} className="hidden hover:text-[#5B5BEF] sm:inline">32 tipe</Link>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-[#D9D9EA] px-3 py-2 hover:border-[#5B5BEF]">
              🌐 <span className="hidden sm:inline">Bahasa</span>
            </summary>
            <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-[#E3E3F0] bg-white p-2 shadow-xl">
              {LANGUAGES.map((item) => (
                <Link
                  key={item.locale}
                  href={localeSwitchPath(pathname, item.locale)}
                  prefetch={false}
                  className={`block rounded-xl px-3 py-2.5 hover:bg-[#F2F0FF] ${item.locale === "id" ? "font-black text-[#5B5BEF]" : "text-[#2E2E5C]"}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}
