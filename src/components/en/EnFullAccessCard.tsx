import Link from "next/link";
import { FullAccessCta } from "@/components/result/FullAccessCta";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { EN_FULL_ACCESS_PRICE_USD_CENTS, EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION } from "@/lib/access-products";

const FEATURES = [
  {
    title: "30 replies from your personal astrologer, Alice",
    description:
      "Alice uses your personality and stars to respond to questions about relationships, work, and the choices ahead.",
  },
  {
    title: "Unlock all 9 sections of your personality result",
    description:
      "Read the full story, including relationships, career, how others see you, and how you respond under pressure.",
  },
  {
    title: "A personal ebook of 16+ pages",
    description:
      "Keep a downloadable, printable edition of your personality story and revisit it whenever you need it.",
  },
  {
    title: "All of Alice’s divination experiences",
    description:
      "Create your Destiny Blueprint and use one-card, three-card, and YES / NO tarot readings.",
  },
  {
    title: "Complete compatibility insights",
    description:
      "Explore romantic, friendship, and work compatibility, including likely points of misunderstanding.",
  },
  {
    title: "All friend-perspective results",
    description:
      "See each friend’s view of your character, personality gaps, relationship style, and compatibility.",
  },
  {
    title: "Update your friend analysis report anytime",
    description:
      "Create a PDF that combines your friends’ answers and update it whenever more responses arrive.",
  },
];

export default function EnFullAccessCard({
  ownerToken,
  purchased,
  returnTo = "me",
  imageSrc,
  imageAlt = "",
  onClose,
}: {
  ownerToken: string;
  purchased: boolean;
  returnTo?: "me" | "aisho" | "unmei" | "hoshiyomi" | "tarot";
  imageSrc?: string;
  imageAlt?: string;
  onClose?: () => void;
}) {
  if (purchased) {
    const links = [
      { href: `/en/report/${encodeURIComponent(ownerToken)}/pdf`, label: "Download my PDF" },
      { href: "/en/aisho", label: "Compatibility" },
      { href: "/en/unmei", label: "Destiny Blueprint" },
      { href: "/en/hoshiyomi", label: "Talk with Alice" },
      { href: "/en/tarot", label: "Alice Tarot" },
    ];
    return (
      <section className="mt-16 rounded-[30px] border border-[#DAD8FF] bg-white px-6 py-9 shadow-[0_16px_50px_rgba(46,46,92,0.08)] sm:px-10">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-[#5B5BEF]">Complete Edition unlocked</p>
        <h2 className="mt-2 text-[28px] font-black sm:text-[34px]">Everything is yours</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false} className="rounded-2xl bg-[#F2F0FF] px-5 py-4 text-center font-extrabold text-[#41415F] transition hover:bg-[#E9E6FF]">
              {link.label} →
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="fullaccess-promo"
      aria-labelledby="fullaccess-promo-title"
      className={onClose ? "px-3 pb-6 pt-3 md:px-6 md:pb-10 md:pt-6" : "mt-12 px-4 pb-10 pt-6 md:px-8"}
    >
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-3xl border-2 border-[#DAD8FF] bg-[#F4F2FF] shadow-[0_16px_48px_rgba(46,46,92,0.12)] ${
          imageSrc ? "max-w-[1080px] md:flex md:items-stretch" : "max-w-[760px]"
        }`}
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#5B5BEF] text-xl font-bold text-white shadow-[0_4px_14px_rgba(46,46,92,0.3)] transition hover:scale-105"
          >
            ×
          </button>
        ) : null}

        {imageSrc ? (
          <div className="hidden items-center justify-center bg-[#E8E5FF] px-6 py-8 md:flex md:w-[40%]">
            <SmoothImage
              src={imageSrc}
              alt={imageAlt}
              width={640}
              height={640}
              className="h-auto w-full max-w-[340px]"
            />
          </div>
        ) : null}

        <div className={imageSrc ? "px-6 py-6 text-left md:flex-1 md:px-9" : "px-6 py-7 text-center md:px-10"}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[14px] font-black text-[#2E2E5C] shadow-[0_2px_8px_rgba(46,46,92,0.10)]">
            <span aria-hidden="true" className="text-[#5B5BEF]">★</span>
            Unlock now
          </span>
          <h2 id="fullaccess-promo-title" className="mt-2.5 text-[26px] font-bold leading-[1.3] text-[#2E2E5C] md:text-[34px]">
            Your story isn&rsquo;t finished yet
          </h2>
          <p className="mt-2 text-[13px] leading-[1.6] text-[#5A5A6E]">
            Go beyond the free result to explore love, work, relationships, how your friends see you, and guidance from Alice.
          </p>

          <div className={`mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${imageSrc ? "" : "justify-center"}`}>
            <span className="text-[30px] font-bold leading-none tracking-[-0.02em] text-[#2E2E5C] tabular-nums md:text-[50px]">
              ${(EN_FULL_ACCESS_PRICE_USD_CENTS / 100).toFixed(2)}
            </span>
            <span className="text-[13px] font-bold text-[#5A5A6E]">tax included</span>
          </div>
          <p className={`mt-2 text-[13px] text-[#5A5A6E] ${imageSrc ? "" : "text-center"}`}>
            One-time purchase (no subscription)
          </p>

          <div className="mt-4">
            <FullAccessCta
              ownerToken={ownerToken}
              locale="en"
              product="full_access"
              returnTo={returnTo}
              source="en_complete_edition_card"
              paywallVersion={EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION}
              placement={onClose ? "modal" : "inline"}
              accentColor="#5B5BEF"
              shadowColor="#403FC2"
            >
              Unlock all results →
            </FullAccessCta>
          </div>
          <p className={`mt-2.5 text-[13px] leading-[1.6] text-[#5A5A6E] ${imageSrc ? "md:text-left" : "text-center"}`}>
            ◇ 30-day refund guarantee · trusted by more than 101,627 people
          </p>

          <div className="mt-6 rounded-[20px] bg-white px-4 py-5 text-left shadow-[0_8px_24px_rgba(46,46,92,0.06)] md:px-6 md:py-6">
            <h3 className="text-[16px] font-bold text-[#2E2E5C]">What you&rsquo;ll unlock</h3>
            <ul className="mt-4 grid gap-2.5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="grid grid-cols-[20px_1fr] gap-2">
                  <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#5B5BEF] text-[10px] font-black text-white">✓</span>
                  <span>
                    <span className="block text-[14px] font-black leading-snug text-[#2E2E5C]">{feature.title}</span>
                    <span className="block text-[12px] leading-[1.6] text-[#5A5A6E]">{feature.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-center text-[11px] font-semibold leading-relaxed text-[#5A5A6E]">
            By continuing, you agree to the{" "}
            <Link className="underline underline-offset-2" href="/en/terms">Terms</Link>,{" "}
            <Link className="underline underline-offset-2" href="/en/privacy">Privacy Policy</Link>, and{" "}
            <Link className="underline underline-offset-2" href="/en/legal/commerce">Sales &amp; Refund Policy</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
