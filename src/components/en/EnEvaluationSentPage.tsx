import Link from "next/link";
import EnFriendComparison from "@/components/en/EnFriendComparison";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import type { BigFiveScores } from "@/lib/perception-analysis";

export default function EnEvaluationSentPage({
  targetName,
  understanding,
  selfScores,
  friendScores,
  diagnoseHref,
}: {
  targetName: string;
  understanding: number;
  selfScores: BigFiveScores;
  friendScores: BigFiveScores;
  diagnoseHref: string;
}) {
  const name = targetName || "your friend";
  return (
    <div className="flex min-h-dvh flex-col bg-[#F8F7FF]">
      <EnSiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
        <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_50px_rgba(46,46,92,0.10)] sm:p-10">
          <div className="text-center">
            <p className="text-5xl">💌</p>
            <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.18em] text-[#5B5BEF]">
              Answers sent
            </p>
            <h1 className="mt-3 text-3xl font-black text-[#2E2E5C] sm:text-4xl">
              Here’s how closely your view matches {name}’s self-image
            </h1>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[#68687D]">
              Your answers are now part of their private friend-perspective
              report.
            </p>
          </div>
          <div className="mx-auto my-10 flex h-40 w-40 flex-col items-center justify-center rounded-full border-[12px] border-[#E8E7FF] bg-[#F7F6FF] text-[#2E2E5C]">
            <span className="text-5xl font-black">{understanding}%</span>
            <span className="mt-1 text-xs font-bold uppercase tracking-wide">
              in sync
            </span>
          </div>
          <EnFriendComparison
            selfScores={selfScores}
            friendScores={friendScores}
            friendLabel="Your view"
          />
          <div className="mt-10 rounded-2xl bg-[#FFF7D9] p-6 text-center">
            <h2 className="text-xl font-extrabold text-[#2E2E5C]">
              Curious how others see you?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#68687D]">
              Take your own free test, then invite friends to describe you.
            </p>
            <Link
              href={diagnoseHref}
              className="mt-5 inline-block rounded-full bg-[#5B5BEF] px-8 py-4 font-bold text-white"
            >
              Discover my personality
            </Link>
          </div>
        </div>
      </main>
      <EnSiteFooter />
    </div>
  );
}
