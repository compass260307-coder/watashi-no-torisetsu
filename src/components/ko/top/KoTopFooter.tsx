"use client";

// 친구 진단 테스트の遷移先解決 (localStorage) とロック表示のためクライアントコンポーネント。
// 未診断時は日本語版 TopFooter と同じロック挙動 (グレー+南京錠 → TakoLockPopover)。

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TakoLockPopover } from "@/components/TakoLockPopover";
import { KO_TOP_CONTENT } from "@/i18n/ko/top";

type FooterLink = {
  label: string;
  href: string;
  disabled?: boolean;
  external?: boolean;
  children?: { label: string; href: string }[];
};

const COLUMNS: { title: string; links: FooterLink[] }[] = [
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
        children: [
          { label: "OCEAN 진단이란?", href: "/ko/articles/ocean-shindan" },
          {
            label: "타인 분석 방법",
            href: "/ko/articles/tako-bunseki",
          },
          {
            label: "사용설명서 만드는 법",
            href: "/ko/articles/torisetsu-tsukurikata",
          },
          {
            label: "16가지 유형과의 차이",
            href: "/ko/articles/sixteen-types-vs-ocean",
          },
        ],
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
];

const LEGAL_LINKS = [
  { label: KO_TOP_CONTENT.footer.terms, href: "/ko/terms" },
  { label: KO_TOP_CONTENT.footer.privacy, href: "/ko/privacy" },
  { label: KO_TOP_CONTENT.footer.commerce, href: "/ko/legal/commerce" },
] as const;

const SOCIALS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/torisetsu_app",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/torisetsu_app",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@torisetsu_app",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
];

export default function KoTopFooter({
  topBorder = true,
}: {
  topBorder?: boolean;
}) {
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
  const linkClass =
    "w-fit text-[18px] text-[#6E72C8] transition-colors hover:text-[#5B5BEF]";

  return (
    <footer
      className={`w-full bg-white px-8 py-20 ${
        topBorder ? "border-t border-[#E9E9F2]" : ""
      }`}
    >
      <div className="mx-auto max-w-[1080px]">
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3">
          {columns.map((column) => (
            <nav key={column.title} className="flex flex-col gap-4">
              <p className="mb-1 text-[18px] font-bold text-[#2E2E5C]">
                {column.title}
              </p>
              {column.links.map((item) =>
                item.disabled ? (
                  <span
                    key={item.href}
                    className="w-fit text-[18px] text-[#B4B4C4]"
                    aria-disabled="true"
                  >
                    {item.label}
                    <span className="text-[12px]">
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
                    className="flex w-fit items-center gap-1 whitespace-nowrap text-left text-[18px]"
                    style={{ color: "#9BA3B4" }}
                  >
                    {item.label}
                    <MenuLockIcon />
                  </button>
                ) : item.external ? (
                  <a
                    key={item.href}
                    href={item.href}
                    className={linkClass}
                    {...(item.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {item.label}
                  </a>
                ) : item.children ? (
                  <div key={item.href} className="flex flex-col gap-2">
                    <Link
                      href={item.href}
                      className={linkClass}
                    >
                      {item.label}
                    </Link>
                    <div className="ml-1 flex flex-col gap-2 border-l border-[#E9E9F2] pl-3">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="w-fit text-[14px] text-[#8A8AA3] transition-colors hover:text-[#5B5BEF]"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={linkClass}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          ))}
        </div>

        <div aria-hidden="true" className="my-12 border-t border-[#2E2E5C]/10" />

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-[16px] text-[#8A8AA3]">
                © {new Date().getFullYear()} {KO_TOP_CONTENT.footer.copyright}
              </p>
              <nav
                aria-label="법적 고지"
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                {LEGAL_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-[13px] text-[#8A8AA3] underline-offset-2 transition-colors hover:text-[#5B5BEF] hover:underline"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <p className="max-w-[720px] text-[15px] leading-relaxed text-[#8A8AA3]">
              {KO_TOP_CONTENT.footer.disclaimer}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2E2E5C]/15 text-[#5A5A7A] transition-colors hover:border-[#5B5BEF] hover:text-[#5B5BEF]"
              >
                {social.icon}
              </a>
            ))}
          </div>
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
