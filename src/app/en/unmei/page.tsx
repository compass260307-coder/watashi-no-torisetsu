import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import EnUnmeiLanding from "@/components/en/EnUnmeiLanding";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import UnmeiChatCheckoutGate from "@/components/uranai/UnmeiChatCheckoutGate";
import UnmeiCheckoutConfirming from "@/components/uranai/UnmeiCheckoutConfirming";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import UnmeiGuestPurchaseComplete from "@/components/uranai/UnmeiGuestPurchaseComplete";
import UnmeiPayPreview from "@/components/uranai/UnmeiPayPreview";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import { UnmeiAttentionClear } from "@/components/uranai/UnmeiAttentionClear";
import { hasUnmeiAccess } from "@/lib/entitlements";
import { localizedAlternates } from "@/lib/locale-seo";
import {
  createMetaPurchaseClaimToken,
  verifyPaidMetaPurchaseCheckoutSession,
} from "@/lib/paid-checkout-session";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Chart } from "@/lib/unmei/chart-view";
import { computeMoonDailyArc } from "@/lib/unmei/moon-arc";
import {
  resolveUnmeiPromptInputs,
  type UnmeiIdentity,
} from "@/lib/unmei/prompt-inputs";
import { isReadingLocaleValid, isReadingReady } from "@/lib/unmei/reading";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Destiny Blueprint",
  description:
    "A personalized reading that combines your Big Five personality profile with the sky at the moment you were born.",
  alternates: localizedAlternates("en", "/unmei", "/ko/unmei", "/en/unmei", "/id/unmei"),
};

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

type Reading = {
  locale?: string;
  hitokoto?: string;
  sections?: unknown[];
};

const PREVIEW_READING = {
  locale: "en",
  hitokoto:
    "Your stars hold kindness not merely as a trait, but as the way you connect with the world.",
  sections: [
    {
      id: "haichi",
      title: "The pattern your stars have formed",
      body: "The Sun illuminates what you have learned to value as you move through life. Your personality profile and the pattern of your stars arrive by different paths, yet they point toward the same quiet strength.\n\nYou notice what other people need before they have found the words for it. That sensitivity is not fragility; it is a precise way of reading a room and understanding where warmth can change its atmosphere.",
    },
    {
      id: "kokoro",
      title: "The weather of your heart",
      body: "In relationships, you pick up on small changes in tone and emotional temperature. You often become the person who restores ease without making a show of it.\n\nRemember to offer yourself the same reassurance you give so naturally to others. Your inner world becomes clearer when rest is treated as part of your rhythm rather than a reward you must earn.",
    },
    {
      id: "chosen",
      title: "Where your next challenge leads",
      body: "Your next chapter begins less with a dramatic leap than with choosing by your own standards. The more honestly you name what feels right, the easier it becomes to distinguish devotion from obligation.\n\nSmall decisions made consistently will carry you farther than one perfect answer. Trust the direction that leaves you more present, more curious, and more fully yourself.",
    },
    {
      id: "grace",
      title: "One final message",
      body: "The stars do not describe a fate that has already been decided. They offer a map for understanding the choices that brought you here and the possibilities that are opening now.\n\nYour kindness is strongest when it includes you. Keep that truth close as you step into what comes next.",
    },
  ],
};

const PREVIEW_CHART: Chart = {
  planets: {
    sun: { sign: "Leo", degree: 15.2 },
    moon: { sign: "Pisces", degree: 3.4 },
    mercury: { sign: "Virgo", degree: 2.8 },
    venus: { sign: "Gemini", degree: 28.5 },
    mars: { sign: "Virgo", degree: 10.1 },
    jupiter: { sign: "Virgo", degree: 25.9 },
    saturn: { sign: "Cancer", degree: 18.3 },
  },
  asc: { sign: "Scorpio", degree: 12 },
  mc: { sign: "Leo", degree: 22 },
  houses_available: true,
  datetime_utc: "1995-08-07T20:30:00.000Z",
  location: { latitude: 35.69, longitude: 139.69 },
};

async function EnglishUnmeiMetaPurchase(params: {
  [key: string]: string | string[] | undefined;
}) {
  if (params.checkout !== "success") return null;
  const checkoutSession = await verifyPaidMetaPurchaseCheckoutSession(
    params.session_id,
  );
  if (
    !checkoutSession ||
    (checkoutSession.product !== "unmei" &&
      checkoutSession.product !== "unmei_upgrade" &&
      checkoutSession.product !== "premium_bundle" &&
      checkoutSession.product !== "full_access")
  ) {
    return null;
  }
  return (
    <MetaPurchaseDataLayer
      checkoutSessionId={checkoutSession.id}
      product={checkoutSession.product}
      claimToken={createMetaPurchaseClaimToken(checkoutSession.id)}
    />
  );
}

export default async function EnglishDestinyPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const preview =
    process.env.NODE_ENV !== "production" && typeof params.preview === "string"
      ? params.preview
      : "";

  let previewContent: React.ReactNode = null;
  if (preview === "paid" || preview === "purchased") {
    previewContent = (
      <UnmeiClient initialState="no_birth" locale="en" previewMode />
    );
  } else if (preview === "purchase") {
    previewContent = (
      <UnmeiClient
        initialState="no_birth"
        purchase={{ ownerToken: null, product: "full_access" }}
        locale="en"
        previewMode
      />
    );
  } else if (preview === "pay") {
    previewContent = <UnmeiPayPreview locale="en" />;
  } else if (preview === "checkout-success") {
    previewContent = <UnmeiCheckoutConfirming locale="en" preview />;
  } else if (preview === "pending") {
    previewContent = <UnmeiClient initialState="pending" locale="en" />;
  } else if (preview === "ready") {
    previewContent = (
      <UnmeiReading
        reading={PREVIEW_READING}
        chart={PREVIEW_CHART}
        essence="Companion"
        characterSlug="jellyfish"
        identity={{
          typeName: "Sparkling Jellyfish",
          catchphrase:
            "You stay close to people’s hearts while learning about the world.",
          groupLabel: "Ocean",
          groupColor: "#8EC5E8",
        }}
        locale="en"
        trackView={false}
      />
    );
  } else if (preview === "teaser" || preview === "teaser_full") {
    previewContent = (
      <EnUnmeiLanding
        ownerToken={null}
        hasFull={false}
        trackView={false}
        previewMode
      />
    );
  } else if (preview === "chat") {
    previewContent = (
      <UnmeiChatCheckoutGate
        purchase={{ ownerToken: null, product: "full_access" }}
        locale="en"
        previewMode
      >
        <EnUnmeiLanding
          ownerToken={null}
          hasFull={false}
          trackView={false}
          launchChat
          previewMode
        />
      </UnmeiChatCheckoutGate>
    );
  }

  if (previewContent) {
    return (
      <div className="min-h-dvh bg-[#F8F8FC]">
        <UnmeiAttentionClear />
        <div className="unmei-site-header">
          <EnSiteHeader />
        </div>
        {previewContent}
        <div className="unmei-site-footer">
          <EnSiteFooter />
        </div>
      </div>
    );
  }

  const [metaPurchase, session] = await Promise.all([
    EnglishUnmeiMetaPurchase(params),
    getSession(),
  ]);
  const userId = session?.id ?? null;
  const purchased = userId ? await hasUnmeiAccess(userId) : false;
  const checkout = Array.isArray(params.checkout)
    ? params.checkout[0]
    : params.checkout;

  let content: React.ReactNode;
  if (checkout === "success") {
    content = userId ? (
      <UnmeiCheckoutConfirming locale="en" />
    ) : (
      <UnmeiGuestPurchaseComplete locale="en" />
    );
  } else if (!purchased) {
    const returnPath = session?.owner_token
      ? `/en/me/${encodeURIComponent(session.owner_token)}`
      : "/en";
    redirect(`${returnPath}#unlock-unmei`);
  } else {
    const [{ data: profile }, { data: readingRow }] = await Promise.all([
      supabaseAdmin
        .from("birth_profiles")
        .select("user_id, birth_date, time_unknown")
        .eq("user_id", userId!)
        .maybeSingle(),
      supabaseAdmin
        .from("natal_readings")
        .select("reading, model, generated_at")
        .eq("user_id", userId!)
        .maybeSingle(),
    ]);
    const reading = (readingRow?.reading ?? null) as Reading | null;

    if (!profile) {
      content = (
        <UnmeiClient
          initialState="no_birth"
          locale="en"
          ownerToken={session?.owner_token ?? null}
        />
      );
    } else {
      const ready =
        isReadingReady(readingRow) &&
        reading?.locale === "en" &&
        Array.isArray(reading.sections) &&
        isReadingLocaleValid(reading, "en");

      if (!ready) {
        content = (
          <UnmeiClient
            initialState="pending"
            locale="en"
            ownerToken={session?.owner_token ?? null}
          />
        );
      } else {
        const [{ data: natal }, promptInputs] = await Promise.all([
          supabaseAdmin
            .from("natal_charts")
            .select("chart")
            .eq("user_id", userId!)
            .maybeSingle(),
          resolveUnmeiPromptInputs(supabaseAdmin, userId!, "en"),
        ]);
        const chart = (natal?.chart ?? null) as Chart | null;
        const timeUnknown = profile.time_unknown === true;
        const moonArc =
          chart && timeUnknown
            ? computeMoonDailyArc(chart, profile.birth_date as string | null)
            : null;
        const identity: UnmeiIdentity | null = promptInputs.identity;

        content = (
          <UnmeiReading
            reading={readingRow!.reading}
            chart={chart}
            timeUnknown={timeUnknown}
            moonArc={moonArc}
            essence={promptInputs.essence}
            characterSlug={promptInputs.animalSlug}
            identity={identity}
            locale="en"
          />
        );
      }
    }
  }

  return (
    <>
      {metaPurchase}
      <div className="min-h-dvh bg-[#F8F8FC]">
        <UnmeiAttentionClear />
        <div className="unmei-site-header">
          <EnSiteHeader />
        </div>
        {session?.owner_token ? (
          <PreferredLocaleSync
            ownerToken={session.owner_token}
            locale="en"
          />
        ) : null}
        {content}
        <div className="unmei-site-footer">
          <EnSiteFooter />
        </div>
      </div>
    </>
  );
}
