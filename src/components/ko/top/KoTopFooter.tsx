"use client";

// 친구 진단 테스트の遷移先解決 (localStorage) とロック表示のためクライアントコンポーネント。
// 未診断時は日本語版 TopFooter と同じロック挙動 (グレー+南京錠 → TakoLockPopover)。

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TakoLockPopover } from "@/components/TakoLockPopover";
import { KO_TOP_CONTENT } from "@/i18n/ko/top";

const COLUMNS = [
  {
    title: KO_TOP_CONTENT.footer.diagnosisTitle,
    links: [
      {
        label: KO_TOP_CONTENT.navigation.diagnosis,
        href: "/ko/diagnosis",
        disabled: false,
        external: false,
      },
      {
        label: KO_TOP_CONTENT.navigation.friend,
        href: "/ko/tako",
        disabled: false,
        external: false,
      },
      {
        label: KO_TOP_CONTENT.navigation.types,
        href: "/ko/types",
        disabled: false,
        external: false,
      },
      {
        label: "운명의 설계도",
        href: "/ko/unmei",
        disabled: false,
        external: false,
      },
      {
        label: "별자리 상담사",
        href: "/ko/hoshiyomi",
        disabled: false,
        external: false,
      },
    ],
  },
  {
    title: KO_TOP_CONTENT.footer.serviceTitle,
    links: [
      {
        label: KO_TOP_CONTENT.footer.about,
        href: "/ko/about",
        disabled: false,
        external: false,
      },
      {
        label: KO_TOP_CONTENT.footer.articles,
        href: "/ko/articles",
        disabled: false,
        external: false,
      },
      {
        label: KO_TOP_CONTENT.footer.company,
        href: "https://sora-team.com",
        disabled: false,
        external: true,
      },
    ],
  },
  {
    title: KO_TOP_CONTENT.footer.supportTitle,
    links: [
      {
        label: KO_TOP_CONTENT.footer.contact,
        href: "mailto:support@watashi-torisetsu.com",
        disabled: false,
        external: true,
      },
    ],
  },
] as const;

const LEGAL_LINKS = [
  { label: KO_TOP_CONTENT.footer.terms, href: "/ko/terms" },
  { label: KO_TOP_CONTENT.footer.privacy, href: "/ko/privacy" },
  { label: KO_TOP_CONTENT.footer.commerce, href: "/ko/legal/commerce" },
] as const;

export default function KoTopFooter() {
  const pathname = usePathname() ?? "/ko";

  // 친구 진단 테스트の遷移先を KoTopHeader/BottomNav と同じルールで解決:
  //   owner_token があれば /ko/tako/[token]、無ければロック表示 (遷移しない)。
  const [takoUrl, setTakoUrl] = useState("/ko/tako");
  // 初期値 true (=ロックなし): 診断済みユーザーに一瞬ロックが見えるのを避ける。
  const [hasToken, setHasToken] = useState(true);
  const [takoLockOpen, setTakoLockOpen] = useState(false);
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // localStorage 不可環境: フォールバックのまま。
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTakoUrl(token ? `/ko/tako/${encodeURIComponent(token)}` : "/ko/tako");
    setHasToken(Boolean(token));
  }, [pathname]);

  const columns = COLUMNS.map((column) => ({
    ...column,
    links: column.links.map((item) =>
      item.label === KO_TOP_CONTENT.navigation.friend
        ? { ...item, href: takoUrl }
        : item,
    ),
  }));

  return (
    <footer className="w-full bg-white px-8 py-16 sm:py-20">
      <div className="mx-auto max-w-[1080px]">
        <div className="grid grid-cols-2 gap-x-10 gap-y-10 md:grid-cols-3">
          {columns.map((column) => (
            <nav key={column.title} className="flex flex-col gap-4">
              <p className="mb-1 text-[17px] font-bold text-[#2E2E5C]">
                {column.title}
              </p>
              {column.links.map((item) =>
                item.disabled ? (
                  <span
                    key={item.href}
                    className="w-fit text-[16px] text-[#B4B4C4]"
                    aria-disabled="true"
                  >
                    {item.label}
                    <span className="ml-1 text-[11px]">
                      ({KO_TOP_CONTENT.navigation.preparing})
                    </span>
                  </span>
                ) : item.label === KO_TOP_CONTENT.navigation.friend &&
                  !hasToken ? (
                  // 未診断時はロック表示: 遷移せずポップオーバーで解放条件を伝える
                  // (日本語版 TopFooter と同じ。南京錠だけの折り返しを防ぐため常に1行)。
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => setTakoLockOpen(true)}
                    className="flex w-fit items-center gap-1 whitespace-nowrap text-left text-[16px]"
                    style={{ color: "#9BA3B4" }}
                  >
                    {item.label}
                    <MenuLockIcon />
                  </button>
                ) : item.external ? (
                  <a
                    key={item.href}
                    href={item.href}
                    className="w-fit text-[16px] text-[#6E72C8] transition-colors hover:text-[#5B5BEF]"
                    {...(item.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="w-fit text-[16px] text-[#6E72C8] transition-colors hover:text-[#5B5BEF]"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          ))}
        </div>

        <div aria-hidden="true" className="my-10 border-t border-[#2E2E5C]/10" />

        <div className="flex flex-col gap-3 text-[#8A8AA3]">
          <nav
            aria-label="법적 고지"
            className="mb-2 flex flex-wrap gap-x-5 gap-y-2 text-[13px]"
          >
            {LEGAL_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-[#5B5BEF] hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="text-[14px]">
            © {new Date().getFullYear()} {KO_TOP_CONTENT.footer.copyright}
          </p>
          <p className="max-w-[760px] break-keep text-[14px] leading-relaxed">
            {KO_TOP_CONTENT.footer.disclaimer}
          </p>
        </div>
      </div>

      {/* 未診断でロック中の친구 진단 테스트を押したときの吹き出し (BottomNav/KoTopHeader と共用)。
          画面下部・ボトムナビの친구 진단タブの真上に出る。 */}
      <TakoLockPopover
        isOpen={takoLockOpen}
        onClose={() => setTakoLockOpen(false)}
        locale="ko"
      />
    </footer>
  );
}

// 未診断時に「친구 진단 테스트」の横に付けるミニ南京錠。KoTopHeader の MenuLockIcon と同モチーフ。
function MenuLockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" fill="currentColor" />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
