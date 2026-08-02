import type { Metadata } from "next";
import { TakoResultPage } from "@/components/result/TakoResultPage";
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
      `/tako/${tokenPath}`,
      `/ko/tako/${tokenPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default async function TakoPage(props: PageProps) {
  return TakoResultPage({ ...props, locale: "ja" });
}
