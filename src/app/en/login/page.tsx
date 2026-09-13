import type { Metadata } from "next";
import { LoginCard } from "@/components/LoginCard";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { localizedAlternates } from "@/lib/locale-seo";
import { versionCharacterAssetPath } from "@/lib/character-image";

export const metadata: Metadata = {
  title: { absolute: "Sign in | Alice Test" },
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
        <h1 className="mt-1 text-center text-[28px] font-black leading-snug text-[#2E2E5C] md:text-[32px]">
          Welcome back!
        </h1>
        <p className="mb-6 mt-2 text-center text-[14px] font-bold leading-[1.8] text-[#2E2E5C]/60">
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
