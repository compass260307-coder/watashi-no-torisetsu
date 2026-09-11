import Link from "next/link";
import { notFound } from "next/navigation";
import EnResultShareButtons from "@/components/en/EnResultShareButtons";
import EnFullAccessCard from "@/components/en/EnFullAccessCard";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { ResultViewTracker } from "@/components/result/ResultViewTracker";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { enDetailedProfile, enScenarioLines } from "@/i18n/en/me";
import {
  EN_RESULT_AXES,
  EN_RESULT_COPY,
  EN_RESULT_TYPES,
} from "@/i18n/en/result";
import { SITE_URL } from "@/lib/locale-seo";
import { hasFullAccess } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sixteenTypes } from "@/lib/sixteen-types";
import {
  baseIdOf,
  classifyThirtyTwoType,
  nAxisOf,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

type StoredScores = Partial<Record<BigFiveDimension, number>>;

type EnMeResultPageProps = {
  token?: string;
  previewType?: ThirtyTwoTypeId;
  share?: { sharerName: string; inviteCode: string };
  paid?: boolean;
};

function scorePercent(score: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round((score ?? 5) * 10)));
}

function previewScores(
  typeId: ThirtyTwoTypeId,
): Record<BigFiveDimension, number> {
  const code = sixteenTypes[baseIdOf(typeId)].code;
  const value = (dimension: "O" | "C" | "E" | "A") =>
    code.includes(`${dimension}＋`) ? 8 : 2;
  return {
    O: value("O"),
    C: value("C"),
    E: value("E"),
    A: value("A"),
    N: nAxisOf(typeId) === "N" ? 8 : 2,
  };
}

function Chapter({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="mb-6 flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black"
          aria-hidden="true"
        >
          {number}
        </span>
        <h2 className="text-[29px] font-black leading-tight sm:text-[38px]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ProseCard({
  title,
  paragraphs,
  tone = "white",
}: {
  title?: string;
  paragraphs: string[];
  tone?: "white" | "lavender" | "yellow";
}) {
  const backgrounds = {
    white: "bg-white",
    lavender: "bg-[#F2F0FF]",
    yellow: "bg-[#FFF8D8]",
  };
  return (
    <div
      className={`rounded-[26px] border border-[#E3E6F5] p-6 shadow-[0_12px_36px_rgba(46,46,92,0.055)] sm:p-8 ${backgrounds[tone]}`}
    >
      {title ? (
        <h3 className="text-xl font-black sm:text-2xl">{title}</h3>
      ) : null}
      <div
        className={`${title ? "mt-4" : ""} space-y-4 text-[16px] leading-[1.85] text-[#41415F] sm:text-[17px]`}
      >
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

export default async function EnMeResultPage(props: EnMeResultPageProps) {
  const isPreview = props.previewType !== undefined;
  let scores: StoredScores;
  let displayName = "You";
  let typeId: ThirtyTwoTypeId;
  let friendCount = 0;
  let inviteCode: string | null = null;
  let fullAccessPaid = false;

  if (isPreview) {
    typeId = props.previewType!;
    scores = previewScores(typeId);
    displayName = props.share?.sharerName.trim() || "Someone";
  } else {
    if (!props.token) notFound();
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, scores, display_name, diagnosis_completed_at, invite_code")
      .eq("owner_token", props.token)
      .maybeSingle();
    if (error) console.error("[/en/me/[token]] users lookup error:", error);
    if (!data?.diagnosis_completed_at) notFound();
    scores = (data.scores ?? {}) as StoredScores;
    typeId = classifyThirtyTwoType(scores);
    displayName = data.display_name?.trim() || "You";
    inviteCode = data.invite_code?.trim() || null;
    const { count } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", data.id);
    friendCount = count ?? 0;
    fullAccessPaid = await hasFullAccess(data.id);
  }

  const type = EN_RESULT_TYPES[typeId];
  const profile = enDetailedProfile(typeId);
  const scenarios = enScenarioLines(scores);
  const shareUrl = inviteCode
    ? `${SITE_URL}/en/share/${encodeURIComponent(inviteCode)}`
    : `${SITE_URL}/en/preview/${typeId}`;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#F8F8FC] text-[#2E2E5C]">
      {!isPreview && props.token ? (
        <>
          <PreferredLocaleSync ownerToken={props.token} locale="en" />
          <ResultViewTracker
            ownerToken={props.token}
            friendCount={friendCount}
          />
          {props.paid && !fullAccessPaid ? (
            <PaidUnlockWatcher ownerToken={props.token} locale="en" />
          ) : null}
        </>
      ) : null}
      <EnSiteHeader />
      <main className="flex-1">
        <section className="overflow-hidden bg-white px-5 pb-14 pt-12 text-center sm:pb-20 sm:pt-16">
          <p className="text-sm font-extrabold tracking-[0.14em] text-[#5B5BEF]">
            {EN_RESULT_COPY.heroLabel.toUpperCase()}
          </p>
          <h1 className="mt-3 text-[38px] font-black leading-tight sm:text-[56px]">
            {type.name}
          </h1>
          <p className="mt-2 text-xl font-bold text-[#727287]">
            {type.essence} · {type.animal}
          </p>
          <SmoothImage
            src={thirtyTwoImagePath(typeId)}
            alt={type.name}
            width={720}
            height={720}
            priority
            className="mx-auto mt-4 h-auto w-full max-w-[440px]"
          />
          <p className="mx-auto mt-1 max-w-2xl text-[19px] font-semibold leading-relaxed text-[#51516E]">
            {isPreview
              ? props.share
                ? `${displayName} has this type. ${type.oneLiner.replace(/^You /, "People with this type ")}`
                : type.oneLiner
              : `${displayName}, ${type.oneLiner.charAt(0).toLowerCase()}${type.oneLiner.slice(1)}`}
          </p>
          <p className="mt-4 inline-flex rounded-full bg-[#F2F0FF] px-4 py-2 text-sm font-extrabold text-[#5B5BEF]">
            {profile.temperamentLabel}
          </p>
        </section>

        <div className="mx-auto max-w-[900px] px-5 pb-20 sm:px-8 sm:pb-28">
          <Chapter number={1} title="Your core pattern">
            <ProseCard paragraphs={[profile.core, profile.temperamentCore]} />
          </Chapter>

          <Chapter number={2} title={EN_RESULT_COPY.axesTitle}>
            <p className="mb-7 max-w-3xl text-[16px] leading-relaxed text-[#727287]">
              {EN_RESULT_COPY.axesDescription}
            </p>
            <div className="space-y-7 rounded-[26px] border border-[#E3E6F5] bg-white p-5 shadow-[0_12px_36px_rgba(46,46,92,0.055)] sm:p-8">
              {EN_RESULT_AXES.map((axis) => {
                const value = scorePercent(scores[axis.dim]);
                return (
                  <div key={axis.dim}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="font-extrabold">{axis.title}</h3>
                      <span
                        className="font-black tabular-nums"
                        style={{ color: axis.color }}
                      >
                        {value}%
                      </span>
                    </div>
                    <div
                      className="relative h-4 overflow-hidden rounded-full"
                      style={{ background: `${axis.color}2E` }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${value}%`, background: axis.color }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs font-bold text-[#2E2E5C]/55">
                      <span>{axis.left}</span>
                      <span>{axis.right}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#727287]">
                      {value >= 50 ? axis.highDescription : axis.lowDescription}
                    </p>
                  </div>
                );
              })}
            </div>
          </Chapter>

          <Chapter number={3} title="The strengths you bring">
            <ProseCard
              title="Your signature strength"
              paragraphs={[profile.strength, profile.temperamentStrength]}
              tone="yellow"
            />
          </Chapter>
          <Chapter number={4} title="How you tend to love">
            <ProseCard paragraphs={[profile.love]} tone="lavender" />
          </Chapter>
          <Chapter number={5} title="Work, purpose, and growth">
            <div className="grid gap-5 md:grid-cols-2">
              <ProseCard
                title="Where you can thrive"
                paragraphs={[profile.career]}
              />
              <ProseCard
                title="Your next edge"
                paragraphs={[profile.growth, profile.temperamentGrowth]}
              />
            </div>
          </Chapter>
          <Chapter number={6} title="You in everyday moments">
            <ol className="grid gap-4 sm:grid-cols-2">
              {scenarios.map((scenario, index) => (
                <li
                  key={scenario}
                  className="rounded-[22px] border border-[#E3E6F5] bg-white p-5 text-[15px] leading-[1.75] text-[#41415F] shadow-[0_8px_24px_rgba(46,46,92,0.045)]"
                >
                  <span className="mb-3 block text-xs font-black tracking-[0.12em] text-[#5B5BEF]">
                    MOMENT {index + 1}
                  </span>
                  {scenario}
                </li>
              ))}
            </ol>
          </Chapter>
          <Chapter number={7} title="Handle with care">
            <div className="space-y-5">
              <ProseCard
                title="A pattern to watch"
                paragraphs={[profile.caution, profile.temperamentCaution]}
                tone="yellow"
              />
              <ProseCard
                title="People who bring out your best"
                paragraphs={[profile.connection]}
                tone="lavender"
              />
            </div>
          </Chapter>

          {!props.share ? (
            <section className="mt-20 rounded-[30px] bg-white px-6 py-10 text-center shadow-[0_16px_50px_rgba(46,46,92,0.08)] sm:px-10 sm:py-12">
              <h2 className="text-[27px] font-black sm:text-[34px]">
                Share your character
              </h2>
              <p className="mx-auto mb-7 mt-3 max-w-xl leading-relaxed text-[#727287]">
                Your public link shows your display name and personality type.
                It never includes your scores or private result token.
              </p>
              <EnResultShareButtons shareUrl={shareUrl} typeName={type.name} />
            </section>
          ) : null}

          {!isPreview && props.token ? (
            <section className="mt-7 rounded-[30px] bg-[#F2F0FF] px-6 py-10 text-center sm:px-10">
              <p className="text-4xl">👀</p>
              <h2 className="mt-4 text-[27px] font-black sm:text-[34px]">
                See yourself through your friends’ eyes
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[#727287]">
                Invite friends to answer 30 quick questions, then compare their
                perspective with your own.
              </p>
              <Link
                href={`/en/tako/${encodeURIComponent(props.token)}`}
                className="mt-7 inline-block rounded-full bg-[#5B5BEF] px-8 py-4 font-bold text-white"
              >
                {friendCount > 0
                  ? `View ${friendCount} friend ${friendCount === 1 ? "perspective" : "perspectives"}`
                  : "Invite a friend"}
              </Link>
            </section>
          ) : null}

          {!isPreview && props.token ? (
            <EnFullAccessCard ownerToken={props.token} purchased={fullAccessPaid} />
          ) : null}

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/en/diagnosis"
              prefetch={false}
              className="sora-cta rounded-full px-7 py-4 text-center font-bold"
            >
              {isPreview ? "Take the free test" : EN_RESULT_COPY.restart}
            </Link>
            <Link
              href="/en/types"
              prefetch={false}
              className="rounded-full border-2 border-[#5B5BEF] bg-white px-7 py-4 text-center font-bold text-[#5B5BEF]"
            >
              {EN_RESULT_COPY.allTypes}
            </Link>
          </div>
        </div>
      </main>
      <EnSiteFooter />
    </div>
  );
}
