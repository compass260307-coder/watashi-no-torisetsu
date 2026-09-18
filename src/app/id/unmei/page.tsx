import type { Metadata } from "next";
import Link from "next/link";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import { ProofFacesBand } from "@/components/ProofFacesBand";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import UnmeiCheckoutConfirming from "@/components/uranai/UnmeiCheckoutConfirming";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import UnmeiGuestPurchaseComplete from "@/components/uranai/UnmeiGuestPurchaseComplete";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import UnmeiPriceCta from "@/components/uranai/UnmeiPriceCta";
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
  const features = [
    {
      mark: "◎",
      title: "Roda kelahiran yang hanya dimiliki Anda",
      body: "Kami merekonstruksi langit saat Anda lahir dari tanggal, waktu, dan tempat kelahiran, lalu menggambar posisi Matahari, Bulan, dan planet sebagai satu peta pribadi.",
      bg: "#E7DCFB",
      dark: "#6C4EB8",
    },
    {
      mark: "▤",
      title: "Pembacaan AI dalam empat bab",
      body: "Empat bab membahas hal yang telah Anda bangun, diri Anda bersama orang lain, titik balik yang akan datang, dan satu pesan terakhir—dengan langkah kecil yang bisa dicoba mulai besok.",
      bg: "#BEF2F9",
      dark: "#1D6E86",
    },
    {
      mark: "◉",
      title: "Kepribadian × bintang, dua jawaban yang dipertemukan",
      body: "Hasil penilaian diri dibandingkan dengan potensi dari bintang. Kesamaan maupun perbedaannya membantu memberi nama pada cara hidup yang telah Anda pilih.",
      bg: "#D8F2C0",
      dark: "#3F7A2E",
    },
    {
      mark: "◇",
      title: "Titik awal yang dapat Anda kunjungi kembali",
      body: "Susunan bintang saat lahir tidak berubah. Simpan hasil ini sebagai titik awal pribadi yang dapat dibaca kembali setiap kali Anda ragu.",
      bg: "#FDEFB4",
      dark: "#8F6B14",
    },
  ];
  const faqs = [
    {
      q: "Untuk apa Peta Takdir dapat digunakan?",
      a: "Peta ini membaca potensi yang telah Anda bangun, cara berhubungan dengan orang lain, dan titik balik yang akan datang dari langit saat Anda lahir. Karena digabungkan dengan hasil tes kepribadian, Anda dapat memahami diri satu lapis lebih dalam.",
    },
    {
      q: "Apakah saya perlu memahami astrologi?",
      a: "Tidak. Hasil disampaikan sebagai tulisan yang berbicara langsung kepada Anda, bukan deretan istilah teknis, dan dibagi menjadi empat bab dengan langkah kecil yang bisa dicoba mulai besok.",
    },
    {
      q: "Apa yang perlu saya lakukan setelah membeli?",
      a: "Masukkan tanggal, waktu, dan tempat lahir. Pembacaan biasanya dibuat dalam sekitar satu menit. Jika waktu lahir tidak diketahui, hasil tetap dapat dibuat dan dibaca kembali kapan saja.",
    },
    {
      q: "Apakah ini ramalan yang pasti benar?",
      a: "Peta Takdir adalah konten hiburan, bukan penetapan masa depan. Tujuannya adalah memberi nama pada pola pilihan Anda dan membantu memikirkan pilihan berikutnya.",
    },
  ];
  return (
    <main className="overflow-x-clip bg-white">
      <div className="bg-[#FFFBF2] px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-10">
        <section className="mx-auto grid max-w-[1080px] items-center gap-6 md:grid-cols-2 md:gap-10">
          <SmoothImage
            src="/mascot/unmei-hero-alice-transparent.png"
            alt="Alice bersama teman-temannya mengelilingi peta bintang dan bola langit"
            width={1448}
            height={1086}
            className="h-auto w-full max-w-[320px] md:max-w-[480px]"
            priority
          />
          <div className="text-left">
            <h1 className="leading-tight">
              <span className="block text-[28px] font-black text-[#2E2E5C] md:text-[34px]">Khusus untuk Anda</span>
              <span className="mt-1.5 inline-block rounded-xl bg-[#A36818] px-3 py-1 text-[34px] font-black text-white md:text-[42px]">Peta Takdir</span>
            </h1>
            <p className="mt-3 text-[15px] font-bold leading-relaxed text-[#2E2E5C]/70 md:text-[16px]">
              Gabungkan susunan bintang dan tes kepribadian untuk membuat pembacaan pribadi Anda.
            </p>
            <UnmeiPriceCta
              sessionOwnerToken={ownerToken}
              sessionHasFull={false}
              locale="id"
            />
          </div>
        </section>
      </div>

      <div className="bg-white">
        <svg aria-hidden="true" viewBox="0 0 1440 48" preserveAspectRatio="none" className="block h-8 w-full md:h-12">
          <path fill="#FFFBF2" d="M0,0 H1440 V22 C1320,44 1180,6 1040,18 C900,30 800,46 660,32 C520,18 440,42 300,38 C160,34 70,8 0,26 Z" />
        </svg>
        <div className="px-4 md:px-8">
          <ProofFacesBand lead="Hingga sekarang" countSuffix="+ orang" tail="telah menyelesaikan tes kepribadian mereka" />
        </div>
      </div>

      <div className="mt-16 px-4 md:mt-24 md:px-8">
        <div className="mx-auto max-w-[1080px]">
          <section>
            <h2 className="mb-7 text-center text-[20px] font-black text-[#2E2E5C] md:mb-9 md:text-[26px]">Yang dapat Anda temukan dalam Peta Takdir</h2>
            <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
              {features.map((feature, index) => (
                <li key={feature.title} className="rounded-2xl p-5 transition-transform md:p-7 md:hover:-translate-y-1" style={{ background: feature.bg }}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-[24px] font-black" style={{ color: feature.dark }}>{feature.mark}</span>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black tracking-[0.08em]" style={{ color: feature.dark }}>POINT 0{index + 1}</span>
                  </div>
                  <p className="mt-3.5 text-[17px] font-black leading-snug text-[#2E2E5C] md:text-[18px]">{feature.title}</p>
                  <p className="mt-1.5 text-[14px] font-normal leading-relaxed text-[#2E2E5C]/70 md:text-[15px]">{feature.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14 md:mt-20">
            <h2 className="mb-3 text-[24px] font-black text-[#2E2E5C] md:text-[28px]">Pertanyaan umum</h2>
            <div className="divide-y divide-[#E9E9F2] border-y border-[#E9E9F2]">
              {faqs.map((faq) => (
                <details key={faq.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-bold text-[#2E2E5C] md:text-[17px] [&::-webkit-details-marker]:hidden">
                    {faq.q}<span aria-hidden="true" className="flex-shrink-0 text-[22px] font-black leading-none text-[#5B5BEF] transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[#2E2E5C]/70 md:text-[16px]">{faq.a}</p>
                </details>
              ))}
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-bold text-[#2E2E5C] md:text-[17px] [&::-webkit-details-marker]:hidden">
                  Apakah tersedia pengembalian dana?<span aria-hidden="true" className="flex-shrink-0 text-[22px] font-black leading-none text-[#5B5BEF] transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[#2E2E5C]/70 md:text-[16px]">
                  Ya. Anda dapat meminta pengembalian dana penuh dalam 30 hari sejak pembayaran. Lihat <Link href="/id/legal/commerce" className="font-bold text-[#5B5BEF] underline underline-offset-2">informasi transaksi</Link> untuk detailnya.
                </p>
              </details>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-10 px-4 pb-14 md:mt-12 md:px-8 md:pb-16">
        <section className="mx-auto max-w-[1080px] pb-4 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F4F4FE] text-[34px] font-black text-[#5B5BEF]">↻</span>
          <h2 className="mt-5 text-[22px] font-black text-[#2E2E5C] md:text-[26px]">Tanpa risiko, garansi uang kembali 30 hari</h2>
          <p className="mx-auto mt-2.5 max-w-[640px] text-[14px] font-bold leading-relaxed text-[#2E2E5C]/65 md:text-[15px]">
            Jika Anda tidak puas, hubungi <a href="mailto:support@watashi-torisetsu.com" className="mx-0.5 text-[#5B5BEF] underline underline-offset-2">support@watashi-torisetsu.com</a> dalam 30 hari sejak pembayaran untuk menerima pengembalian dana penuh.
          </p>
        </section>
      </div>
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
