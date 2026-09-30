"use client";

import Footer from "@/components/top/TopFooter";
import Header from "@/components/top/TopHeader";
import { JA_DIAGNOSIS_SETTINGS } from "@/i18n/ja/diagnosis";
import DiagnosisPageContent from "../DiagnosisPageContent";

export default function DiagnosisPage() {
  return (
    <DiagnosisPageContent
      settings={JA_DIAGNOSIS_SETTINGS}
      header={<Header />}
      footer={<Footer topBorder={false} />}
      consentNotice={null} />
  );
}
