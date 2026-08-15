import Link from "next/link";
import { ProofFacesBand } from "@/components/ProofFacesBand";
import { SmoothImage } from "@/components/ui/SmoothImage";
import UnmeiPriceCta from "@/components/uranai/UnmeiPriceCta";
import UnmeiViewTracker from "@/components/uranai/UnmeiViewTracker";

const FEATURES = [
  {
    title: "세상에 하나뿐인 나의 출생 차트",
    body: "생년월일·출생 시간·출생지를 바탕으로 태어난 순간의 하늘을 재현해요. 태양과 달을 비롯한 천체의 배치를 나만의 설계도로 그려 드립니다.",
    bg: "#E7DCFB",
    dark: "#6C4EB8",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
        <path d="M12 3.5 19.36 16.25H4.64L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="3.5" r="1.5" fill="currentColor" />
        <circle cx="19.36" cy="16.25" r="1.5" fill="currentColor" />
        <circle cx="4.64" cy="16.25" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "AI가 들려주는 네 장의 감정서",
    body: "쌓아 온 강점, 관계 속의 나, 앞으로의 전환점, 마지막 메시지를 네 장으로 풀어요. 어려운 점성술 용어 대신 나에게 직접 말을 거는 문장과 바로 실천할 작은 한 걸음을 담았습니다.",
    bg: "#BEF2F9",
    dark: "#1D6E86",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v5h5" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    title: "성격 진단 × 별, 두 관점의 교차 확인",
    body: "Big Five 진단에서 발견한 성격과 별이 보여 주는 기질을 나란히 살펴요. 서로 겹치는 부분과 작은 차이까지 읽어, 지금까지 선택해 온 나만의 방식에 이름을 붙입니다.",
    bg: "#D8F2C0",
    dark: "#3F7A2E",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="9" cy="12" r="5.8" />
        <circle cx="15" cy="12" r="5.8" />
      </svg>
    ),
  },
  {
    title: "언제든 다시 돌아올 수 있는 나의 출발점",
    body: "태어난 순간의 별 배치는 시간이 지나도 변하지 않아요. 선택 앞에서 망설일 때마다 다시 펼쳐 볼 수 있는 나만의 기준점으로 오래 간직할 수 있습니다.",
    bg: "#FDEFB4",
    dark: "#8F6B14",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="m15.5 8.5-2 5-5 2 2-5z" />
      </svg>
    ),
  },
] as const;

const FAQS = [
  {
    q: "‘운명의 설계도’는 어디에 도움이 되나요?",
    a: "태어난 순간의 별 배치에서 지금까지 쌓아 온 기질, 사람과 관계 맺는 방식, 앞으로 찾아올 전환점을 읽어요. 성격 진단 결과와 함께 보기 때문에 이미 알게 된 나를 한 단계 더 깊이 이해하는 데 도움이 됩니다.",
  },
  {
    q: "점성술을 몰라도 읽을 수 있나요?",
    a: "네. 전문 용어를 나열하지 않고, 나에게 직접 말을 거는 자연스러운 한국어 문장으로 전해 드려요. 네 장의 이야기와 내일부터 시도할 수 있는 작은 행동까지 함께 담습니다.",
  },
  {
    q: "구매한 뒤에는 무엇을 하면 되나요?",
    a: "생년월일·출생 시간·출생지를 입력하면 보통 1~2분 안에 설계도가 완성돼요. 출생 시간을 몰라도 만들 수 있고, 완성한 결과는 언제든 다시 읽을 수 있습니다.",
  },
  {
    q: "미래를 정확히 맞히는 점인가요?",
    a: "운명의 설계도는 오락과 자기 이해를 위한 콘텐츠이며, 정해진 미래를 단정하지 않아요. 별의 배치를 바탕으로 지금까지의 선택을 이해하고 앞으로의 방향을 생각할 계기를 전합니다.",
  },
  {
    q: "환불할 수 있나요?",
    a: "결제일로부터 30일 이내라면 전액 환불을 요청할 수 있어요. 자세한 조건은 전자상거래 표기 페이지에서 확인해 주세요.",
  },
] as const;

export default function KoUnmeiLanding({
  ownerToken,
  hasFull,
}: {
  ownerToken: string | null;
  hasFull: boolean;
}) {
  return (
    <main className="overflow-x-clip bg-white">
      <UnmeiViewTracker
        eventName="unmei_lp_view"
        ownerToken={ownerToken}
        state={hasFull ? "upgrade_eligible" : "standard"}
        product="premium_bundle"
      />

      <div className="bg-[#FFFBF2] px-4 pb-10 pt-8 md:px-8 md:pb-14 md:pt-14">
        <section className="mx-auto grid max-w-[1080px] items-center gap-8 md:grid-cols-2 md:gap-12">
          <SmoothImage
            src="/mascot/unmei-hero.png"
            alt="천구의와 별자리를 함께 살펴보는 펠트 동물들"
            width={1200}
            height={900}
            className="h-auto w-full max-w-[340px] mix-blend-multiply md:max-w-none"
            priority
          />
          <div className="text-left">
            <h1 className="leading-tight">
              <span className="block text-[30px] font-black text-[#2E2E5C] md:text-[40px]">
                오직 나를 위한
              </span>
              <span className="mt-2 inline-block rounded-xl bg-[#A36818] px-3.5 py-1 text-[36px] font-black text-white md:text-[48px]">
                운명의 설계도
              </span>
            </h1>
            <p className="mt-3 text-[16px] font-bold leading-relaxed text-[#2E2E5C]/70 md:text-[18px]">
              별의 배치와 Big Five 성격 진단을 함께 읽어, 나만의 감정서를 만들어 보세요.
            </p>
            <UnmeiPriceCta
              sessionOwnerToken={ownerToken}
              sessionHasFull={hasFull}
              launchChat
              locale="ko"
            />
          </div>
        </section>
      </div>

      <div className="bg-white">
        <svg aria-hidden="true" viewBox="0 0 1440 48" preserveAspectRatio="none" className="block h-8 w-full md:h-12">
          <path fill="#FFFBF2" d="M0,0 H1440 V22 C1320,44 1180,6 1040,18 C900,30 800,46 660,32 C520,18 440,42 300,38 C160,34 70,8 0,26 Z" />
        </svg>
        <div className="px-4 md:px-8">
          <ProofFacesBand
            lead="지금까지"
            countSuffix="명 이상"
            tail="이 나의 사용설명서 진단을 완료했어요"
          />
        </div>
      </div>

      <div className="mt-16 px-4 md:mt-24 md:px-8">
        <div className="mx-auto max-w-[1080px]">
          <section>
            <h2 className="mb-7 text-center text-[20px] font-black text-[#2E2E5C] md:mb-9 md:text-[26px]">
              운명의 설계도에서 만나는 것
            </h2>
            <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
              {FEATURES.map((feature, index) => (
                <li
                  key={feature.title}
                  className="rounded-2xl p-5 transition-transform md:p-7 md:hover:-translate-y-1"
                  style={{ background: feature.bg }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white"
                      style={{ color: feature.dark }}
                    >
                      {feature.icon}
                    </span>
                    <span
                      className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black tracking-[0.08em]"
                      style={{ color: feature.dark }}
                    >
                      POINT 0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-3.5 text-[17px] font-black leading-snug text-[#2E2E5C] md:text-[18px]">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#2E2E5C]/70 md:text-[15px]">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14 md:mt-20">
            <h2 className="mb-3 text-[24px] font-black text-[#2E2E5C] md:text-[28px]">
              자주 묻는 질문
            </h2>
            <div className="divide-y divide-[#E9E9F2] border-y border-[#E9E9F2]">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-bold text-[#2E2E5C] md:text-[17px] [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <span aria-hidden="true" className="flex-shrink-0 text-[22px] font-black leading-none text-[#5B5BEF] transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[#2E2E5C]/70 md:text-[16px]">
                    {faq.a}
                    {faq.q === "환불할 수 있나요?" ? (
                      <>
                        {" "}
                        <Link href="/ko/legal/commerce" className="font-bold text-[#5B5BEF] underline underline-offset-2">
                          자세히 보기
                        </Link>
                      </>
                    ) : null}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-10 px-4 pb-14 md:mt-12 md:px-8 md:pb-16">
        <section className="mx-auto max-w-[1080px] pb-4 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F4F4FE] text-[#5B5BEF]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.5 9A9 9 0 0 0 5.6 5.6L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3.5 15a9 9 0 0 0 14.9 3.4L21 16" />
              <path d="M21 21v-5h-5" />
              <path d="M8.5 9.5h7M9.2 12h5.6M10 14.5h4" />
            </svg>
          </span>
          <h2 className="mt-5 text-[22px] font-black text-[#2E2E5C] md:text-[26px]">
            부담 없이, 30일 전액 환불 보장
          </h2>
          <p className="mx-auto mt-2.5 max-w-[640px] text-[14px] font-bold leading-relaxed text-[#2E2E5C]/65 md:text-[15px]">
            상품이 만족스럽지 않다면 결제일로부터 30일 이내에
            {" "}
            <a href="mailto:support@watashi-torisetsu.com" className="text-[#5B5BEF] underline underline-offset-2">
              support@watashi-torisetsu.com
            </a>
            으로 연락해 주세요. 구매 금액 전액을 환불해 드립니다.
          </p>
        </section>
      </div>
    </main>
  );
}
