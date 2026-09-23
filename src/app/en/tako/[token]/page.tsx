import type { Metadata } from "next";
import EnTakoResultPage from "@/components/en/EnTakoResultPage";
import { localizedAlternates } from "@/lib/locale-seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const tokenPath = encodeURIComponent(token);
  return {
    title: "How friends see me",
    alternates: localizedAlternates(
      "en",
      `/tako/${tokenPath}`,
      `/ko/tako/${tokenPath}`,
      `/en/tako/${tokenPath}`,
      `/id/tako/${tokenPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default async function EnglishTakoResultRoute({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    paid?: string | string[];
    session_id?: string | string[];
  }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  return (
    <EnTakoResultPage
      token={token}
      paid={query.paid === "1"}
      sessionId={query.session_id}
    />
  );
}
