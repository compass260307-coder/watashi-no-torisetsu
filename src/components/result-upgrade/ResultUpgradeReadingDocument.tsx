import { Fragment } from "react";
import { allThirtyTwoTypeIds, thirtyTwoGroup } from "@/lib/thirty-two-types";
import { RESULT_UPGRADE_COPY, type ResultUpgradeLocale } from "@/i18n/result-upgrade";
import { SmoothImage } from "@/components/ui/SmoothImage";
import type { ResultUpgradeReading } from "@/lib/result-upgrade";

interface ResultUpgradeReadingDocumentProps {
  locale?: ResultUpgradeLocale;
  sourceTypeId?: string;
  nickname?: string | null;
  imageSrc: string;
  imageAlt: string;
  imageUnoptimized?: boolean;
  imageAspectClassName?: string;
  personalizedTypeName: string;
  personalizedIntro: string;
  reading: ResultUpgradeReading;
}

export function ResultUpgradeReadingDocument({
  imageSrc,
  sourceTypeId,
  nickname,
  locale = "ja",
  imageAlt,
  imageUnoptimized = false,
  imageAspectClassName = "aspect-square",
  personalizedTypeName,
  personalizedIntro,
  reading,
}: ResultUpgradeReadingDocumentProps) {
  const copy = RESULT_UPGRADE_COPY[locale];
  const displayName = nickname?.trim();
  const documentTitle = locale === "ja"
    ? displayName ? `${displayName}さん専用のトリセツ` : "あなた専用のトリセツ"
    : reading.title;
  const sourceType = allThirtyTwoTypeIds().find(id => id === sourceTypeId);
  const sceneGroup = sourceType ? thirtyTwoGroup(sourceType) : "unknown";
  const scenes = ["normal1", "love", "work", "moshimo", "normal2"];

  return (
    <article className="mx-auto max-w-[900px] overflow-hidden rounded-3xl bg-white text-[#2E2E5C] shadow-[0_8px_40px_rgba(46,46,92,0.06)] print:max-w-none print:rounded-none print:shadow-none">
      <header className="bg-[#F4F1FA] px-6 py-9 md:px-12 md:py-12">
        <p className="text-sm font-bold text-[#776A99]">{copy.documentTitle}</p>
        <h1 className="mt-3 break-words text-balance text-2xl font-bold leading-relaxed md:text-4xl">{documentTitle}</h1>
        <p className="mt-4 max-w-[640px] text-sm leading-7 text-[#66647D] md:text-base">{reading.subtitle}</p>
      </header>
      <div className="px-6 py-9 md:px-12 md:py-12">
        <section className="grid items-center gap-7 border-b border-[#2E2E5C]/10 pb-10 md:grid-cols-[240px_1fr] md:gap-10">
          <SmoothImage
            src={imageSrc}
            alt={imageAlt}
            width={1024}
            height={1024}
            priority
            unoptimized={imageUnoptimized}
            sizes="(min-width: 768px) 240px, (max-width: 320px) 80vw, 280px"
            className={`${imageAspectClassName} mx-auto w-full max-w-[280px] rounded-2xl object-contain`}
          />
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-bold leading-relaxed">{personalizedTypeName}</h2>
            <p className="mt-4 whitespace-pre-line text-[16px] leading-[1.9] text-[#343441]">{personalizedIntro}</p>
          </div>
        </section>
        <div className="divide-y divide-[#2E2E5C]/10">
          {reading.sections.map((section, index) => (
            <section key={`${index}-${section.title}`} className="py-9 md:py-12">
              <h2 className="text-xl font-bold leading-relaxed [break-after:avoid] md:text-2xl">{section.title}</h2>
              <div className="mt-5 space-y-5 text-[16px] leading-[1.9] text-[#343441] md:text-[17px]">
                {section.body.split(/\n\s*\n/).filter(Boolean).map((paragraph, paragraphIndex) => (
                  <Fragment key={paragraphIndex}>
                    <p className="whitespace-pre-line">{paragraph}</p>
                    {paragraphIndex === 0 && scenes[index] && (
                      <div className="py-3 print:break-inside-avoid">
                        <SmoothImage
                          src={`/characters/scenes/${sceneGroup}_${scenes[index]}.webp`}
                          alt=""
                          width={1024}
                          height={1024}
                          fadeIn={false}
                          sizes="(min-width: 768px) 360px, 80vw"
                          className="mx-auto h-auto w-full max-w-[360px] rounded-2xl object-contain"
                        />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </section>
          ))}
        </div>
        <section className="mt-3 rounded-2xl bg-[#F4F1FA] px-5 py-7 md:px-8">
          <h2 className="text-base font-bold">{copy.documentClosing}</h2>
          <p className="mt-4 whitespace-pre-line text-base leading-[1.9] text-[#343441]">{reading.closingMessage}</p>
          <p className="mt-5 text-right font-bold text-[#776A99]">Alice</p>
        </section>
      </div>
    </article>
  );
}
