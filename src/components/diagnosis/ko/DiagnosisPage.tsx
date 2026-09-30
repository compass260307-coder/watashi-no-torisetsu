"use client";

import Footer from "@/components/ko/top/KoTopFooter";
import Header from "@/components/ko/top/KoTopHeader";
import { KO_DIAGNOSIS_SETTINGS } from "@/i18n/ko/diagnosis";
import Link from "next/link";
import DiagnosisPageContent from "../DiagnosisPageContent";

export default function DiagnosisPage() {
  return (
    <DiagnosisPageContent
      settings={KO_DIAGNOSIS_SETTINGS}
      header={<Header />}
      footer={<Footer topBorder={false} />}
      consentNotice={<p className="max-w-xl text-[11px] leading-[1.7] text-[#2E2E5C]/55">
    결과 보기를 누르면 답변과 닉네임이 진단 결과 계산·저장에 사용됩니다. 자세한 내용은{" "}
    <Link href="/ko/privacy" className="font-bold underline underline-offset-2">
      개인정보처리방침
    </Link>
    에서 확인할 수 있습니다.
  </p>} />
  );
}
