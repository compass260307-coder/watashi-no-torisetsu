// 確認専用: 1タイプ単体のフル結果ページを本番でも踏めるプレビュールート。
// - /me の結果ページ (MePage) をそのまま再利用し、token/Supabase を介さずモックスコアで描画する。
//   MePage 側は ?previewType=<id> + fromPreview=1 でプレビュー分岐に入り、実ユーザーデータは
//   一切参照しない (モックのみ)。
// - フラグ非依存 (NEXT_PUBLIC_THIRTYTWO_ENABLED の状態に関わらず32タイプ表示可)。
// - 不正な typeId は 404。
// 例: /preview/sparkle-dolphin__R
import { notFound } from "next/navigation";
import MePage from "@/app/me/[token]/page";
import { allThirtyTwoTypeIds } from "@/lib/thirty-two-types";

interface PreviewTypePageProps {
  params: Promise<{ typeId: string }>;
}

export default async function PreviewTypePage({
  params,
}: PreviewTypePageProps) {
  const { typeId } = await params;
  const valid = (allThirtyTwoTypeIds() as string[]).includes(typeId);
  if (!valid) notFound();

  // MePage を子として描画。params.token は無視され、searchParams のプレビュー指定で
  // モック分岐に入る (fromPreview=1 により本番でも許可)。
  return (
    <MePage
      params={Promise.resolve({ token: "preview" })}
      searchParams={Promise.resolve({
        previewType: typeId,
        fromPreview: "1",
      })}
    />
  );
}
