import type { Metadata } from "next";
import IdResultRedirect from "@/components/id/IdResultRedirect";

export const metadata: Metadata = { title: "Memuat hasil Anda", robots: { index: false, follow: false } };

export default function IndonesianResultPage() {
  return <IdResultRedirect />;
}
