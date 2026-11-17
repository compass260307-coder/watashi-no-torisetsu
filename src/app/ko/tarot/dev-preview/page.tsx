import { isTarotTheme } from "@/components/tarot/tarot-themes";
import { notFound } from "next/navigation";
import TarotLanding from "@/components/tarot/TarotLanding";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import { isTarotMode } from "@/components/tarot/tarot-data";

// 日本語版 (src/app/tarot/dev-preview) と同じ、購入後のタロットを確認するローカル専用ページ。
// 実データや決済履歴は変更しない。本番デプロイではページ自体を公開しない。
export default async function KoreanTarotPaidPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string | string[]; theme?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = (await searchParams) ?? {};
  const mode = typeof query.mode === "string" ? query.mode : "";

  return isTarotMode(mode) ? (
    <TarotDrawExperience
      mode={mode}
      locale="ko"
      theme={mode === "three" && isTarotTheme(query.theme) ? query.theme : undefined}
      previewMode
    />
  ) : (
    <TarotLanding locale="ko" previewMode />
  );
}
