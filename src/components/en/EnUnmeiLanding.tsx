import Link from "next/link";
import { ProofFacesBand } from "@/components/ProofFacesBand";
import { SmoothImage } from "@/components/ui/SmoothImage";
import UnmeiPriceCta from "@/components/uranai/UnmeiPriceCta";
import UnmeiViewTracker from "@/components/uranai/UnmeiViewTracker";

const FEATURES = [
  {
    title: "A birth-chart wheel made only for you",
    body: "We recreate the sky at the moment you were born from your birth date, time, and place, then draw the planets into your own personal blueprint.",
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
    title: "A four-chapter reading written for you",
    body: "Four chapters explore what you have built, who you are with others, the turning points ahead, and one final message—with a small step you can try tomorrow.",
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
    title: "Personality × stars, viewed together",
    body: "We compare the personality found in your Big Five result with your natural tendencies in the stars, including where they align and where they differ.",
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
    title: "A starting point you can return to",
    body: "The stars at the moment of your birth do not change. Keep your Blueprint and return to it whenever you want a clearer sense of direction.",
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
    q: "What can the Destiny Blueprint help me understand?",
    a: "It reads the qualities you have developed, how you relate to people, and the turning points ahead from the sky at your birth. Combined with your personality result, it gives you another way to understand yourself.",
  },
  {
    q: "Can I read it without knowing astrology?",
    a: "Yes. It is written as a clear personal story instead of a list of technical terms. The four chapters also include small steps you can try in everyday life.",
  },
  {
    q: "What do I do after purchasing?",
    a: "Enter your birth date, birth time, and birth place. Your reading is usually created in about a minute, and you can still create it if you do not know your exact birth time.",
  },
  {
    q: "Does it predict my future?",
    a: "The Destiny Blueprint is for entertainment and self-reflection. It does not claim that your future is fixed; it offers another lens for understanding your choices and considering what comes next.",
  },
  {
    q: "Can I request a refund?",
    a: "You can request a full refund within 30 days of purchase.",
  },
] as const;

export default function EnUnmeiLanding({
  ownerToken,
  hasFull,
  trackView = true,
  launchChat = false,
  previewMode = false,
}: {
  ownerToken: string | null;
  hasFull: boolean;
  trackView?: boolean;
  launchChat?: boolean;
  previewMode?: boolean;
}) {
  const purchaseProduct = hasFull ? "premium_bundle" : "full_access";

  return (
    <main className="overflow-x-clip bg-white">
      {trackView ? (
        <UnmeiViewTracker
          eventName="unmei_lp_view"
          ownerToken={ownerToken}
          state={hasFull ? "upgrade_eligible" : "standard"}
          product={purchaseProduct}
        />
      ) : null}

      <div className="bg-[#FFFBF2] px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-[1080px]">
          <section className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
            <SmoothImage
              src="/mascot/unmei-hero-alice-transparent.png"
              alt="Alice and her felt friends gathered around a celestial globe and star chart"
              width={1448}
              height={1086}
              className="h-auto w-full max-w-[320px] md:max-w-[480px]"
              priority
            />
            <div className="text-left">
              <h1 className="leading-tight">
                <span className="block text-[28px] font-black text-[#2E2E5C] md:text-[34px]">
                  Made only for you
                </span>
                <span className="mt-1.5 inline-block rounded-xl bg-[#A36818] px-3 py-1 text-[34px] font-black text-white md:text-[42px]">
                  Destiny Blueprint
                </span>
              </h1>
              <p className="mt-3 text-[15px] font-bold leading-relaxed text-[#2E2E5C]/70 md:text-[16px]">
                Combine your birth chart with your Big Five personality result to create a reading made for you.
              </p>
              <UnmeiPriceCta
                sessionOwnerToken={ownerToken}
                sessionHasFull={hasFull}
                launchChat={launchChat}
                locale="en"
                previewMode={previewMode}
              />
            </div>
          </section>
        </div>
      </div>

      <div className="bg-white">
        <svg aria-hidden="true" viewBox="0 0 1440 48" preserveAspectRatio="none" className="block h-8 w-full md:h-12">
          <path fill="#FFFBF2" d="M0,0 H1440 V22 C1320,44 1180,6 1040,18 C900,30 800,46 660,32 C520,18 440,42 300,38 C160,34 70,8 0,26 Z" />
        </svg>
        <div className="px-4 md:px-8">
          <ProofFacesBand
            lead="More than"
            countSuffix=" people"
            tail="have completed their Alice Test"
          />
        </div>
      </div>

      <div className="mt-16 px-4 md:mt-24 md:px-8">
        <div className="mx-auto max-w-[1080px]">
          <section>
            <h2 className="mb-7 text-center text-[20px] font-black text-[#2E2E5C] md:mb-9 md:text-[26px]">
              What you’ll find in your Destiny Blueprint
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
                  <p className="mt-3.5 text-[17px] font-black leading-snug text-[#2E2E5C] md:text-[18px]">
                    {feature.title}
                  </p>
                  <p className="mt-1.5 text-[14px] font-normal leading-relaxed text-[#2E2E5C]/70 md:text-[15px]">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14 md:mt-20">
            <h2 className="mb-3 text-[24px] font-black text-[#2E2E5C] md:text-[28px]">
              Frequently asked questions
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
                    {faq.q === "Can I request a refund?" ? (
                      <>
                        {" "}
                        <Link href="/en/legal/commerce" className="mx-0.5 font-bold text-[#5B5BEF] underline underline-offset-2">
                          See the refund terms
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
        <div className="mx-auto max-w-[1080px]">
          <section className="pb-4 text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F4F4FE] text-[#5B5BEF]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.5 9A9 9 0 0 0 5.6 5.6L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3.5 15a9 9 0 0 0 14.9 3.4L21 16" />
                <path d="M21 21v-5h-5" />
                <path d="m9.9 8.6 2.1 2.9 2.1-2.9" />
                <path d="M12 11.5v4.3" />
                <path d="M10.1 12.9h3.8" />
                <path d="M10.1 14.7h3.8" />
              </svg>
            </span>
            <h2 className="mt-5 text-[22px] font-black text-[#2E2E5C] md:text-[26px]">
              Risk-free, 30-day money-back guarantee
            </h2>
            <p className="mx-auto mt-2.5 max-w-[640px] text-[14px] font-bold leading-relaxed text-[#2E2E5C]/65 md:text-[15px]">
              If you are not satisfied, contact{" "}
              <a href="mailto:support@watashi-torisetsu.com" className="mx-0.5 text-[#5B5BEF] underline underline-offset-2">
                support@watashi-torisetsu.com
              </a>{" "}
              within 30 days of purchase for a full refund.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
