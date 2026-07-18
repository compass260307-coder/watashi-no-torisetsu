"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { KO_TOP_CONTENT } from "@/i18n/ko/top";
import { localeSwitchPath } from "@/lib/locale-switch";

const NAVY = "#2E2E5C";

const NAVIGATION = [
  {
    label: KO_TOP_CONTENT.navigation.diagnosis,
    href: "/ko/diagnosis",
    disabled: false,
  },
  {
    label: KO_TOP_CONTENT.navigation.friend,
    href: "/ko/friend",
    disabled: true,
  },
  {
    label: KO_TOP_CONTENT.navigation.types,
    href: "/ko/types",
    disabled: true,
  },
] as const;

export default function KoTopHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const pathname = usePathname() ?? "/ko";

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // ストレージ不可時は現在のパスだけで言語切替先を決める。
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwnerToken(token);
  }, [pathname]);

  const japaneseHref = localeSwitchPath(pathname, "ja", ownerToken);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white">
      <div className="flex w-full items-center gap-4 px-5 py-4 sm:px-8">
        <Link
          href="/ko"
          className="whitespace-nowrap text-[18px] font-extrabold tracking-[-0.02em] xl:text-[21px]"
          style={{ color: NAVY }}
        >
          {KO_TOP_CONTENT.siteName}
        </Link>

        <div className="ml-auto hidden items-center gap-5 lg:flex xl:gap-8">
          {NAVIGATION.map((item) =>
            item.disabled ? (
              <span
                key={item.href}
                className="whitespace-nowrap text-[16px] font-bold text-[#B4B4C4] xl:text-[19px]"
                aria-disabled="true"
              >
                {item.label}
                <span className="ml-1 text-[11px] xl:text-[12px]">
                  ({KO_TOP_CONTENT.navigation.preparing})
                </span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-[16px] font-bold transition-colors hover:text-[#5B5BEF] xl:text-[19px]"
                style={{ color: NAVY }}
              >
                {item.label}
              </Link>
            ),
          )}

          <div className="relative">
            <button
              type="button"
              aria-label="언어 변경"
              aria-expanded={languageOpen}
              onClick={() => setLanguageOpen((current) => !current)}
              className="flex items-center gap-1.5 whitespace-nowrap text-[16px] font-bold transition-colors hover:text-[#5B5BEF] xl:text-[18px]"
              style={{ color: NAVY }}
            >
              <GlobeIcon />
              한국어
              <CaretDownIcon />
            </button>

            {languageOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setLanguageOpen(false)}
                  aria-label="언어 메뉴 닫기"
                />
                <div className="absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-xl border border-[#2E2E5C]/10 bg-white py-1 shadow-[0_8px_24px_rgba(42,58,92,0.16)]">
                  <div className="px-4 py-2.5 text-[15px] font-bold text-[#5B5BEF]">
                    한국어
                  </div>
                  <Link
                    href={japaneseHref}
                    className="block px-4 py-2.5 text-[15px] font-medium text-[#2E2E5C] transition-colors hover:bg-[#F5F5FF]"
                  >
                    日本語
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label={KO_TOP_CONTENT.navigation.menuOpen}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="ml-auto flex h-10 w-10 items-center justify-center lg:hidden"
        >
          <MenuIcon />
        </button>
      </div>

      <button
        type="button"
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 lg:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-label={KO_TOP_CONTENT.navigation.menuClose}
        tabIndex={menuOpen ? 0 : -1}
      />

      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden lg:hidden">
        <nav
          aria-label={KO_TOP_CONTENT.navigation.menu}
          aria-hidden={!menuOpen}
          className={`pointer-events-auto absolute inset-y-0 right-0 flex w-[82%] max-w-[320px] flex-col bg-white shadow-[0_0_40px_rgba(42,58,92,0.2)] transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#2E2E5C]/10 px-6 py-4">
            <span className="text-[16px] font-bold" style={{ color: NAVY }}>
              {KO_TOP_CONTENT.navigation.menu}
            </span>
            <button
              type="button"
              aria-label={KO_TOP_CONTENT.navigation.menuClose}
              onClick={() => setMenuOpen(false)}
              tabIndex={menuOpen ? 0 : -1}
              className="flex h-10 w-10 items-center justify-center"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex flex-col px-6 py-3">
            {NAVIGATION.map((item) =>
              item.disabled ? (
                <span
                  key={item.href}
                  className="py-3.5 text-[18px] font-bold text-[#B4B4C4]"
                  aria-disabled="true"
                >
                  {item.label}
                  <span className="ml-1 text-[12px]">
                    ({KO_TOP_CONTENT.navigation.preparing})
                  </span>
                </span>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  tabIndex={menuOpen ? 0 : -1}
                  onClick={() => setMenuOpen(false)}
                  className="py-3.5 text-[18px] font-bold transition-colors hover:text-[#5B5BEF]"
                  style={{ color: NAVY }}
                >
                  {item.label}
                </Link>
              ),
            )}

            <div className="mt-2 border-t border-[#2E2E5C]/10 pt-3">
              <div className="flex items-center gap-1.5 py-2 text-[16px] font-bold text-[#5B5BEF]">
                <GlobeIcon />
                한국어
              </div>
              <Link
                href={japaneseHref}
                tabIndex={menuOpen ? 0 : -1}
                className="block py-2 text-[16px] font-medium text-[#2E2E5C]"
              >
                日本語로 보기
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3c2.7 2.6 2.7 15.4 0 18M12 3c-2.7 2.6-2.7 15.4 0 18"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CaretDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke={NAVY} strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </g>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke={NAVY} strokeWidth="2" strokeLinecap="round">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </g>
    </svg>
  );
}
