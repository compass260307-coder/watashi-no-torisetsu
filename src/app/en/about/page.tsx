import type { Metadata } from "next";
import Link from "next/link";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { localizedAlternates } from "@/lib/locale-seo";

const DESCRIPTION = "Learn how Alice Diagnosis combines a Big Five personality test with friend perspectives to help you see yourself more clearly.";

export const metadata: Metadata = {
  title: "About",
  description: DESCRIPTION,
  alternates: localizedAlternates("en", "/about", "/ko/about", "/en/about"),
  robots: { index: true, follow: true },
};

const steps = [
  ["1", "Take the personality test", "Answer 50 Big Five questions in about three minutes."],
  ["2", "Meet your character", "Your result becomes one of 32 memorable character types, with a detailed personal guide."],
  ["3", "Invite people who know you", "Friends answer a shorter set of questions from their point of view."],
  ["4", "Compare the two perspectives", "See where your self-image and other people’s impressions meet—and where they differ."],
] as const;

export default function EnglishAboutPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-[#2E2E5C]">
      <EnSiteHeader />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-16 sm:px-8 sm:py-24">
        <section>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#5B5BEF]">About the service</p>
          <h1 className="mt-4 max-w-[760px] text-[38px] font-black leading-tight sm:text-[54px]">Sometimes your friends notice parts of you that you cannot see yourself.</h1>
          <p className="mt-7 max-w-[720px] text-[17px] font-semibold leading-[1.9] text-[#66667D]">
            Alice Diagnosis combines your own answers with perspectives from people who know you. The result is not a label or a clinical diagnosis—it is a friendly way to reflect, compare, and start better conversations.
          </p>
        </section>

        <section className="mt-20">
          <h2 className="text-[28px] font-black">Why Big Five?</h2>
          <p className="mt-4 text-base leading-[1.9] text-[#66667D]">
            The Big Five is a widely used framework for describing personality tendencies across openness, conscientiousness, extraversion, agreeableness, and emotional sensitivity. We turn combinations of those dimensions into 32 character types so the result is easier to understand, remember, and share.
          </p>
        </section>

        <section className="mt-20">
          <h2 className="text-[28px] font-black">How it works</h2>
          <ol className="mt-7 grid gap-4 sm:grid-cols-2">
            {steps.map(([number, title, body]) => (
              <li key={number} className="rounded-3xl bg-[#F4F3FF] p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5B5BEF] font-black text-white">{number}</span>
                <h3 className="mt-4 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#727287]">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 rounded-[30px] bg-[#2E2E5C] p-7 text-white sm:p-10">
          <h2 className="text-[28px] font-black">What we protect</h2>
          <ul className="mt-5 space-y-3 text-sm font-semibold leading-relaxed text-white/80">
            <li>• Results are for self-reflection, not medical or psychological diagnosis.</li>
            <li>• Your private result link should be shared only with people you choose.</li>
            <li>• Payment-card details are handled directly by Stripe.</li>
            <li>• You can contact us to request help with access, privacy, or a refund.</li>
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/en/diagnosis" className="rounded-full bg-white px-6 py-3 font-black text-[#2E2E5C]">Take the free test</Link>
            <Link href="/en/privacy" className="rounded-full border border-white/30 px-6 py-3 font-black text-white">Read our Privacy Policy</Link>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-[28px] font-black">Questions or support</h2>
          <p className="mt-4 text-base leading-[1.9] text-[#66667D]">The Service is operated from Japan by Ryunosuke Futami and the Alice Diagnosis Operations Team. Email <a className="font-bold underline underline-offset-2" href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>.</p>
        </section>
      </main>
      <EnSiteFooter />
    </div>
  );
}
