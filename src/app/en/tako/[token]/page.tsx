import type { Metadata } from "next";
import EnTakoResultPage from "@/components/en/EnTakoResultPage";

export const metadata: Metadata = {
  title: "How friends see me",
  robots: { index: false, follow: false },
};

export default async function EnglishTakoResultRoute({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string | string[] }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  return <EnTakoResultPage token={token} paid={query.paid === "1"} />;
}
