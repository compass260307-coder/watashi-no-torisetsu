import Link from "next/link";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";

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
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi" | "tarot";
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
    <FullAccessPromoCard
      ownerToken={ownerToken}
      imageSrc={imageSrc}
      imageAlt={imageAlt}
      variant={returnTo === "aisho" ? "aisho" : "self"}
      locale="en"
      returnTo={returnTo}
      anchorId={onClose ? "fullaccess-promo-modal" : "fullaccess-promo"}
      onClose={onClose}
      surface={returnTo === "tako" ? "tako" : "self"}
      ctaSource="en_complete_edition_card"
      cardMode="legacy"
    />
  );
}
