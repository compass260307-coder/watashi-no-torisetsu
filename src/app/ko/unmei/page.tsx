import type { Metadata } from "next";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import KoUnmeiLanding from "@/components/ko/unmei/KoUnmeiLanding";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import UnmeiChatCheckoutGate from "@/components/uranai/UnmeiChatCheckoutGate";
import UnmeiCheckoutConfirming from "@/components/uranai/UnmeiCheckoutConfirming";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import UnmeiGuestPurchaseComplete from "@/components/uranai/UnmeiGuestPurchaseComplete";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import { UnmeiAttentionClear } from "@/components/uranai/UnmeiAttentionClear";
import { getSession } from "@/lib/session";
import { hasFullAccess, hasUnmeiAccess } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isReadingLocaleValid, isReadingReady } from "@/lib/unmei/reading";
import { localizedAlternates } from "@/lib/locale-seo";
import { computeMoonDailyArc } from "@/lib/unmei/moon-arc";
import {
  resolveUnmeiPromptInputs,
  type UnmeiIdentity,
} from "@/lib/unmei/prompt-inputs";
import type { Chart } from "@/lib/unmei/chart-view";
import {
  createMetaPurchaseClaimToken,
  verifyPaidMetaPurchaseCheckoutSession,
} from "@/lib/paid-checkout-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "운명의 설계도 | 나의 사용설명서" },
  description:
    "성격 진단과 태어난 순간의 별을 함께 읽어, 일·관계·앞으로의 전환점을 한국어로 풀어낸 개인 설계도입니다.",
  alternates: localizedAlternates("ko", "/unmei", "/ko/unmei"),
  robots: { index: true, follow: true },
};

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

type KoReading = {
  locale?: string;
  hitokoto?: string;
  sections?: unknown[];
};

async function KoreanUnmeiMetaPurchase(params: {
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
      checkoutSession.product !== "premium_bundle")
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

export default async function KoreanUnmeiPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const checkout = Array.isArray(params.checkout)
    ? params.checkout[0]
    : params.checkout;
  const [metaPurchase, session] = await Promise.all([
    KoreanUnmeiMetaPurchase(params),
    getSession(),
  ]);
  const userId = session?.id ?? null;
  const purchased = userId ? await hasUnmeiAccess(userId) : false;

  let content: React.ReactNode;
  if (checkout === "success") {
    content = userId ? (
      <UnmeiCheckoutConfirming locale="ko" />
    ) : (
      <UnmeiGuestPurchaseComplete locale="ko" />
    );
  } else if (!purchased) {
    content = (
      <UnmeiChatCheckoutGate
        purchase={{
          ownerToken: session?.owner_token ?? null,
          product: "premium_bundle",
        }}
        locale="ko"
      >
        <KoUnmeiLanding
          ownerToken={session?.owner_token ?? null}
          hasFull={userId ? await hasFullAccess(userId) : false}
        />
      </UnmeiChatCheckoutGate>
    );
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

    if (!profile) {
      content = (
        <UnmeiClient
          initialState="no_birth"
          locale="ko"
          ownerToken={session?.owner_token ?? null}
        />
      );
    } else {
      const reading = (readingRow?.reading ?? null) as KoReading | null;
      const ready =
        isReadingReady(readingRow) &&
        reading?.locale === "ko" &&
        Array.isArray(reading.sections) &&
        isReadingLocaleValid(reading, "ko");

      if (!ready) {
        content = (
          <UnmeiClient
            initialState="pending"
            locale="ko"
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
          resolveUnmeiPromptInputs(supabaseAdmin, userId!, "ko"),
        ]);
        const chart = (natal?.chart ?? null) as Chart | null;
        const timeUnknown = profile.time_unknown === true;
        const moonArc =
          chart && timeUnknown
            ? computeMoonDailyArc(chart, profile.birth_date as string | null)
            : null;

        const essence = promptInputs.essence;
        const animalSlug = promptInputs.animalSlug;
        const identity: UnmeiIdentity | null = promptInputs.identity;

        content = (
          <UnmeiReading
            reading={readingRow!.reading}
            chart={chart}
            timeUnknown={timeUnknown}
            moonArc={moonArc}
            essence={essence}
            characterSlug={animalSlug}
            identity={identity}
            locale="ko"
          />
        );
      }
    }
  }

  return (
    <>
      {metaPurchase}
      <UnmeiAttentionClear />
      <KoTopHeader />
      {content}
      <KoTopFooter />
    </>
  );
}
