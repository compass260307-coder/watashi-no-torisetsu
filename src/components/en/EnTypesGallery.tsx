import Link from "next/link";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { EN_RESULT_TYPES } from "@/i18n/en/result";
import { allThirtyTwoTypeIds, thirtyTwoGroup, thirtyTwoImagePath } from "@/lib/thirty-two-types";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

const groups: { key: ThirtyTwoGroup; name: string; description: string; color: string }[] = [
  { key: "sea", name: "Sea", description: "People-centered types who connect, support, and bring others together.", color: "#BEF2F9" },
  { key: "land", name: "Land", description: "Grounded types who build trust through care, consistency, and action.", color: "#D8F2C0" },
  { key: "sky", name: "Sky", description: "Imaginative types who explore ideas and see possibilities from above.", color: "#FDEFB4" },
  { key: "unknown", name: "Beyond", description: "Independent types who follow an inner compass into new territory.", color: "#E7DCFB" },
];

export default function EnTypesGallery() {
  const ids = allThirtyTwoTypeIds();
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-white text-[#2E2E5C]">
      <EnSiteHeader />
      <main className="flex-1">
        <header className="mx-auto max-w-[900px] px-5 py-14 text-center sm:py-20">
          <p className="text-sm font-extrabold tracking-[0.14em] text-[#5B5BEF]">OCEAN · BIG FIVE</p>
          <h1 className="mt-3 text-[40px] font-black sm:text-[58px]">32 personality types</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#727287]">Five personality dimensions combine into 32 distinct characters. Find the one that feels most like you.</p>
          <Link href="/en/diagnosis" prefetch={false} className="sora-cta mt-8 inline-block rounded-full px-10 py-4 text-lg font-bold">Take the free test →</Link>
        </header>
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`en-group-${group.key}`} className="px-5 py-14 sm:px-8" style={{ backgroundColor: group.color }}>
            <div className="mx-auto max-w-[1200px]">
              <h2 id={`en-group-${group.key}`} className="text-[34px] font-black sm:text-[46px]">{group.name}</h2>
              <p className="mt-2 max-w-2xl text-[#51516E]">{group.description}</p>
              <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {ids.filter((id) => thirtyTwoGroup(id) === group.key).map((id) => {
                  const type = EN_RESULT_TYPES[id];
                  return (
                    <Link href={`/en/preview/${id}`} key={id} className="group rounded-[24px] bg-white/85 p-4 text-center shadow-[0_10px_30px_rgba(46,46,92,0.08)] transition-transform hover:-translate-y-1" aria-label={`Read the full ${type.name} profile`}>
                      <SmoothImage src={thirtyTwoImagePath(id)} alt={type.name} width={480} height={480} className="mx-auto h-auto w-full" />
                      <h3 className="mt-2 text-2xl font-black">{type.name}</h3>
                      <p className="mt-1 font-bold text-[#5B5BEF]">{type.essence}</p>
                      <p className="mt-3 text-sm leading-relaxed text-[#727287]">{type.oneLiner}</p>
                      <span className="mt-4 inline-block text-sm font-extrabold text-[#5B5BEF] group-hover:underline">Read full profile →</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </main>
      <EnSiteFooter />
    </div>
  );
}
