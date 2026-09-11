import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EnFriendComparison from "@/components/en/EnFriendComparison";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { EN_RESULT_TYPES } from "@/i18n/en/result";
import { loadOwnerReportData } from "@/lib/owner-report-data";

export default async function EnFriendIndividualPage({
  token,
  perceptionId,
}: {
  token: string;
  perceptionId: string;
}) {
  const data = await loadOwnerReportData(token);
  if (!data) notFound();
  const friend = data.friends.find(
    (item) => item.perceptionId === perceptionId,
  );
  if (!friend) notFound();
  const displayName = data.user.display_name?.trim() || "you";
  const friendName = friend.name === "ともだち" ? "A friend" : friend.name;
  const perceivedType = friend.perceivedType32
    ? EN_RESULT_TYPES[friend.perceivedType32]
    : null;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F8F7FF]">
      <EnSiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
        <Link
          href={`/en/tako/${encodeURIComponent(token)}`}
          className="text-sm font-bold text-[#5B5BEF]"
        >
          ← All friend perspectives
        </Link>
        <div className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_16px_40px_rgba(46,46,92,0.08)] sm:p-10">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#5B5BEF]">
            {friendName}’s perspective
          </p>
          <h1 className="mt-3 text-3xl font-black text-[#2E2E5C] sm:text-4xl">
            You are {friend.mutual}% in sync
          </h1>
          {perceivedType ? (
            <div className="mt-6 flex items-center gap-4 rounded-2xl bg-[#F2F0FF] p-4">
              {friend.perceivedImageSrc ? (
                <Image
                  src={friend.perceivedImageSrc}
                  alt=""
                  width={80}
                  height={80}
                  className="h-20 w-20 object-contain"
                />
              ) : null}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#5B5BEF]">
                  How you came across
                </p>
                <p className="mt-1 text-xl font-black text-[#2E2E5C]">
                  {perceivedType.name}
                </p>
              </div>
            </div>
          ) : null}
          <p className="mt-5 leading-relaxed text-[#68687D]">
            This compares how {displayName} described themselves with how{" "}
            {friendName} described them.
          </p>
          <div className="mt-9">
            <EnFriendComparison
              selfScores={data.selfScores}
              friendScores={friend.perceivedScores}
              friendLabel={friendName}
            />
          </div>
          {friend.message ? (
            <blockquote className="mt-10 rounded-2xl bg-[#FFF7D9] p-6">
              <p className="text-sm font-bold text-[#8A6A00]">
                A note from {friendName}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-[#2E2E5C]">
                “{friend.message}”
              </p>
            </blockquote>
          ) : null}
        </div>
      </main>
      <EnSiteFooter />
    </div>
  );
}
