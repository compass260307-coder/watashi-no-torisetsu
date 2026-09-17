import type { Metadata } from "next";
import { LoginCard } from "@/components/LoginCard";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { localizedAlternates } from "@/lib/locale-seo";
import { versionCharacterAssetPath } from "@/lib/character-image";

export const metadata: Metadata = {
  title: { absolute: "Sign in | Alice Personalities" },
  alternates: localizedAlternates("en", "/login", "/ko/login", "/en/login"),
  robots: { index: false, follow: false },
};

export default function EnglishLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F1F1F7]">
      <EnSiteHeader />
      <main className="flex flex-1 flex-col items-center px-5 pb-16 pt-8 md:pt-12">
        <SmoothImage
          src={versionCharacterAssetPath("/characters/cut/dog_R.webp")}
          alt=""
          width={480}
          height={480}
          priority
          className="h-auto w-[190px] md:w-[230px]"
        />
        <h1 className="mt-1 text-center text-[26px] font-black leading-snug md:text-[30px]" style={{ color: "#2E2E5C" }}>
          Welcome back!
        </h1>
        <p className="mt-2 mb-6 text-center text-[13px] font-bold leading-[1.9]" style={{ color: "#2E2E5C99" }}>
          Tap the link in your email to return to your results.
          <br />
          No password needed.
        </p>
        <LoginCard locale="en" />
      </main>
      <EnSiteFooter />
    </div>
  );
}
