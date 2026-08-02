import type { Metadata } from "next";
import MeResultPage from "@/components/result/MeResultPage";
import { localizedAlternates } from "@/lib/locale-seo";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: Pick<PageProps, "params">): Promise<Metadata> {
  const { token } = await params;
  const tokenPath = encodeURIComponent(token);
  return {
    alternates: localizedAlternates(
      "ja",
      `/me/${tokenPath}`,
      `/ko/me/${tokenPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default function MePage(props: PageProps) {
  return <MeResultPage {...props} locale="ja" />;
}
