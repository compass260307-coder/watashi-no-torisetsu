import { isTarotTheme } from "@/components/tarot/tarot-themes";
import { notFound } from "next/navigation";
import TarotLanding from "@/components/tarot/TarotLanding";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import { isTarotMode } from "@/components/tarot/tarot-data";

// 実データや決済履歴を変更せず、購入後の下部ナビを確認するローカル専用ページ。
export default async function TarotPaidPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string | string[]; theme?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = (await searchParams) ?? {};
  const mode = typeof query.mode === "string" ? query.mode : "";

  return isTarotMode(mode) ? (
    <TarotDrawExperience mode={mode} theme={mode === "three" && isTarotTheme(query.theme) ? query.theme : undefined} previewMode />
  ) : (
    <TarotLanding previewMode />
  );
}
