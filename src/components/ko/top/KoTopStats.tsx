import { KO_TOP_CONTENT } from "@/i18n/ko/top";

export default function KoTopStats() {
  return (
    <section className="w-full bg-white px-8 py-16 md:py-20">
      <h2 className="sr-only">진단 실적</h2>
      <div className="mx-auto grid max-w-[1680px] grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
        {KO_TOP_CONTENT.stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div
              className="font-bold"
              style={{
                color: stat.color,
                fontSize: "clamp(40px, 4.2vw, 68px)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              {stat.value}
            </div>
            <div className="mt-3 text-[17px] leading-snug text-[#8A8AA3]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
