import type { Metadata } from "next";
import { LoginCard } from "@/components/LoginCard";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { localizedAlternates } from "@/lib/locale-seo";
import { versionCharacterAssetPath } from "@/lib/character-image";

export const metadata: Metadata = {
  title: { absolute: "Masuk | Alice Test" },
  alternates: localizedAlternates("id", "/login", "/ko/login", "/en/login", "/id/login"),
  robots: { index: false, follow: false },
};

export default function IndonesianLoginPage() {
  return <div className="flex min-h-dvh flex-col bg-[#F1F1F7]">
    <TopHeader locale="id" />
    <main className="flex flex-1 flex-col items-center px-5 pb-16 pt-8 md:pt-12">
      <SmoothImage src={versionCharacterAssetPath("/characters/cut/dog_R.webp")} alt="" width={480} height={480} loading="eager" fetchPriority="high" className="h-auto w-[190px] md:w-[230px]" />
      <h1 className="mt-1 text-center text-[26px] font-black leading-snug text-[#2E2E5C] md:text-[30px]">Selamat datang kembali!</h1>
      <p className="mb-6 mt-2 text-center text-[13px] font-bold leading-[1.9] text-[#2E2E5C99]">Ketuk tautan di email untuk kembali ke hasil Anda.<br />Tanpa kata sandi.</p>
      <LoginCard locale="id" />
    </main>
    <TopFooter locale="id" />
  </div>;
}
