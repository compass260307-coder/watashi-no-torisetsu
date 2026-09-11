import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EnFriendComparison from "@/components/en/EnFriendComparison";
import EnFriendInviteShare from "@/components/en/EnFriendInviteShare";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import { ResultViewTracker } from "@/components/result/ResultViewTracker";
import { EN_RESULT_TYPES } from "@/i18n/en/result";
import { loadOwnerReportData } from "@/lib/owner-report-data";
import { resolveSiteUrl } from "@/lib/site-url";

export default async function EnTakoResultPage({ token }: { token: string }) {
  const data = await loadOwnerReportData(token);
  if (!data) notFound();
  const displayName = data.user.display_name?.trim() || "You";
  const inviteUrl = `${resolveSiteUrl()}/en/friend/${encodeURIComponent(data.inviteCode)}`;
  const friendDisplayName = (name: string) =>
    name === "ともだち" ? "A friend" : name;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F8F7FF]">
      <PreferredLocaleSync ownerToken={token} locale="en" />
      <ResultViewTracker
        ownerToken={token}
        friendCount={data.friendEvalCount}
      />
      <EnSiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:py-16">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#5B5BEF]">
          Friend perspective
        </p>
        <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-black text-[#2E2E5C] sm:text-5xl">
              How friends see {displayName}
            </h1>
            <p className="mt-3 text-[#68687D]">
              {data.friendEvalCount === 0
                ? "Invite friends to reveal a new side of yourself."
                : `${data.friendEvalCount} ${data.friendEvalCount === 1 ? "friend has" : "friends have"} shared a perspective.`}
            </p>
          </div>
          <EnFriendInviteShare
            inviteUrl={inviteUrl}
            inviteCode={data.inviteCode}
          />
        </div>

        {data.friendAvgScores ? (
          <section className="mt-10 rounded-[28px] bg-white p-6 shadow-[0_16px_40px_rgba(46,46,92,0.08)] sm:p-9">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-[#2E2E5C]">
                Self-view vs. your friends’ average
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#68687D]">
                Differences are not good or bad—they show which parts of you are
                more visible to other people.
              </p>
            </div>
            <EnFriendComparison
              selfScores={data.selfScores}
              friendScores={data.friendAvgScores}
              friendLabel="Friends’ view"
            />
          </section>
        ) : (
          <section className="mt-10 rounded-[28px] border border-dashed border-[#5B5BEF]/35 bg-white p-10 text-center">
            <p className="text-5xl">🪞</p>
            <h2 className="mt-5 text-2xl font-black text-[#2E2E5C]">
              Your comparison will appear here
            </h2>
            <p className="mx-auto mt-3 max-w-lg leading-relaxed text-[#68687D]">
              One completed response is enough to start seeing how your
              self-image compares with a friend’s view.
            </p>
            <div className="mt-7 flex justify-center">
              <EnFriendInviteShare
                inviteUrl={inviteUrl}
                inviteCode={data.inviteCode}
              />
            </div>
          </section>
        )}

        {data.friendCharacter ? (
          <section className="mt-6 flex flex-col items-center gap-5 rounded-[28px] bg-[#2E2E5C] p-7 text-center text-white sm:flex-row sm:text-left">
            <Image
              src={data.friendCharacter.imageSrc}
              alt=""
              width={128}
              height={128}
              className="h-28 w-28 shrink-0 object-contain"
            />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DAD8FF]">
                Your friends’ combined impression
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {EN_RESULT_TYPES[data.friendCharacter.type32].name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                {EN_RESULT_TYPES[data.friendCharacter.type32].oneLiner}
              </p>
            </div>
          </section>
        ) : null}

        {data.friends.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl font-black text-[#2E2E5C]">
              Individual perspectives
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {data.friends.map((friend) => {
                const name = friendDisplayName(friend.name);
                return (
                  <Link
                    key={friend.perceptionId}
                    href={`/en/tako/${encodeURIComponent(token)}/friend/${encodeURIComponent(friend.perceptionId)}`}
                    className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {friend.perceivedImageSrc ? (
                      <Image
                        src={friend.perceivedImageSrc}
                        alt=""
                        width={64}
                        height={64}
                        className="h-16 w-16 object-contain"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EAE9FF] text-xl font-black text-[#5B5BEF]">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold text-[#2E2E5C]">
                        {name}
                      </p>
                      {friend.perceivedType32 ? (
                        <p className="mt-0.5 truncate text-xs text-[#77778D]">
                          {EN_RESULT_TYPES[friend.perceivedType32].name}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm font-bold text-[#5B5BEF]">
                        {friend.mutual}% in sync
                      </p>
                      {friend.message ? (
                        <p className="mt-1 truncate text-sm text-[#77778D]">
                          “{friend.message}”
                        </p>
                      ) : null}
                    </div>
                    <span aria-hidden="true" className="text-xl text-[#9A9AAF]">
                      ›
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
        <div className="mt-12 text-center">
          <Link
            href={`/en/me/${encodeURIComponent(token)}`}
            className="font-bold text-[#5B5BEF] underline underline-offset-4"
          >
            Back to my personality report
          </Link>
        </div>
      </main>
      <EnSiteFooter />
    </div>
  );
}
