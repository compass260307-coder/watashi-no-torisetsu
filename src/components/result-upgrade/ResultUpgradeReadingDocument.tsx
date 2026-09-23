import { SmoothImage } from "@/components/ui/SmoothImage";
import type { ResultUpgradeReading } from "@/lib/result-upgrade";

interface ResultUpgradeReadingDocumentProps {
  imageSrc: string;
  imageAlt: string;
  imageUnoptimized?: boolean;
  imageAspectClassName?: string;
  personalizedTypeName: string;
  personalizedIntro: string;
  reading: ResultUpgradeReading;
}

function LanternOrb({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute overflow-hidden rounded-full ${className}`}
      style={{
        background:
          "radial-gradient(circle at 35% 24%, #FF8A70 0%, #EF5748 32%, #E23F35 67%, #C92E29 100%)",
        boxShadow: "inset -22px -26px 48px rgba(135,22,22,0.14)",
      }}
    >
      <div className="absolute inset-x-[8%] bottom-[17%] h-[38%] rounded-[50%] border border-white/65" />
      <div className="absolute inset-x-[11%] bottom-[13%] h-[32%] rounded-[50%] border border-white/45" />
      <div
        className="absolute inset-x-[15%] bottom-0 h-[36%] opacity-55"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,226,210,0.86) 0, rgba(255,226,210,0.86) 1px, transparent 1px, transparent 8px)",
        }}
      />
      <div className="absolute bottom-[13%] left-1/2 h-[24%] w-[44%] -translate-x-1/2 rounded-[50%] bg-[#F8CBB9] shadow-[0_0_24px_rgba(255,236,213,0.55)]" />
    </div>
  );
}

export function ResultUpgradeReadingDocument({
  imageSrc,
  imageAlt,
  imageUnoptimized = false,
  imageAspectClassName = "aspect-[16/10]",
  personalizedTypeName,
  personalizedIntro,
  reading,
}: ResultUpgradeReadingDocumentProps) {
  return (
    <article
      className="mx-auto max-w-[900px] overflow-hidden rounded-[6px] border border-[#211B17] bg-[#F4E3CC] text-[#1E1915] shadow-[0_24px_80px_rgba(55,35,24,0.20)] print:max-w-none print:rounded-none print:shadow-none"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      <header
        className="relative min-h-[680px] overflow-hidden border-b border-[#211B17] px-7 pb-14 pt-9 md:min-h-[760px] md:px-16 md:pb-16 md:pt-12"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 8%, rgba(255,255,255,0.42), transparent 25%), radial-gradient(circle at 20% 78%, rgba(225,66,55,0.08), transparent 32%), linear-gradient(145deg, #F7E9D6 0%, #F2D8BF 100%)",
        }}
      >
        <LanternOrb className="-left-[28%] -top-[18%] h-[430px] w-[430px] opacity-95 md:-left-[12%] md:-top-[22%] md:h-[570px] md:w-[570px]" />
        <LanternOrb className="-right-[18%] top-[8%] h-[260px] w-[260px] opacity-90 md:-right-[6%] md:top-[5%] md:h-[340px] md:w-[340px]" />
        <LanternOrb className="left-[20%] top-[36%] h-[145px] w-[145px] opacity-65 md:left-[37%] md:top-[31%] md:h-[190px] md:w-[190px]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at 20% 20%, #7C251F 0, #7C251F 0.7px, transparent 0.8px, transparent 4px)",
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-black tracking-[0.3em] text-[#D9473C]">
              WATASHI NO TORISETSU
            </p>
            <p className="mt-2 text-[11px] font-bold tracking-[0.12em] text-black/55">
              PERSONAL PORTRAIT
            </p>
          </div>
          <div className="border-l border-[#211B17] pl-4 text-right">
            <p className="text-[11px] font-black tracking-[0.18em]">ARCHIVE</p>
            <p className="mt-1 text-[28px] font-black leading-none text-[#D9473C]">01</p>
          </div>
        </div>

        <p
          className="absolute right-5 top-[41%] z-10 text-[11px] font-black tracking-[0.28em] text-[#C93D34] md:right-9"
          style={{ writingMode: "vertical-rl" }}
        >
          あなただけのために読み解いた記録
        </p>

        <div className="absolute inset-x-7 bottom-14 z-10 md:inset-x-16 md:bottom-16">
          <p className="text-[11px] font-black tracking-[0.32em] text-[#D9473C]">
            PERSONAL PORTRAIT / 01
          </p>
          <h1 className="mt-3 text-[48px] font-black leading-[1.02] tracking-[-0.05em] text-[#16120F] md:text-[72px]">
            個人鑑定書
          </h1>
          <div className="mt-6 h-[5px] w-20 bg-[#D9473C]" />
          <p className="mt-6 max-w-[700px] text-balance text-[24px] font-black leading-[1.5] md:text-[34px]">
            {reading.title}
          </p>
          <p className="mt-4 max-w-[620px] text-[13px] font-medium leading-[1.9] text-black/65 md:text-[15px]">
            {reading.subtitle}
          </p>
        </div>
      </header>

      <div className="px-6 py-12 md:px-16 md:py-18">
        <section className="break-inside-avoid">
          <div className="relative border border-[#211B17] bg-[#211B17] p-[5px]">
            <div className="overflow-hidden bg-[#E8D8C3]">
              <SmoothImage
                src={imageSrc}
                alt={imageAlt}
                width={1254}
                height={784}
                priority
                unoptimized={imageUnoptimized}
                sizes="(min-width: 768px) 720px, calc(100vw - 64px)"
                className={`${imageAspectClassName} w-full object-contain`}
              />
            </div>
            <span className="absolute -bottom-4 right-5 bg-[#D9473C] px-4 py-2 text-[10px] font-black tracking-[0.24em] text-[#FFF2E3]">
              あなただけの一枚
            </span>
          </div>

          <div className="mt-14 border-t border-[#211B17] pt-7 md:grid md:grid-cols-[150px_1fr] md:gap-10">
            <div>
              <p className="text-[46px] font-black leading-none text-[#D9473C]">01</p>
              <p className="mt-2 text-[9px] font-black tracking-[0.2em]">あなたのタイプ</p>
            </div>
            <div className="mt-5 md:mt-0">
              <h2 className="text-balance text-[29px] font-black leading-[1.4] md:text-[42px]">
                {personalizedTypeName}
              </h2>
              <p className="mt-6 text-[15px] font-medium leading-[2.05] text-black/78 md:text-[16px] md:leading-[2.15]">
                {personalizedIntro}
              </p>
            </div>
          </div>
        </section>

        <div className="my-16 flex items-center gap-4 md:my-24">
          <div className="h-px flex-1 bg-[#211B17]" />
          <div className="h-3 w-3 rounded-full bg-[#D9473C]" />
          <div className="h-px w-12 bg-[#211B17]" />
        </div>

        <div className="space-y-16 md:space-y-24">
          {reading.sections.map((section, index) => (
            <section
              key={`${index}-${section.title}`}
              className="relative break-inside-avoid border-t border-[#211B17] pt-6 md:grid md:grid-cols-[110px_1fr] md:gap-10"
            >
              <div className="flex items-end justify-between md:block">
                <p className="text-[58px] font-black leading-none tracking-[-0.08em] text-[#E44B3F] md:text-[72px]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="pb-1 text-[9px] font-black tracking-[0.26em] md:mt-3 md:pb-0">
                  読み解き
                </p>
              </div>
              <div className="mt-5 md:mt-0">
                <h2 className="max-w-[650px] text-balance text-[24px] font-black leading-[1.45] md:text-[32px]">
                  {section.title}
                </h2>
                <div className="mt-4 h-[4px] w-14 bg-[#D9473C]" />
                <p className="mt-7 whitespace-pre-line text-[15px] font-medium leading-[2.1] text-black/78 md:text-[16px] md:leading-[2.2]">
                  {section.body}
                </p>
              </div>
              <div aria-hidden="true" className="absolute -right-10 -top-6 h-16 w-16 rounded-full border-[13px] border-[#E44B3F]/10 md:-right-5 md:h-20 md:w-20 md:border-[17px]" />
            </section>
          ))}
        </div>

        <section className="relative mt-18 break-inside-avoid overflow-hidden border border-[#211B17] bg-[#E34A3E] px-7 py-10 text-[#1A1411] md:mt-24 md:px-12 md:py-14">
          <LanternOrb className="-right-20 -top-24 h-[240px] w-[240px] opacity-25" />
          <p className="relative text-[10px] font-black tracking-[0.26em]">
            結びの言葉
          </p>
          <p className="relative mt-6 whitespace-pre-line text-[16px] font-bold leading-[2.05] md:max-w-[680px] md:text-[18px]">
            {reading.closingMessage}
          </p>
          <div className="relative mt-9 flex items-end justify-between gap-6 border-t border-black/35 pt-6">
            <div>
              <p className="text-[9px] font-black tracking-[0.22em] text-black/55">
                あなたへ
              </p>
              <p className="mt-1 text-[25px] font-black tracking-[0.08em]">Alice</p>
            </div>
            <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full border-2 border-[#1B1512] bg-[#F4E3CC] text-[22px] font-black shadow-[6px_6px_0_#1B1512]">
              A
            </div>
          </div>
        </section>

        <footer className="mt-12 flex items-end justify-between gap-5 border-t border-[#211B17] pt-5">
          <div>
            <p className="text-[9px] font-black tracking-[0.24em] text-[#D9473C]">
              WATASHI NO TORISETSU
            </p>
            <p className="mt-1 text-[9px] font-bold tracking-[0.14em] text-black/55">
              PERSONAL PORTRAIT
            </p>
          </div>
          <div className="flex items-center gap-2" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#D9473C]" />
            <span className="h-3 w-3 rounded-full bg-[#D9473C]" />
            <span className="h-3 w-3 rounded-full bg-[#D9473C]" />
          </div>
        </footer>
      </div>
    </article>
  );
}
