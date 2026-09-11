import type { Metadata } from "next";
import EnTakoResultPage from "@/components/en/EnTakoResultPage";

export const metadata: Metadata = {
  title: "How friends see me",
  robots: { index: false, follow: false },
};

export default async function EnglishTakoResultRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <EnTakoResultPage token={token} />;
}
