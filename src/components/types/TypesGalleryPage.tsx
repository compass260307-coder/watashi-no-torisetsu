import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import {
  KO_TYPES_COPY,
  KO_TYPE_ZUKAN_DESCRIPTIONS,
} from "@/i18n/ko/types";
import {
  allThirtyTwoTypeIds,
  baseIdOf,
  nAxisOf,
  thirtyTwoEssence,
  thirtyTwoGroup,
  thirtyTwoImagePath,
  thirtyTwoZukanDesc,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import { sixteenTypes } from "@/lib/sixteen-types";

type TypesLocale = "ja" | "ko";

interface TypesGalleryPageProps {
  locale: TypesLocale;
}

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";
const NAVY = "#2E2E5C";
const SLANT = "clamp(24px, 3.2vw, 64px)";

const CUT_DIR = path.join(process.cwd(), "public", "characters", "cut");
const readDirSafe = (dir: string): Set<string> => {
  try {
    return new Set(fs.readdirSync(dir));
  } catch {
    return new Set();
  }
};
const cutFiles = readDirSafe(CUT_DIR);

function slugOf(id: ThirtyTwoTypeId): string {
  return path.basename(thirtyTwoImagePath(id), ".webp");
}

function displayImagePath(id: ThirtyTwoTypeId): string {
  const file = `${slugOf(id)}.webp`;
  return cutFiles.has(file)
    ? `/characters/cut/${file}`
    : thirtyTwoImagePath(id);
}

const BAND_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#FDEFB4",
  sea: "#BEF2F9",
  land: "#D8F2C0",
  unknown: "#E7DCFB",
};

const DARK_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#8F6B14",
  sea: "#1D6E86",
  land: "#3F7A2E",
  unknown: "#6C4EB8",
};

function oceanFlags(id: ThirtyTwoTypeId): { letter: string; high: boolean }[] {
  const code = sixteenTypes[baseIdOf(id)].code;
  const ocea = (["O", "C", "E", "A"] as const).map((letter) => ({
    letter: letter as string,
    high: code.includes(`${letter}＋`),
  }));
  return [...ocea, { letter: "N", high: nAxisOf(id) === "N" }];
}

const JA_GROUPS: {
  key: ThirtyTwoGroup;
  name: string;
  giant: string;
}[] = [
  { key: "sea", name: "海グループ", giant: "海" },
  { key: "land", name: "陸グループ", giant: "陸" },
  { key: "sky", name: "空グループ", giant: "空" },
  { key: "unknown", name: "未知グループ", giant: "未知" },
];

export default function TypesGalleryPage({
  locale,
}: TypesGalleryPageProps) {
  const isKo = locale === "ko";
  const groups = isKo
    ? (Object.entries(KO_TYPES_COPY.groups) as [
        ThirtyTwoGroup,
        { name: string; giant: string },
      ][]).map(([key, value]) => ({ key, ...value }))
    : JA_GROUPS;
  const byGroup = new Map<ThirtyTwoGroup, ThirtyTwoTypeId[]>();

  for (const id of allThirtyTwoTypeIds()) {
    const group = thirtyTwoGroup(id);
    byGroup.set(group, [...(byGroup.get(group) ?? []), id]);
  }

  const title = isKo ? KO_TYPES_COPY.title : "性格タイプ";
  const cta = isKo ? KO_TYPES_COPY.cta : "テストを受ける →";
  const diagnosisHref = isKo ? "/ko/diagnosis" : "/diagnosis";
  const previewPrefix = isKo ? "/ko/preview" : "/preview";

  return (
    <div
      className="flex flex-1 flex-col bg-white"
      style={isKo ? undefined : { fontFamily: FONT_STACK }}
    >
      {isKo ? <KoTopHeader /> : <TopHeader />}

      <main className="w-full pb-0">
        <header className="mx-auto max-w-[1160px] px-6 pt-12 text-center md:pt-16">
          <h1
            className="font-bold"
            style={{
              color: NAVY,
              fontSize: "clamp(38px, 4.8vw, 60px)",
              lineHeight: 1.4,
            }}
          >
            {title}
          </h1>
          <div className="mt-6">
            <Link
              href={diagnosisHref}
              prefetch={false}
              className="sora-cta inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
            >
              {cta}
            </Link>
          </div>
        </header>

        <div className="mt-16 md:mt-24">
          {groups.map((group, groupIndex) => {
            const ids = byGroup.get(group.key) ?? [];
            const band = BAND_COLOR[group.key];
            const isLast = groupIndex === groups.length - 1;

            return (
              <section
                key={group.key}
                aria-label={group.name}
                className="relative w-full overflow-hidden"
                style={{
                  backgroundColor: band,
                  clipPath: isLast
                    ? `polygon(0 0, 100% ${SLANT}, 100% 100%, 0 calc(100% - ${SLANT}))`
                    : `polygon(0 0, 100% ${SLANT}, 100% 100%, 0 100%)`,
                  marginTop:
                    groupIndex === 0 ? undefined : `calc(0px - ${SLANT})`,
                }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 select-none text-center font-bold leading-none text-white"
                  style={{
                    top: `calc(${SLANT} + clamp(20px, 3vw, 56px))`,
                    fontSize: "clamp(150px, 25vw, 380px)",
                    letterSpacing: 0,
                  }}
                >
                  {group.giant}
                </div>

                <div
                  className="relative w-full px-3 pt-[clamp(120px,19.5vw,310px)] md:px-8"
                  style={{
                    paddingBottom: `calc(${SLANT} + clamp(56px, 7vw, 110px))`,
                  }}
                >
                  <div className="grid grid-cols-1 gap-y-14 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-14 md:gap-x-6 lg:grid-cols-4">
                    {ids.map((id, typeIndex) => {
                      const essence = isKo
                        ? KO_RESULT_TYPES[id].essence
                        : thirtyTwoEssence(id);
                      const description = isKo
                        ? KO_TYPE_ZUKAN_DESCRIPTIONS[id]
                        : thirtyTwoZukanDesc(id);
                      const resultAriaLabel = isKo
                        ? KO_TYPES_COPY.resultAriaLabel(essence)
                        : `${essence}の結果ページを見る`;

                      return (
                        <article
                          key={id}
                          className="flex min-w-0 flex-col items-center text-center"
                        >
                          <Link
                            href={`${previewPrefix}/${id}`}
                            prefetch={false}
                            aria-label={resultAriaLabel}
                            className="w-full transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
                          >
                            <SmoothImage
                              src={displayImagePath(id)}
                              alt={essence}
                              width={512}
                              height={512}
                              placeholderColor="transparent"
                              loading={
                                groupIndex === 0 && typeIndex < 4
                                  ? "eager"
                                  : "lazy"
                              }
                              className="mx-auto h-auto w-full max-w-[420px] sm:max-w-none"
                            />
                          </Link>
                          <h3
                            className="mt-2 text-[24px] font-bold leading-snug md:text-[32px] xl:text-[40px]"
                            style={{ color: DARK_COLOR[group.key] }}
                          >
                            {essence}
                          </h3>
                          <p
                            className="mt-1 flex items-baseline justify-center gap-[3px] text-[18px] font-extrabold leading-none md:text-[21px] xl:text-[24px]"
                            style={{ color: NAVY }}
                          >
                            {oceanFlags(id).map(({ letter, high }) => (
                              <span
                                key={letter}
                                style={
                                  high
                                    ? undefined
                                    : { fontSize: "0.68em", opacity: 0.4 }
                                }
                              >
                                {high ? letter : letter.toLowerCase()}
                              </span>
                            ))}
                          </p>
                          <p
                            className={`mt-2 max-w-[330px] text-[15px] leading-relaxed sm:max-w-[240px] sm:text-[14px] md:text-[15px] xl:max-w-[340px] xl:text-[17px] ${
                              isKo ? "break-keep" : ""
                            }`}
                            style={{ color: `${NAVY}B3` }}
                          >
                            {description}
                          </p>
                        </article>
                      );
                    })}
                  </div>

                  {group.key === "land" && (
                    <div className="mt-16 text-center md:mt-24">
                      <Link
                        href={diagnosisHref}
                        prefetch={false}
                        className="sora-cta inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
                      >
                        {cta}
                      </Link>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <section className="py-16 text-center md:py-24">
          <Link
            href={diagnosisHref}
            prefetch={false}
            className="sora-cta inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
          >
            {cta}
          </Link>
        </section>
      </main>

      {isKo ? <KoTopFooter /> : <TopFooter />}
    </div>
  );
}
