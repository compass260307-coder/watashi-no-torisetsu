"use client";

import Footer from "@/components/id/IdSiteFooter";
import Header from "@/components/id/IdSiteHeader";
import { ID_DIAGNOSIS_SETTINGS } from "@/i18n/id/diagnosis";
import DiagnosisPageContent from "../DiagnosisPageContent";

export default function DiagnosisPage() {
  return (
    <DiagnosisPageContent
      settings={ID_DIAGNOSIS_SETTINGS}
      header={<Header />}
      footer={<Footer />}
      consentNotice={<p className="max-w-xl text-[11px] leading-[1.7] text-[#2E2E5C]/55">
    Dengan melihat hasil, Anda menyetujui penggunaan jawaban dan nama panggilan untuk menghitung serta menyimpan hasil kepribadian Anda.
  </p>} />
  );
}
