import type { Metadata } from "next";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import { hasUnmeiAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Chart } from "@/lib/unmei/chart-view";
import { computeMoonDailyArc } from "@/lib/unmei/moon-arc";
import {
  resolveUnmeiPromptInputs,
  type UnmeiIdentity,
} from "@/lib/unmei/prompt-inputs";
import { isReadingLocaleValid, isReadingReady } from "@/lib/unmei/reading";
import { localizedAlternates } from "@/lib/locale-seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Destiny Blueprint", description: "A personal English reading combining your personality and birth chart.", alternates: localizedAlternates("en", "/unmei", "/ko/unmei", "/en/unmei") };
type Reading = { locale?: string; hitokoto?: string; sections?: unknown[] };

type Props = { searchParams?: Promise<{ checkout?: string | string[] }> };

export default async function EnglishDestinyPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const session = await getSession();
  const purchased = session?.id ? await hasUnmeiAccess(session.id) : false;
  let content: React.ReactNode;
  if (!session || !purchased) content = <main className="mx-auto max-w-[900px] px-5 py-12 text-[#2E2E5C]"><h1 className="text-[38px] font-black">Destiny Blueprint</h1><p className="mt-3 text-[#67677C]">Your personal birth-chart reading is included in the Complete Edition.</p><FullAccessPromoCard ownerToken={session?.owner_token ?? ""} locale="en" returnTo="unmei" cardMode="legacy" /></main>;
  else {
    const [{ data: profile }, { data: row }] = await Promise.all([
      supabaseAdmin
        .from("birth_profiles")
        .select("user_id, birth_date, time_unknown")
        .eq("user_id", session.id)
        .maybeSingle(),
      supabaseAdmin
        .from("natal_readings")
        .select("reading, model, generated_at")
        .eq("user_id", session.id)
        .maybeSingle(),
    ]);
    const reading = (row?.reading ?? null) as Reading | null;
    if (!profile) {
      content = (
        <UnmeiClient
          initialState="no_birth"
          locale="en"
          ownerToken={session.owner_token ?? null}
        />
      );
    } else {
      const ready =
        isReadingReady(row) &&
        reading?.locale === "en" &&
        Array.isArray(reading.sections) &&
        isReadingLocaleValid(reading, "en");

      if (!ready) {
        content = (
          <UnmeiClient
            initialState="pending"
            locale="en"
            ownerToken={session.owner_token ?? null}
          />
        );
      } else {
        const [{ data: natal }, promptInputs] = await Promise.all([
          supabaseAdmin
            .from("natal_charts")
            .select("chart")
            .eq("user_id", session.id)
            .maybeSingle(),
          resolveUnmeiPromptInputs(supabaseAdmin, session.id, "en"),
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
            reading={row!.reading}
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
  return <div className="min-h-dvh bg-[#F8F8FC]"><EnSiteHeader />{session?.owner_token ? <PreferredLocaleSync ownerToken={session.owner_token} locale="en" /> : null}{query.checkout === "success" && !purchased && session?.owner_token ? <PaidUnlockWatcher ownerToken={session.owner_token} locale="en" returnTo="unmei" /> : null}{content}<EnSiteFooter /></div>;
}
