import type { Metadata } from "next";
import MeResultPage from "@/components/result/MeResultPage";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function MePage(props: PageProps) {
  return <MeResultPage {...props} locale="ja" />;
}
