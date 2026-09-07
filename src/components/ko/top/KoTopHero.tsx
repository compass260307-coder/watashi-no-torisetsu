import KoTopCta from "@/components/ko/top/KoTopCta";
import { KO_TOP_CONTENT } from "@/i18n/ko/top";

export default function KoTopHero() {
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/characters/keyvisual.webp"
        media="(min-width: 640px)"
      />
      <link
        rel="preload"
        as="image"
        href="/characters/keyvisual-mobile.webp"
        media="(max-width: 639px)"
      />

      <section className="top-hero-bg relative h-[178vw] w-full overflow-hidden sm:h-[61vw] sm:min-h-[78vh]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[5%]"
          style={{
            background:
              "linear-gradient(to bottom, #FFFFFF 0%, rgba(255,255,255,0.5) 55%, rgba(255,255,255,0) 100%)",
          }}
        />

        <div className="absolute inset-x-0 top-[14%] z-10 mx-auto w-full max-w-[1160px] px-6 text-center sm:top-[22%] lg:px-0">
          <h1 className="mb-2 text-[13px] font-bold text-white sm:mb-3 sm:text-[16px]">
            {KO_TOP_CONTENT.hero.brand}
          </h1>
          <p className="top-hero-h1 break-keep" role="heading" aria-level={2}>
            {KO_TOP_CONTENT.hero.title}
          </p>
          <p className="top-hero-sub mx-auto max-w-[720px] break-keep">
            {KO_TOP_CONTENT.hero.description}
          </p>
          <p className="mx-auto mt-2 max-w-[680px] break-keep text-[12px] leading-[1.75] text-white/90 sm:mt-3 sm:text-[15px]">
            {KO_TOP_CONTENT.hero.brandDescription}
          </p>
          <div className="top-hero-cta-wrap">
            <KoTopCta />
          </div>
        </div>
      </section>
    </>
  );
}
