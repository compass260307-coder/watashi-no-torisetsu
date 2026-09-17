import Link from "next/link";
import { EN_HOME_FAQS } from "@/lib/locale-seo";

const FEATURES = [
  {
    label: "OCEAN profile",
    title: "Understand five personality traits",
    body: "See your pattern across Openness, Conscientiousness, Extraversion, Agreeableness, and Neuroticism instead of being reduced to a single label.",
  },
  {
    label: "32 characters",
    title: "Remember what your scores mean",
    body: "Your Big Five pattern becomes one of 32 character types, giving you an approachable way to understand and share the result.",
  },
  {
    label: "Friend feedback",
    title: "Compare two points of view",
    body: "Invite friends to describe how they experience you and discover where their perspective matches—or differs from—your self-image.",
  },
] as const;

const GUIDES = [
  {
    href: "/en/articles/ocean-shindan",
    title: "What is the OCEAN personality test?",
    body: "A clear introduction to the five Big Five traits.",
  },
  {
    href: "/en/articles/sixteen-types-vs-ocean",
    title: "Big Five vs. 16-type tests",
    body: "Learn how continuous traits differ from type categories.",
  },
  {
    href: "/en/articles/tako-bunseki",
    title: "How to ask friends for feedback",
    body: "Use another point of view to discover what you cannot see alone.",
  },
] as const;

export default function EnSeoContent() {
  return (
    <div className="bg-[#F7F6FF] text-[#2E2E5C]">
      <section
        aria-labelledby="alice-personalities-introduction"
        className="mx-auto max-w-[1120px] px-6 py-20 sm:px-8 sm:py-28"
      >
        <div className="max-w-[780px]">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#5B5BEF]">
            Alice Personalities
          </p>
          <h2
            id="alice-personalities-introduction"
            className="mt-4 text-[34px] font-black leading-tight sm:text-[48px]"
          >
            A Big Five personality test with a second point of view
          </h2>
          <p className="mt-6 text-[17px] font-semibold leading-[1.9] text-[#66667D]">
            Alice Personalities is a free, 50-question personality test based on the
            Big Five, also known as the OCEAN model. It measures five traits,
            matches your pattern with one of 32 characters, and lets you
            compare your answers with feedback from friends.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/en/diagnosis"
              prefetch={false}
              className="rounded-full bg-[#5B5BEF] px-7 py-3.5 font-black text-white transition-transform hover:translate-y-px"
            >
              Take the free Alice Personalities test →
            </Link>
            <Link
              href="/en/about"
              className="rounded-full border border-[#D6D2F7] bg-white px-7 py-3.5 font-black text-[#4949C9]"
            >
              How it works
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.label}
              className="rounded-[28px] border border-[#E4E1FA] bg-white p-7 shadow-[0_16px_45px_rgba(46,46,92,0.06)]"
            >
              <p className="text-xs font-black uppercase tracking-[0.13em] text-[#7777E8]">
                {feature.label}
              </p>
              <h3 className="mt-3 text-xl font-black leading-snug">
                {feature.title}
              </h3>
              <p className="mt-3 text-[15px] font-medium leading-[1.8] text-[#6E6E83]">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="personality-guides"
        className="border-y border-[#E4E1FA] bg-white px-6 py-20 sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-[1120px]">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[#5B5BEF]">
                Personality guides
              </p>
              <h2
                id="personality-guides"
                className="mt-3 text-[30px] font-black leading-tight sm:text-[40px]"
              >
                Learn before—or after—you take the test
              </h2>
            </div>
            <Link
              href="/en/articles"
              className="font-black text-[#4949C9] underline decoration-[#C7C3F8] decoration-2 underline-offset-4"
            >
              Browse all guides →
            </Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {GUIDES.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="group rounded-[24px] bg-[#F7F6FF] p-6 transition-colors hover:bg-[#EFEDFF]"
              >
                <h3 className="text-lg font-black leading-snug group-hover:text-[#4949C9]">
                  {guide.title}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-[#747488]">
                  {guide.body}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="alice-personalities-faq"
        className="mx-auto max-w-[900px] px-6 py-20 sm:px-8 sm:py-28"
      >
        <p className="text-center text-sm font-black uppercase tracking-[0.14em] text-[#5B5BEF]">
          Frequently asked questions
        </p>
        <h2
          id="alice-personalities-faq"
          className="mt-3 text-center text-[32px] font-black leading-tight sm:text-[42px]"
        >
          Questions about Alice Personalities
        </h2>
        <div className="mt-10 space-y-3">
          {EN_HOME_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-[22px] border border-[#DFDCF7] bg-white px-6 py-1"
            >
              <summary className="cursor-pointer list-none py-5 text-[17px] font-black [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-5">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="text-2xl font-medium text-[#7777E8] transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="pb-6 pr-8 text-[15px] font-medium leading-[1.85] text-[#6E6E83]">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-14 rounded-[30px] bg-[#2E2E5C] px-7 py-10 text-center text-white sm:px-12">
          <h2 className="text-[28px] font-black sm:text-[34px]">
            Ready to discover your personality type?
          </h2>
          <p className="mx-auto mt-3 max-w-[620px] text-[15px] font-semibold leading-relaxed text-white/75">
            Answer 50 questions, discover your Big Five profile, and invite
            friends when you are ready to compare perspectives.
          </p>
          <Link
            href="/en/diagnosis"
            prefetch={false}
            className="mt-7 inline-block rounded-full bg-white px-8 py-4 font-black text-[#2E2E5C] transition-transform hover:translate-y-px"
          >
            Start the free personality test →
          </Link>
        </div>
      </section>
    </div>
  );
}
