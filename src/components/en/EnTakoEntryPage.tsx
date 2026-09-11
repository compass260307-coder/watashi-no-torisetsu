import Link from "next/link";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";

export default function EnTakoEntryPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <EnSiteHeader />
      <main className="flex flex-1 items-center bg-[#F4F1FF] px-5 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-6xl">👀</p>
          <p className="mt-6 text-sm font-extrabold uppercase tracking-[0.2em] text-[#5B5BEF]">
            Friend perspective
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-[#2E2E5C] sm:text-6xl">
            See yourself through your friends’ eyes
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#68687D]">
            First, complete your own personality test. You’ll get a private
            invitation link to share with friends and a side-by-side view as
            their answers arrive.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3">
            <Link
              href="/en/diagnosis"
              className="rounded-full bg-[#5B5BEF] px-9 py-4 font-bold text-white"
            >
              Take the free test
            </Link>
            <span className="text-sm text-[#77778D]">
              About 7–10 minutes · 50 questions
            </span>
          </div>
        </div>
      </main>
      <EnSiteFooter />
    </div>
  );
}
