import Link from "next/link";
import { notFound } from "next/navigation";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import {
  paywallCardMode,
  type PaywallCardMode,
} from "@/lib/feature-flags";
import type { ResultLocale } from "@/i18n/result";

// /me や /tako の診断をやり直さず、課金カードのコピーだけを確認するローカル専用プレビュー。
// カードモード（旧カード/松竹梅）・言語（日本語/韓国語）・面（自己/友達/相性）をURLで
// 切り替えて、本番に出る全パターンのコピーを1ページで見比べられる。

type Surface = "self" | "tako" | "aisho";

const SURFACE_LABEL: Record<Surface, string> = {
  self: "自己診断(/me)",
  tako: "友達診断(/tako)",
  aisho: "相性(/aisho)",
};

// 面ごとに実ページと同じ props を再現する（surface / variant / returnTo）。
const SURFACE_PROPS: Record<
  Surface,
  {
    surface: "self" | "tako";
    variant: "self" | "aisho";
    returnTo: "me" | "tako" | "aisho";
  }
> = {
  self: { surface: "self", variant: "self", returnTo: "me" },
  tako: { surface: "tako", variant: "self", returnTo: "tako" },
  aisho: { surface: "self", variant: "aisho", returnTo: "aisho" },
};

function pickOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-[12px] font-black transition ${
        active ? "bg-[#2E2E5C] text-white" : "bg-white text-[#5B5BEF]"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function SelfReportPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string | string[];
    locale?: string | string[];
    surface?: string | string[];
  }>;
}) {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;

  const requestedMode = pickOne(params.mode);
  const cardMode: PaywallCardMode =
    requestedMode === "legacy" || requestedMode === "three-course"
      ? requestedMode
      : paywallCardMode();
  const isThreeCourse = cardMode === "three-course";

  const requestedLocale = pickOne(params.locale);
  const locale: ResultLocale = requestedLocale === "ko" ? "ko" : "ja";

  const requestedSurface = pickOne(params.surface);
  const surface: Surface =
    requestedSurface === "tako" || requestedSurface === "aisho"
      ? requestedSurface
      : "self";
  const surfaceProps = SURFACE_PROPS[surface];

  // 現在の選択を保ったまま1軸だけ差し替えたリンクを作る。
  const buildHref = (patch: {
    mode?: PaywallCardMode;
    locale?: ResultLocale;
    surface?: Surface;
  }) => {
    const next = new URLSearchParams({
      mode: patch.mode ?? cardMode,
      locale: patch.locale ?? locale,
      surface: patch.surface ?? surface,
    });
    return `/dev/self-report-preview?${next.toString()}`;
  };

  return (
    <main className="min-h-dvh bg-[#F6F7FB] py-8 md:py-12">
      <div className="mx-auto max-w-[820px] px-4 text-center">
        <p className="text-[11px] font-black tracking-[0.14em] text-[#5B5BEF]">
          LOCAL PREVIEW
        </p>
        <h1 className="mt-2 text-[22px] font-black text-[#2A3A5C]">
          {isThreeCourse ? "松竹梅カードの確認" : "旧課金カードの確認"}
        </h1>
        <p className="mt-3 text-[13px] font-bold leading-[1.8] text-[#7A8498]">
          実際の課金カードと同じコピー・レイアウトです。
          <br />
          モード・言語・面を切り替えて全パターンのコピーを見比べられます。
        </p>

        <div className="mt-5 space-y-3">
          <nav
            aria-label="カードモード切り替え"
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-[11px] font-black text-[#9AA1B4]">モード</span>
            <TabLink href={buildHref({ mode: "legacy" })} active={!isThreeCourse}>
              旧カード
            </TabLink>
            <TabLink
              href={buildHref({ mode: "three-course" })}
              active={isThreeCourse}
            >
              松竹梅
            </TabLink>
          </nav>

          <nav
            aria-label="言語切り替え"
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-[11px] font-black text-[#9AA1B4]">言語</span>
            <TabLink href={buildHref({ locale: "ja" })} active={locale === "ja"}>
              日本語
            </TabLink>
            <TabLink href={buildHref({ locale: "ko" })} active={locale === "ko"}>
              한국어
            </TabLink>
          </nav>

          <nav
            aria-label="面切り替え"
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-[11px] font-black text-[#9AA1B4]">面</span>
            {(Object.keys(SURFACE_LABEL) as Surface[]).map((s) => (
              <TabLink
                key={s}
                href={buildHref({ surface: s })}
                active={surface === s}
              >
                {SURFACE_LABEL[s]}
              </TabLink>
            ))}
          </nav>
        </div>
      </div>

      <FullAccessPromoCard
        imageSrc="/characters/scenes/unknown_work.webp"
        imageAlt="自己分析レポートのイメージ"
        group="unknown"
        locale={locale}
        surface={surfaceProps.surface}
        variant={surfaceProps.variant}
        returnTo={surfaceProps.returnTo}
        ctaSource="dev_self_report_preview"
        cardMode={cardMode}
        previewMode
      />
    </main>
  );
}
