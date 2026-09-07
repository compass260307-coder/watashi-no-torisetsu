import type { Metadata } from "next";
import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import {
  KO_ABOUT_FAQ,
  KO_ABOUT_GALLERY,
  KO_ABOUT_PRIVACY_ITEMS,
  KO_ABOUT_STEPS,
} from "@/i18n/ko/about";
import {
  KO_DEFAULT_OG_IMAGE,
  KO_SEO_KEYWORDS,
  KO_SITE_NAME,
  localizedAlternates,
  SITE_URL as BASE_URL,
} from "@/lib/locale-seo";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";
const DESCRIPTION =
  "나의 사용설명서는 자기 진단과 친구의 평가를 함께 살펴보는 Big Five 기반 자기 이해 서비스예요. 서비스의 원리, 이용 방법, 개인정보 보호와 운영 정보를 확인하세요.";

export const metadata: Metadata = {
  title: { absolute: "서비스 소개 | 나의 사용설명서" },
  description: DESCRIPTION,
  keywords: [
    ...KO_SEO_KEYWORDS,
    "Big Five 자기 이해",
    "친구가 보는 나",
    "자기 진단 친구 평가",
  ],
  alternates: localizedAlternates("ko", "/about", "/ko/about"),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    url: `${BASE_URL}/ko/about`,
    siteName: KO_SITE_NAME,
    title: "서비스 소개 | 나의 사용설명서",
    description: DESCRIPTION,
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "서비스 소개 | 나의 사용설명서",
    description: DESCRIPTION,
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: KO_ABOUT_FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="break-keep text-[22px] font-bold leading-snug md:text-[26px]"
      style={{ color: NAVY }}
    >
      {children}
    </h2>
  );
}

export default function KoreanAboutPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <KoTopHeader />

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pb-20 md:px-8">
        <section className="pt-16 md:pt-24">
          <h1
            className="break-keep font-bold"
            style={{
              color: NAVY,
              fontSize: "clamp(32px, 5.5vw, 48px)",
              lineHeight: 1.45,
            }}
          >
            나를 가장 잘 모르는 사람은,
            <br />
            어쩌면 나일지도 몰라요.
          </h1>
          <p
            className="mt-6 break-keep text-[15px] leading-[2] md:text-[16px]"
            style={{ color: `${NAVY}B3` }}
          >
            <Link
              href="/ko"
              className="font-bold underline decoration-current/40 underline-offset-4"
            >
              앨리스 진단
            </Link>
            {"의 서비스 ‘나의 사용설명서’는 자기 진단과 친구의 평가를 함께 살펴보며 만드는 나만의 사용설명서예요. "}
            친구의 답변이 모일수록 미처 몰랐던 내 모습이 조금씩 선명해져요.
          </p>
        </section>

        <section className="mt-20">
          <SectionTitle>왜 만들었나요?</SectionTitle>
          <div
            className="mt-5 flex flex-col gap-4 break-keep text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            <p>
              세상에는 많은 성격 진단이 있지만, 대부분은 ‘내가 답한 나’만 보여
              줘요. 아무리 솔직하게 답해도 이미 내가 알고 있던 모습 안에서 결과가
              만들어지기 쉬워요.
            </p>
            <p>
              하지만 친구만 알고 있는 내 모습도 분명히 있어요. 나도 모르는 말버릇,
              사람들이 나를 찾는 순간, 분위기를 바꾸는 방식 같은 것들이죠.
              심리학에서는 이렇게 스스로는 모르지만 타인은 아는 영역을 ‘맹목의
              창’이라고 설명해요.
            </p>
            <p>
              그래서 나의 사용설명서는 자기 답변만으로 끝나지 않아요. 친구의
              시선이 더해질수록 사용설명서가 완성되도록 만들었어요. 무거운
              자기분석보다, 친구와 함께 웃으며 보여 줄 수 있는 경험을 지향해요.
            </p>
          </div>
        </section>

        <section className="mt-20">
          <SectionTitle>원리는 간단해요</SectionTitle>
          <p
            className="mt-5 break-keep text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            자기 진단과 친구의 평가를 겹쳐 보면, 혼자서는 발견하기 어려웠던 차이가
            드러나요.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 md:flex-row md:justify-center">
            <div className="w-full rounded-2xl border-2 border-[#E3E6F5] p-5 text-center md:w-[240px]">
              <p className="text-[13px] font-bold" style={{ color: `${NAVY}99` }}>
                자기 진단
              </p>
              <p className="mt-1 text-[16px] font-bold" style={{ color: NAVY }}>
                내가 알고 있는 나
              </p>
            </div>
            <span className="text-[22px] font-bold md:px-2" style={{ color: SORA }}>
              ×
            </span>
            <div className="w-full rounded-2xl border-2 border-[#E3E6F5] p-5 text-center md:w-[240px]">
              <p className="text-[13px] font-bold" style={{ color: `${NAVY}99` }}>
                친구 평가
              </p>
              <p className="mt-1 text-[16px] font-bold" style={{ color: NAVY }}>
                친구 눈에 비친 나
              </p>
            </div>
          </div>
          <div className="mt-3 text-center text-[20px]" style={{ color: `${NAVY}66` }}>
            ↓
          </div>
          <div className="mx-auto mt-3 w-full rounded-2xl bg-[#F4F4FE] p-5 text-center md:w-[400px]">
            <p className="text-[16px] font-bold" style={{ color: SORA }}>
              차이 = 내가 미처 몰랐던 나
            </p>
            <p className="mt-1 break-keep text-[13px] leading-relaxed" style={{ color: `${NAVY}B3` }}>
              이 부분이 나만의 사용설명서에서 가장 흥미로운 페이지가 돼요.
            </p>
          </div>
        </section>

        <section className="mt-20">
          <SectionTitle>이용 방법은 간단해요</SectionTitle>
          <ol className="mt-6 flex flex-col gap-6">
            {KO_ABOUT_STEPS.map((step) => (
              <li key={step.num} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5B5BEF] text-[15px] font-bold text-white">
                  {step.num}
                </span>
                <div>
                  <h3 className="break-keep text-[16px] font-bold leading-snug" style={{ color: NAVY }}>
                    {step.title}
                  </h3>
                  <p className="mt-1 break-keep text-[14px] leading-[1.9]" style={{ color: `${NAVY}B3` }}>
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20">
          <SectionTitle>과학적 배경, Big Five</SectionTitle>
          <div
            className="mt-5 flex flex-col gap-4 break-keep text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            <p>
              진단의 바탕은 성격심리학에서 널리 활용되는 Big Five 이론이에요.
              개방성, 성실성, 외향성, 우호성, 정서적 민감성의 다섯 축으로 성격
              경향을 살펴봐요. 다섯 축의 영문 앞글자를 따 OCEAN 모델이라고도
              불려요.
            </p>
            <p>
              다섯 축의 조합을 바다, 육지, 하늘, 미지의 네 그룹과 32가지 성격
              캐릭터로 표현해요. 친구 진단도 같은 축을 사용하기 때문에 자기
              평가와 친구의 평가를 자연스럽게 비교할 수 있어요.
            </p>
          </div>
        </section>

        <section className="mt-20">
          <SectionTitle>32가지 성격 유형</SectionTitle>
          <p className="mt-5 break-keep text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>
            나는 어떤 유형일까요? 진단 결과는 개성 있는 32가지 캐릭터로 표현돼요.
          </p>
          <div className="mt-6 grid grid-cols-4 gap-x-3 gap-y-5">
            {KO_ABOUT_GALLERY.map((character) => (
              <div key={character.src} className="text-center">
                <SmoothImage
                  src={character.src}
                  alt={character.name}
                  width={120}
                  height={120}
                  className="mx-auto h-auto w-full max-w-[96px]"
                />
                <p className="mt-1.5 break-keep text-[10px] font-bold leading-tight md:text-[11px]" style={{ color: `${NAVY}B3` }}>
                  {character.name}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/ko/types" className="text-[14px] font-bold underline underline-offset-4" style={{ color: SORA }}>
              32가지 성격 유형 모두 보기 →
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <SectionTitle>소중하게 지키는 원칙</SectionTitle>
          <ul className="mt-6 flex flex-col gap-3">
            {KO_ABOUT_PRIVACY_ITEMS.map((text) => (
              <li key={text} className="flex items-start gap-2.5 break-keep text-[14px] leading-[1.9]" style={{ color: `${NAVY}CC` }}>
                <span aria-hidden className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B5BEF]" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20">
          <SectionTitle>자주 묻는 질문</SectionTitle>
          <div className="mt-6">
            <FAQAccordion items={KO_ABOUT_FAQ} />
          </div>
        </section>

        <section className="mt-20">
          <SectionTitle>운영 정보</SectionTitle>
          <div className="mt-5 break-keep text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>
            <p>
              Big Five 심리학을 바탕으로 ‘내가 미처 몰랐던 나’를 발견할 수 있는
              서비스를 만들고 있어요.
            </p>
            <p className="mt-3 text-[12px]" style={{ color: `${NAVY}80` }}>
              운영: 나의 사용설명서 운영팀
            </p>
            <a
              href="https://sora-team.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-[13px] font-bold underline underline-offset-4"
              style={{ color: SORA }}
            >
              운영사 정보 보기
            </a>
          </div>
        </section>

        <section className="mt-20 text-center">
          <p className="break-keep text-[18px] font-bold leading-snug md:text-[20px]" style={{ color: NAVY }}>
            먼저, 내가 알고 있는 나부터 만나 보세요.
          </p>
          <Link
            href="/ko/diagnosis"
            className="sora-cta mt-6 inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
          >
            무료 진단 시작하기 →
          </Link>
        </section>
      </main>

      <KoTopFooter />
    </div>
  );
}
