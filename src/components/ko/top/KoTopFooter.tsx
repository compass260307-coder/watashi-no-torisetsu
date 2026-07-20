import Link from "next/link";
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
        href: "/ko/friend",
        disabled: true,
        external: false,
      },
      {
        label: KO_TOP_CONTENT.navigation.types,
        href: "/ko/types",
        disabled: true,
        external: false,
      },
    ],
  },
  {
    title: KO_TOP_CONTENT.footer.serviceTitle,
    links: [
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
  return (
    <footer className="w-full bg-white px-8 py-16 sm:py-20">
      <div className="mx-auto max-w-[1080px]">
        <div className="grid grid-cols-2 gap-x-10 gap-y-10 md:grid-cols-3">
          {COLUMNS.map((column) => (
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
    </footer>
  );
}
