import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "운명의 설계도 | 나의 사용설명서",
  robots: { index: false, follow: false },
};

export default function KoreanUnmeiRedirectPage() {
  redirect("/ko");
}
