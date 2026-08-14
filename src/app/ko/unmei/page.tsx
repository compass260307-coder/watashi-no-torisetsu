import type { Metadata } from "next";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import KoUnmeiExperience, {
  type KoUnmeiReading,
} from "@/components/ko/unmei/KoUnmeiExperience";
import { SelfAccessPlanCarousel } from "@/components/result/SelfAccessPlanCarousel";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { getSession } from "@/lib/session";
import { hasUnmeiAccess } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isReadingReady } from "@/lib/unmei/reading";
import { localizedAlternates } from "@/lib/locale-seo";
import UnmeiViewTracker from "@/components/uranai/UnmeiViewTracker";

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

export default async function KoreanUnmeiPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const paid = Array.isArray(params.paid) ? params.paid[0] : params.paid;
  const session = await getSession();
  const userId = session?.id ?? null;
  const purchased = userId ? await hasUnmeiAccess(userId) : false;

  let content: React.ReactNode;
  if (!purchased) {
    content = (
      <>
        {paid === "1" && session?.owner_token ? (
          <PaidUnlockWatcher
            ownerToken={session.owner_token}
            locale="ko"
            returnTo="unmei"
            product="full_access"
          />
        ) : null}
        <main className="bg-[#F7F7FC] px-4 py-14 sm:px-8">
        <UnmeiViewTracker
          eventName="unmei_lp_view"
          ownerToken={session?.owner_token ?? null}
          state="unpurchased"
          product="premium_bundle"
        />
        <section className="mx-auto max-w-[850px] text-center">
          <p className="text-sm font-black tracking-[0.18em] text-[#8B6426]">
            PREMIUM
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-[#2E2E5C] sm:text-6xl">
            운명의 설계도
          </h1>
          <p className="mx-auto mt-6 max-w-[680px] text-base font-medium leading-8 text-[#666980] sm:text-lg">
            Big Five 성격 진단과 태어난 순간의 하늘을 함께 읽어, 당신이 쌓아 온
            강점과 관계의 방식, 앞으로 움직일 타이밍을 한국어로 풀어냅니다.
          </p>
          <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
            {[
              "성격 진단과 별의 배치를 함께 해석",
              "일·관계·전환점을 담은 4개 챕터",
              "저장해 두고 언제든 다시 읽기",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[#E0D4B9] bg-[#FFF8E8] p-5 font-bold leading-6 text-[#51452E]"
              >
                <span className="mr-2 text-[#9A6A24]">✦</span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto mt-12 max-w-[1120px]">
          <SelfAccessPlanCarousel
            ownerToken={session?.owner_token ?? undefined}
            anchorId="ko-unmei-plans"
            ctaSource="ko_unmei_page"
            frameless
            returnTo="unmei"
            locale="ko"
            defaultProduct="premium_bundle"
          />
        </div>

        <p className="mx-auto mt-8 max-w-[680px] text-center text-xs leading-6 text-[#7F8294]">
          운명의 설계도는 완전판과 프리미엄 코스에 포함됩니다. 이미 라이트 코스를
          구매했다면 결제 화면에서 구매 금액을 뺀 차액만 청구됩니다. 결과는 오락과
          자기 이해를 위한 참고 정보이며 전문적인 진단을 대신하지 않습니다.
        </p>
        </main>
      </>
    );
  } else {
    const [{ data: profile }, { data: row }] = await Promise.all([
      supabaseAdmin
        .from("birth_profiles")
        .select("user_id")
        .eq("user_id", userId!)
        .maybeSingle(),
      supabaseAdmin
        .from("natal_readings")
        .select("reading, model, generated_at")
        .eq("user_id", userId!)
        .maybeSingle(),
    ]);
    const reading = (row?.reading ?? null) as KoUnmeiReading | null;
    const ready =
      isReadingReady(row) &&
      reading?.locale === "ko" &&
      Array.isArray(reading.sections);
    content = (
      <KoUnmeiExperience
        ownerToken={session!.owner_token ?? ""}
        initialState={!profile ? "no_birth" : ready ? "ready" : "pending"}
        initialReading={ready ? reading : null}
      />
    );
  }

  return (
    <>
      <KoTopHeader />
      {content}
      <KoTopFooter />
    </>
  );
}
