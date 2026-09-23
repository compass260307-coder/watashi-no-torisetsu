import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import { LockedInviteShare } from "@/components/result/LockedInviteShare";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import { JohariWindow } from "@/components/result/JohariWindow";
import { MeStickyHeader } from "@/components/result/MeStickyHeader";
import { sceneImageFor } from "@/components/result/MinnaTypeProse";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { PaywallModal } from "@/components/result/PaywallModal";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import { ResultHero } from "@/components/result/ResultHero";
import { TakoFaq } from "@/components/result/TakoFaq";
import { TakoFriendTabs } from "@/components/result/TakoFriendTabs";
import { TakoLockedBlock } from "@/components/result/TakoLockedBlock";
import { TakoViewTracker } from "@/components/result/TakoViewTracker";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { UNOPTIMIZED_IN_DEV } from "@/lib/image-delivery";
import { EN_RESULT_AXES, EN_RESULT_TYPES } from "@/i18n/en/result";
import {
  buildEnDeepDiveSections,
  buildEnPartTwo,
  buildEnSelfSections,
} from "@/i18n/en/me";
import { preferCutImage, preferFaceImage } from "@/lib/character-image";
import { hasTakoAccess } from "@/lib/entitlements";
import { enFriendInsights } from "@/lib/en-friend-insights";
import { heroColorsForGroup } from "@/lib/hero-colors";
import { loadOwnerReportData } from "@/lib/owner-report-data";
import {
  createMetaPurchaseClaimToken,
  verifyPaidFullAccessCheckoutSession,
} from "@/lib/paid-checkout-session";
import { buildDimensionGaps } from "@/lib/perception-analysis";
import { resolveSiteUrl } from "@/lib/site-url";
import {
  classifyThirtyTwoType,
  thirtyTwoGroup,
  thirtyTwoImagePath,
} from "@/lib/thirty-two-types";

const UNDERSTANDING_RESULTS = [
  { score: 0, image: "/result/understanding/understanding-0-transparent.webp" },
  { score: 8, image: "/result/understanding/understanding-8-transparent.webp" },
  { score: 16, image: "/result/understanding/understanding-16-transparent.webp" },
  { score: 24, image: "/result/understanding/understanding-24-transparent.webp" },
  { score: 32, image: "/result/understanding/understanding-32-transparent.webp" },
  { score: 41, image: "/result/understanding/understanding-41-transparent.webp" },
  { score: 48, image: "/result/understanding/understanding-48-transparent.webp" },
  { score: 54, image: "/result/understanding/understanding-54-transparent.webp" },
  { score: 60, image: "/result/understanding/understanding-60-transparent.webp" },
  { score: 65, image: "/result/understanding/understanding-65-transparent.webp" },
  { score: 73, image: "/result/understanding/understanding-73-transparent.webp" },
  { score: 82, image: "/result/understanding/understanding-82-transparent.webp" },
  { score: 89, image: "/result/understanding/understanding-89-transparent.webp" },
  { score: 96, image: "/result/understanding/understanding-96-transparent.webp" },
  { score: 98, image: "/result/understanding/understanding-98-transparent.webp" },
  { score: 99, image: "/result/understanding/understanding-99-transparent.webp" },
  { score: 100, image: "/result/understanding/understanding-100-gold-transparent.webp" },
] as const;

function understandingResultFor(score: number) {
  return UNDERSTANDING_RESULTS.reduce((nearest, candidate) =>
    Math.abs(candidate.score - score) < Math.abs(nearest.score - score)
      ? candidate
      : nearest,
  );
}

function NumberedSection({
  number,
  title,
  children,
  className = "mb-14",
}: {
  number: number;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
        >
          {number}
        </span>
        <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function GuidanceList({
  items,
  warning = false,
}: {
  items: { title: string; body: string }[];
  warning?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
      {items.map((item) => (
        <div key={`${item.title}-${item.body}`}>
          <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
            <span
              aria-hidden="true"
              className={
                warning
                  ? "flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#F2C14E]"
                  : "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#4CAF7D] text-[#4CAF7D]"
              }
            >
              {warning ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ) : (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
            {item.title}
          </p>
          <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export default async function EnTakoResultPage({
  token,
  paid = false,
  sessionId,
}: {
  token: string;
  paid?: boolean;
  sessionId?: string | string[];
}) {
  const [data, paidCheckoutSession] = await Promise.all([
    loadOwnerReportData(token),
    paid
      ? verifyPaidFullAccessCheckoutSession(sessionId)
      : Promise.resolve(null),
  ]);
  if (!data) notFound();

  const purchased = await hasTakoAccess(data.user.id);
  const shouldTrackMetaPurchase =
    paidCheckoutSession?.userId === (data.user.id as string);
  const metaPurchaseClaimToken =
    shouldTrackMetaPurchase && paidCheckoutSession
      ? createMetaPurchaseClaimToken(paidCheckoutSession.id)
      : null;
  const paidAccessProduct =
    paidCheckoutSession?.product === "premium_bundle"
      ? "premium_bundle"
      : paidCheckoutSession?.product === "full_access"
        ? "full_access"
        : "self_report";
  const inviteUrl = `${resolveSiteUrl()}/en/friend/${encodeURIComponent(data.inviteCode)}`;
  const qrImageSrc = data.ownerType32
    ? preferFaceImage(thirtyTwoImagePath(data.ownerType32))
    : null;
  const hasLockedResults = !purchased && data.friends.length > 1;
  const promoType = data.friends[0]?.perceivedType32 ?? data.ownerType32;
  const promoGroup = promoType ? thirtyTwoGroup(promoType) : "unknown";
  const promoImage = promoType
    ? sceneImageFor(promoType, "love") ??
      sceneImageFor(promoType, "normal1") ??
      preferCutImage(thirtyTwoImagePath(promoType))
    : undefined;
  const promoAlt = promoType ? EN_RESULT_TYPES[promoType].essence : "";
  const friendName = (name: string) =>
    name.trim() && name !== "ともだち" ? name.trim() : "A friend";

  const invitePanel = (
    <LockedInviteShare
      inviteUrl={inviteUrl}
      trackSource={data.friends.length === 0 ? "tako_empty" : "tako_unlocked"}
      ownerToken={token}
      inviteCode={data.inviteCode}
      compact
      deferQr
      locale="en"
      qrImageSrc={qrImageSrc}
    />
  );

  const tabs = data.friends.map((friend, index) => ({
    perceptionId: friend.perceptionId,
    name: friendName(friend.name),
    imageSrc: preferFaceImage(
      thirtyTwoImagePath(
        friend.perceivedType32 ?? classifyThirtyTwoType(friend.perceivedScores),
      ),
    ),
    message: friend.message,
    locked: !purchased && index > 0,
  }));

  const panels = data.friends.map((friend, index) => {
    const viewer = friendName(friend.name);
    if (!purchased && index > 0) {
      return (
        <div key={friend.perceptionId}>
        <section className="mb-14 mt-10">
          <h2 className="mb-2 text-center text-[24px] font-black leading-tight text-[#2E2E5C] md:text-[30px]">
            How {viewer} sees you
          </h2>
          <p className="mx-auto mb-8 max-w-[440px] text-center text-[13px] font-bold leading-[1.75] text-[#8A8AA3]">
            {viewer}&apos;s answers have arrived. The Complete Edition unlocks every result from your second friend onward.
          </p>
          <TakoLockedBlock
            source="tako_sheet_lock"
            description={`The Complete Edition unlocks the character ${viewer} sees, your personality gaps, relationship style, compatibility, and the rest of this result sheet.`}
            locale="en"
          />
        </section>
        </div>
      );
    }

    const type32 =
      friend.perceivedType32 ?? classifyThirtyTwoType(friend.perceivedScores);
    const type = EN_RESULT_TYPES[type32];
    const hero = heroColorsForGroup(thirtyTwoGroup(type32));
    const result = understandingResultFor(friend.mutual);
    const insights = enFriendInsights(data.selfScores, friend);
    const gaps = buildDimensionGaps(data.selfScores, friend.perceivedScores);
    const largestGap = [...gaps].sort((a, b) => b.diffPoints - a.diffPoints)[0];
    const largestGapAxis = EN_RESULT_AXES.find(
      (axis) => axis.dim === largestGap?.key,
    );
    const smallestGap = [...gaps].sort(
      (a, b) => a.diffPoints - b.diffPoints,
    )[0];
    const smallestGapAxis = EN_RESULT_AXES.find(
      (axis) => axis.dim === smallestGap?.key,
    );
    const selfSections = buildEnSelfSections(type32, friend.perceivedScores);
    const narrativeParas = (selfSections[0]?.body ?? type.oneLiner)
      .split("\n\n")
      .filter(Boolean);
    const loveSection = buildEnDeepDiveSections(
      type32,
      friend.perceivedScores,
      true,
    ).find((section) => section.key === "love");
    const loveParas = (loveSection?.blocks ?? [])
      .flatMap((block) => block.body.split("\n\n"))
      .filter(Boolean)
      .slice(0, 3);
    const partTwo = buildEnPartTwo(type32, friend.perceivedScores, true);
    const concernItems = (partTwo.dislikable ?? []).slice(0, 6);
    const deepen = [
      ...(partTwo.weapons ?? []),
      ...(partTwo.relations ?? []).map((item) => ({
        title: item.relation,
        body: item.body,
      })),
    ].slice(0, 8);
    const avoid = [
      ...(partTwo.sceneCautions ?? []).map((item) => ({
        title: item.scene,
        body: item.body,
      })),
      ...(partTwo.relations ?? []).map((item) => ({
        title: `${item.relation}: avoid assumptions`,
        body: `Check expectations directly instead of assuming you both read the situation the same way. ${item.body}`,
      })),
    ].slice(0, 8);
    const compatibilityPercent = Math.max(
      40,
      Math.min(95, Math.round(40 + friend.mutual * 0.55)),
    );
    const compatibilityRank =
      compatibilityPercent >= 85
        ? "S"
        : compatibilityPercent >= 70
          ? "A"
          : compatibilityPercent >= 55
            ? "B"
            : "C";
    const introImage = sceneImageFor(type32, "normal1");
    const loveImage = sceneImageFor(type32, "love");
    const compatibilityParas = [
      insights.compatibility,
      largestGap && largestGapAxis
        ? `The greatest difference is in ${largestGapAxis.title.toLowerCase()}. That contrast can create misunderstandings, but it can also help each of you notice something the other naturally misses.`
        : null,
      smallestGap && smallestGapAxis
        ? `Your clearest shared ground is ${smallestGapAxis.title.toLowerCase()}. Because your answers are close here, this part of the relationship is likely to feel easier to understand without much explanation.`
        : null,
      `Compatibility is not a verdict on the relationship. It shows where you and ${viewer} can rely on shared instincts and where a direct conversation will help most.`,
    ].filter((paragraph): paragraph is string => Boolean(paragraph));

    return (
      <div key={friend.perceptionId}>
        <ResultHero
          label={`How ${viewer} sees you:`}
          essence={type.essence}
          scores={friend.perceivedScores}
          heroBg={hero.heroBg}
          codeTint={hero.codeTint}
          imageSrc={
            friend.perceivedImageSrc ??
            preferCutImage(thirtyTwoImagePath(type32))
          }
          alt={type.essence}
          name={type.name}
          locale="en"
        />

        <NumberedSection
          number={1}
          title={`How well ${viewer} understands you`}
          className="mb-6 mt-10"
        >
          <div
            className="relative overflow-hidden rounded-3xl"
            style={{
              background: "linear-gradient(105deg, #FAD3E3 0%, #F8C9DC 100%)",
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[160px]"
              style={{
                background:
                  "radial-gradient(ellipse at top center, rgba(255,255,255,0.28) 0%, transparent 60%)",
              }}
            />
            <div className="relative flex flex-col items-center px-4 pb-8 pt-3 md:px-6 md:pb-9 md:pt-5">
              <SmoothImage
                src={result.image}
                alt={`${result.score}% perspective match`}
                width={1448}
                height={1086}
                unoptimized={UNOPTIMIZED_IN_DEV}
                className="h-auto w-full max-w-[640px] object-contain"
              />
              <p className="mt-3 max-w-[760px] text-center text-[12px] font-bold text-white">
                Your perspectives are {result.score}% aligned, based on the difference between {viewer}&apos;s answers and your self-assessment.
              </p>
            </div>
          </div>
        </NumberedSection>

        <section className="mb-14">
          <div className="flex flex-col gap-10">
            <div>
              {narrativeParas.slice(0, 2).map((paragraph, paragraphIndex) => (
                <p
                  key={`${friend.perceptionId}-intro-${paragraphIndex}`}
                  className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
                >
                  {paragraphIndex === 0
                    ? `Through ${viewer}'s eyes, ${paragraph.charAt(0).toLowerCase()}${paragraph.slice(1)}`
                    : paragraph}
                </p>
              ))}
              {introImage ? (
                <SmoothImage
                  src={introImage}
                  alt=""
                  width={960}
                  height={640}
                  className="mx-auto my-8 h-auto w-full max-w-[560px] md:max-w-[760px]"
                />
              ) : null}

              <div className="my-10">
                <div className="mb-4 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                  >
                    2
                  </span>
                  <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                    Gaps across five personality traits
                  </h2>
                </div>
                {largestGap && largestGapAxis ? (
                  <div className="mb-4 rounded-3xl bg-[#F4F4FE] px-6 py-7">
                    <p className="text-[#2E2E5C] font-black text-[22px] leading-[1.35] md:text-[26px]">
                      The biggest gap is {largestGapAxis.title.toLowerCase()}. You rated yourself at{" "}
                      <span className="text-[#5B5BEF]">{largestGap.selfPercent}%</span>, while {viewer} saw{" "}
                      <span className="text-[#5B5BEF]">{largestGap.otherPercent}%</span>.
                    </p>
                  </div>
                ) : null}
                <BigFiveDivergingBars
                  scores={friend.perceivedScores}
                  friendScores={data.selfScores}
                  primaryLabel={`${viewer}'s view`}
                  friendLabel="Self-assessment"
                  hideHeading
                  locale="en"
                />
              </div>

              {narrativeParas.slice(2).map((paragraph, paragraphIndex) => (
                <p
                  key={`${friend.perceptionId}-outro-${paragraphIndex}`}
                  className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
                >
                  {paragraphIndex === 0
                    ? `${insights.axis} ${paragraph}`
                    : paragraph}
                </p>
              ))}
            </div>

            <section>
              <div className="mb-4 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                >
                  3
                </span>
                <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                  Your relationship style through {viewer}&apos;s eyes
                </h2>
              </div>
              {loveImage ? (
                <SmoothImage
                  src={loveImage}
                  alt=""
                  width={960}
                  height={640}
                  className="mx-auto mb-6 h-auto w-full max-w-[560px] md:max-w-[760px]"
                />
              ) : null}
              <div className="mb-10">
                {(loveParas.length > 0 ? loveParas : [insights.love]).map(
                  (paragraph, paragraphIndex) => (
                    <p
                      key={`${friend.perceptionId}-love-${paragraphIndex}`}
                      className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
                    >
                      {paragraphIndex === 0
                        ? `Through ${viewer}'s eyes, ${paragraph.charAt(0).toLowerCase()}${paragraph.slice(1)}`
                        : paragraph}
                    </p>
                  ),
                )}
              </div>
            </section>
          </div>
        </section>

        <NumberedSection number={4} title={`Your compatibility with ${viewer}`}>
          <div className="flex flex-col gap-10">
          <div
            className="relative overflow-hidden rounded-3xl"
            style={{
              background: "linear-gradient(105deg, #FAD3E3 0%, #F8C9DC 100%)",
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[160px]"
              style={{
                background:
                  "radial-gradient(ellipse at top center, rgba(255,255,255,0.28) 0%, transparent 60%)",
              }}
            />
            <div className="relative flex flex-col items-center px-4 pt-7 pb-6 text-center">
              <SmoothImage
                src={`/aisho/ranks/${compatibilityRank}.webp`}
                alt={`Compatibility rank ${compatibilityRank}`}
                width={512}
                height={512}
                unoptimized={UNOPTIMIZED_IN_DEV}
                className="mt-3 w-full max-w-[560px] object-contain md:max-w-[640px]"
              />
              <p className="mt-3 text-[12px] font-bold text-white">
                Compatibility is {compatibilityPercent}%, estimated from the gap between {viewer}&apos;s answers and your self-assessment.
              </p>
            </div>
          </div>

          <div>
            {compatibilityParas.map((paragraph, paragraphIndex) => (
              <p
                key={`${friend.perceptionId}-compatibility-${paragraphIndex}`}
                className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div>
            <h3 className="mb-5 text-[22px] font-black leading-snug text-[#2E2E5C] md:text-[26px]">
              Could {viewer} secretly dislike me?
            </h3>
            <div className="mb-6 rounded-3xl bg-[#F4F4FE] px-6 py-6">
              <p className="mb-2 text-[18px] font-black leading-[1.5] text-[#2E2E5C] md:text-[20px]">
                Probably not.
              </p>
              <p className="body-gothic text-[15px] leading-[1.7] text-[#1A1A1A]">
                {viewer} took the time to answer every question about you. People rarely do that for someone they feel nothing about. The differences here are conversation clues, not rejection.
              </p>
            </div>
            <p className="body-gothic mb-6 text-[15px] font-normal leading-[1.6] text-[#1A1A1A]">
              Still, there may be moments when {viewer} feels a little distant. These are the patterns most worth noticing.
            </p>
            <GuidanceList items={concernItems} warning />
          </div>

          <div>
            <h3 className="mb-5 text-[22px] font-black leading-snug text-[#2E2E5C] md:text-[26px]">
              How to deepen the relationship—and what to avoid
            </h3>
            <div className="flex flex-col gap-8">
              <div>
                <GuidanceList items={deepen} />
              </div>
              <div>
                <GuidanceList items={avoid} warning />
              </div>
            </div>
          </div>
          </div>
        </NumberedSection>

        <NumberedSection number={5} title="The Johari Window you create together">
          <p className="body-gothic mb-6 text-[15px] font-normal leading-[1.6] text-[#1A1A1A]">
            Your self-assessment and {viewer}&apos;s answers are combined into four windows: what you both see, what only your friend sees, what you keep private, and what neither of you has discovered yet.
          </p>
          <JohariWindow
            selfScores={data.selfScores}
            friendScores={friend.perceivedScores}
            viewer={viewer}
            locked={false}
            locale="en"
          />
        </NumberedSection>
      </div>
    );
  });

  const takoPromo = purchased || data.friends.length === 1 ? null : (
    <>
      <div id="tako-promo" className="scroll-mt-16">
        <FullAccessPromoCard
          surface="tako"
          ownerToken={token}
          returnTo="tako"
          products={["full_access", "premium_bundle"]}
          imageSrc={promoImage}
          reportCharacterImageSrc={
            promoType ? thirtyTwoImagePath(promoType) : undefined
          }
          imageAlt={promoAlt}
          group={promoGroup}
          locale="en"
        />
      </div>
      <PaywallModal
        surface="tako"
        ownerToken={token}
        returnTo="tako"
        products={["full_access", "premium_bundle"]}
        imageSrc={promoImage}
        reportCharacterImageSrc={
          promoType ? thirtyTwoImagePath(promoType) : undefined
        }
        imageAlt={promoAlt}
        group={promoGroup}
        locale="en"
      />
    </>
  );

  return (
    <div className="min-h-dvh bg-white">
      {shouldTrackMetaPurchase &&
      paidCheckoutSession &&
      metaPurchaseClaimToken ? (
        <MetaPurchaseDataLayer
          checkoutSessionId={paidCheckoutSession.id}
          product={paidCheckoutSession.product}
          claimToken={metaPurchaseClaimToken}
        />
      ) : null}
      <PreferredLocaleSync ownerToken={token} locale="en" />
      <TakoViewTracker
        ownerToken={token}
        inviteCode={data.inviteCode}
      />
      {paid && !purchased ? (
        <PaidUnlockWatcher
          ownerToken={token}
          locale="en"
          returnTo="tako"
          product={paidAccessProduct}
        />
      ) : null}
      <MeStickyHeader
        showUnlockCta={hasLockedResults}
        unlockCtaLabel="Unlock all results"
        shareUrl={data.friends.length > 0 ? inviteUrl : undefined}
        shareKind="invite"
        ownerToken={token}
        inviteCode={data.inviteCode}
        qrImageSrc={qrImageSrc}
        paywallTargetId="tako-promo"
        reportHref={
          purchased && data.friends.length > 0
            ? `/en/tako-report/${encodeURIComponent(token)}/pdf`
            : undefined
        }
        reportLabel="Download complete report"
        locale="en"
      >
        <EnSiteHeader />
      </MeStickyHeader>

      <main
        className={`relative overflow-x-clip px-4 md:px-8 ${
          data.friends.length === 0 ? "pb-0" : "min-h-dvh pb-8"
        }`}
        style={{ background: "#FFFFFF" }}
      >
        <div className="relative z-10">
          <div className="mx-auto max-w-[1080px]">
            <TakoFriendTabs
              tabs={tabs}
              panels={panels}
              invitePanel={invitePanel}
              locale="en"
            />
          </div>
        </div>
      </main>

      {data.friends.length === 0 ? <TakoFaq locale="en" /> : null}
      {takoPromo}
      <EnSiteFooter />
    </div>
  );
}
