import type { Metadata } from "next";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import UnmeiCheckoutConfirming from "@/components/uranai/UnmeiCheckoutConfirming";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import UnmeiGuestPurchaseComplete from "@/components/uranai/UnmeiGuestPurchaseComplete";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import { UnmeiAttentionClear } from "@/components/uranai/UnmeiAttentionClear";
import { hasUnmeiAccess } from "@/lib/entitlements";
import {
  createMetaPurchaseClaimToken,
  verifyPaidMetaPurchaseCheckoutSession,
} from "@/lib/paid-checkout-session";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Chart } from "@/lib/unmei/chart-view";
import { computeMoonDailyArc } from "@/lib/unmei/moon-arc";
import { resolveUnmeiPromptInputs } from "@/lib/unmei/prompt-inputs";
import { isReadingLocaleValid, isReadingReady } from "@/lib/unmei/reading";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Peta Takdir",
  description: "Pembacaan pribadi yang menggabungkan profil kepribadian Big Five dengan langit pada saat kamu lahir.",
};

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};
type Reading = { locale?: string; hitokoto?: string; sections?: unknown[] };

async function PurchaseTracking(params: {
  [key: string]: string | string[] | undefined;
}) {
  if (params.checkout !== "success") return null;
  const checkoutSession = await verifyPaidMetaPurchaseCheckoutSession(params.session_id);
  if (!checkoutSession) return null;
  return (
    <MetaPurchaseDataLayer
      checkoutSessionId={checkoutSession.id}
      product={checkoutSession.product}
      claimToken={createMetaPurchaseClaimToken(checkoutSession.id)}
    />
  );
}

function IndonesianUnmeiLanding({ ownerToken }: { ownerToken: string | null }) {
  return (
    <main className="overflow-x-clip bg-white px-4 pb-14 pt-10 md:px-8 md:pt-16">
      <section className="mx-auto max-w-[900px] text-center">
        <p className="text-[12px] font-black tracking-[0.18em] text-[#9A6A24]">ALICE ASTROLOGY</p>
        <h1 className="mt-3 text-[38px] font-black leading-tight text-[#2E2E5C] md:text-[56px]">Peta Takdirmu</h1>
        <p className="mx-auto mt-5 max-w-[680px] text-[16px] font-medium leading-[1.9] text-[#5F6072] md:text-[18px]">
          Gabungkan susunan bintang saat kamu lahir dengan hasil tes kepribadian untuk membaca hal yang telah kamu bangun, dirimu dalam hubungan, dan titik balik yang akan datang.
        </p>
        <div className="mx-auto mt-8 grid max-w-[760px] gap-3 text-left sm:grid-cols-3">
          {["Peta kelahiran pribadimu", "Pembacaan AI dalam empat bab", "Panduan konkret untuk langkah berikutnya"].map((item) => (
            <div key={item} className="rounded-2xl bg-[#FFF8E8] px-4 py-4 text-[14px] font-bold text-[#2E2E5C]">✦ {item}</div>
          ))}
        </div>
      </section>
      <FullAccessPromoCard
        ownerToken={ownerToken ?? undefined}
        locale="id"
        returnTo="unmei"
        benefitsBeforePrice
        noShadow
      />
    </main>
  );
}

export default async function IndonesianDestinyPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const [metaPurchase, session] = await Promise.all([
    PurchaseTracking(params),
    getSession(),
  ]);
  const userId = session?.id ?? null;
  const purchased = userId ? await hasUnmeiAccess(userId) : false;
  const checkout = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout;

  let content: React.ReactNode;
  if (checkout === "success") {
    content = userId ? (
      <UnmeiCheckoutConfirming locale="id" />
    ) : (
      <UnmeiGuestPurchaseComplete locale="id" />
    );
  } else if (!purchased) {
    content = <IndonesianUnmeiLanding ownerToken={session?.owner_token ?? null} />;
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
      content = <UnmeiClient initialState="no_birth" locale="id" ownerToken={session?.owner_token ?? null} />;
    } else {
      const ready =
        isReadingReady(readingRow) &&
        reading?.locale === "id" &&
        Array.isArray(reading.sections) &&
        isReadingLocaleValid(reading, "id");
      if (!ready) {
        content = <UnmeiClient initialState="pending" locale="id" ownerToken={session?.owner_token ?? null} />;
      } else {
        const [{ data: natal }, promptInputs] = await Promise.all([
          supabaseAdmin.from("natal_charts").select("chart").eq("user_id", userId!).maybeSingle(),
          resolveUnmeiPromptInputs(supabaseAdmin, userId!, "id"),
        ]);
        const chart = (natal?.chart ?? null) as Chart | null;
        const timeUnknown = profile.time_unknown === true;
        content = (
          <UnmeiReading
            reading={readingRow!.reading}
            chart={chart}
            timeUnknown={timeUnknown}
            moonArc={chart && timeUnknown ? computeMoonDailyArc(chart, profile.birth_date as string | null) : null}
            essence={promptInputs.essence}
            characterSlug={promptInputs.animalSlug}
            identity={promptInputs.identity}
            locale="id"
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
        <div className="unmei-site-header"><TopHeader locale="id" /></div>
        {session?.owner_token ? <PreferredLocaleSync ownerToken={session.owner_token} locale="id" /> : null}
        {content}
        <div className="unmei-site-footer"><TopFooter locale="id" /></div>
      </div>
    </>
  );
}
