"use client";

import Footer from "@/components/en/EnSiteFooter";
import Header from "@/components/en/EnSiteHeader";
import { EN_DIAGNOSIS_SETTINGS } from "@/i18n/en/diagnosis";
import DiagnosisPageContent from "../DiagnosisPageContent";

export default function DiagnosisPage() {
  return (
    <DiagnosisPageContent
      settings={EN_DIAGNOSIS_SETTINGS}
      header={<Header />}
      footer={<Footer topBorder={false} />}
      consentNotice={null} />
  );
}
