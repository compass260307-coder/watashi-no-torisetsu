// 友達が30問の評価を送信した直後に見る結果ページ。
// 旧ページの白地・大きな余白・ネイビーの見出しを基調に、
// 理解度 → 五つの性格傾向 → 自己診断CTA の順で案内する。

import Image from "next/image";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { KO_ABOUT_FAQ } from "@/i18n/ko/about";
import type { ResultLocale } from "@/i18n/result";
import { faqItems } from "@/lib/faq-data";
import type { BigFiveScores } from "@/lib/perception-analysis";
import { FriendGapSection } from "./FriendGapSection";
import { GuideDiagnoseButton } from "./GuideDiagnoseButton";
import { MeAttentionOnGuide } from "./MeAttentionOnGuide";
import { MeStickyHeader } from "./MeStickyHeader";

const COPY = {
  ja: {
    scoreTitleLead: "",
    scoreTitleTail: "の理解度",
    ctaTitle: "次は、あなたのことを知ってみよう。",
    ctaBody:
      "無料の性格診断テストを受けて、自分がどんな人間か、自らの態度や行動の理由について、「不思議なくらい正確な」説明を手に入れましょう。すでにテストを受けた方は、ログインすれば、いつでも結果を見直せます！",
    cta: "無料で自分も診断する",
    fallbackName: "友達",
  },
  ko: {
    scoreTitleLead: "",
    scoreTitleTail: "의 이해도",
    ctaTitle: "이번에는 나에 대해 알아보세요.",
    ctaBody: "32가지 캐릭터 유형으로 성격과 강점을 알아볼 수 있어요.",
    cta: "무료로 나도 진단하기",
    fallbackName: "친구",
  },
} as const;

const UNDERSTANDING_RESULTS = [
  {
    score: 32,
    image: "/result/understanding/understanding-32-transparent.webp",
  },
  {
    score: 54,
    image: "/result/understanding/understanding-54-transparent.webp",
  },
  {
    score: 82,
    image: "/result/understanding/understanding-82-transparent.webp",
  },
  {
    score: 99,
    image: "/result/understanding/understanding-99-transparent.webp",
  },
  {
    score: 100,
    image: "/result/understanding/understanding-100-gold-transparent.webp",
  },
] as const;

function getUnderstandingResult(score: number) {
  return UNDERSTANDING_RESULTS.reduce((nearest, candidate) =>
    Math.abs(candidate.score - score) < Math.abs(nearest.score - score)
      ? candidate
      : nearest,
  );
}

export function FriendIndividualGuide({
  understandingScore = 82,
  diagnoseHref = "/diagnosis",
  diagnoseTrackSource,
  inviteCode,
  targetName,
  selfScores,
  perceivedScores,
  locale = "ja",
}: {
  understandingScore?: number;
  diagnoseHref?: string;
  diagnoseTrackSource?: string;
  inviteCode?: string;
  targetName?: string;
  selfScores?: BigFiveScores;
  perceivedScores?: BigFiveScores;
  locale?: ResultLocale;
}) {
  const isKorean = locale === "ko";
  const copy = COPY[locale];
  const score = Math.max(0, Math.min(100, Math.round(understandingScore)));
  const understandingResult = getUnderstandingResult(score);
  const normalizedTargetName = (targetName ?? "").trim();
  const targetLabel = normalizedTargetName
    ? isKorean
      ? `${normalizedTargetName}님`
      : `${normalizedTargetName}さん`
    : copy.fallbackName;
  const qnaItems = (isKorean ? KO_ABOUT_FAQ : faqItems).filter(
    (_, index) =>
      index === 0 || index === 3 || index === 4 || index === 5 || index === 6,
  );
  return (
    <>
      <MeAttentionOnGuide inviteCode={inviteCode} />
      <MeStickyHeader
        showUnlockCta={false}
        diagnosisCta
        fullWidthBar
        diagnosisCtaHref={diagnoseHref}
        diagnosisCtaLabel={isKorean ? "내 성격도 진단하기" : "自己診断をする"}
        diagnosisCtaTrackSource={
          diagnoseTrackSource ? "sticky_bar" : undefined
        }
        inviteCode={inviteCode}
        locale={locale}
      >
        {isKorean ? <KoTopHeader /> : <TopHeader />}
      </MeStickyHeader>

      <main className="overflow-x-clip bg-white px-4 pb-10 md:px-8 md:pb-12">
        <section
          className="relative left-1/2 w-screen -translate-x-1/2 text-white"
          style={{
            background: "linear-gradient(105deg, #FAD3E3 0%, #F8C9DC 100%)",
          }}
        >
          <div className="mx-auto grid max-w-[1180px] items-center gap-2 px-4 py-6 text-center md:gap-4 md:px-8 md:py-8 lg:min-h-[410px] lg:grid-cols-[minmax(450px,0.9fr)_minmax(520px,1.1fr)] lg:gap-0 lg:px-10 lg:text-left">
            <div className="relative z-10">
              <h1 className="break-words text-[22px] font-black leading-[1.4] tracking-[-0.025em] sm:text-[26px] md:text-[40px] lg:text-[48px]">
                {copy.scoreTitleLead}
                {targetLabel}
                {copy.scoreTitleTail}
              </h1>
            </div>

            <Image
              src={understandingResult.image}
              alt={`${understandingResult.score}%`}
              width={1448}
              height={1086}
              loading="eager"
              unoptimized
              sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) 600px, 700px"
              className="mx-auto h-auto w-full max-w-[580px] lg:ml-auto lg:max-w-[600px]"
            />
          </div>
        </section>

        {selfScores && perceivedScores ? (
          <FriendGapSection
            selfScores={selfScores}
            perceivedScores={perceivedScores}
            targetLabel={targetLabel}
            locale={locale}
          />
        ) : null}

        <section className="mx-auto max-w-[980px] pt-14 md:pt-16">
          <div className="relative rounded-[20px] bg-[#5AA5BD] px-6 pb-9 pt-20 text-left shadow-[0_18px_50px_rgba(46,46,92,0.12)] md:rounded-[22px] md:px-12 md:pb-12 md:pt-24">
            <div className="pointer-events-none absolute left-1/2 top-0 h-[150px] w-[178px] -translate-x-1/2 -translate-y-[58%] md:h-[178px] md:w-[210px]">
              <span className="absolute inset-x-0 bottom-0 h-[92px] bg-[#386F82] [clip-path:polygon(7%_18%,40%_0,91%_18%,100%_62%,63%_100%,17%_82%,0_38%)] md:h-[108px]" />
              <span className="absolute bottom-[19px] right-[10px] h-[58px] w-[72px] bg-[#2D829B] [clip-path:polygon(18%_0,100%_25%,82%_100%,0_72%)] md:bottom-[22px] md:right-[12px] md:h-[68px] md:w-[84px]" />
              <Image
                src="/characters/face/angel_N.webp"
                alt=""
                width={512}
                height={512}
                sizes="(max-width: 767px) 120px, 144px"
                className="absolute bottom-[8px] left-1/2 h-auto w-[120px] -translate-x-1/2 drop-shadow-[0_8px_12px_rgba(46,46,92,0.16)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_82%,transparent_100%)] md:bottom-[10px] md:w-[144px]"
              />
            </div>

            <div className="relative z-10 max-w-[650px]">
              <h2 className="text-[24px] font-black leading-[1.5] text-white md:text-[32px]">
                {copy.ctaTitle}
              </h2>
              <p className="mt-3 max-w-[600px] text-[14px] font-bold leading-[1.85] text-white/90 md:text-[16px]">
                {copy.ctaBody}
              </p>
              <div className="mt-7 max-w-[340px]">
                <GuideDiagnoseButton
                  href={diagnoseHref}
                  trackSource={diagnoseTrackSource}
                  inviteCode={inviteCode}
                >
                  {copy.cta}
                </GuideDiagnoseButton>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] pt-16 md:pt-24">
          <div className="grid gap-6 md:grid-cols-[minmax(220px,0.55fr)_minmax(0,1.45fr)] md:gap-12 lg:gap-20">
            <h2 className="text-[27px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
              {isKorean ? "자주 묻는 질문" : "よくある質問"}
            </h2>
            <div className="border-t border-[#E5E7EF]">
              {qnaItems.map((item) => (
                <details
                  key={item.question}
                  className="group border-b border-[#E5E7EF]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-[15px] font-black leading-relaxed text-[#333747] md:py-6 md:text-[17px] [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[25px] font-normal leading-none text-[#5AA5BD] transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-6 pr-10 text-[14px] leading-[1.9] text-[#55596A] md:text-[15px]">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

      </main>

      {isKorean ? <KoTopFooter /> : <TopFooter />}
    </>
  );
}
