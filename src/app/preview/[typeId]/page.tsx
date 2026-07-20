// 確認専用: 1タイプ単体のフル結果ページを本番でも踏めるプレビュールート。
// - /me の結果ページ (MePage) をそのまま再利用し、token/Supabase を介さずモックスコアで描画する。
//   MePage 側は ?previewType=<id> + fromPreview=1 でプレビュー分岐に入り、実ユーザーデータは
//   一切参照しない (モックのみ)。
// - フラグ非依存 (NEXT_PUBLIC_THIRTYTWO_ENABLED の状態に関わらず32タイプ表示可)。
// - 不正な typeId は 404。
// 例: /preview/sparkle-dolphin__R
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MePage from "@/app/me/[token]/page";
import {
  allThirtyTwoTypeIds,
  thirtyTwoEssence,
  thirtyTwoZukanDesc,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";

interface PreviewTypePageProps {
  params: Promise<{ typeId: string }>;
}

// タイプ別ランディングとして機能させる (トップ→/types→/preview で公開リンクされるため)。
// 汎用title重複を避け、型ごとの肩書き/図鑑説明でメタを出し、canonical を自己参照・index許可。
// ※ /me 本体は owner_token 保護のため noindex だが、preview はモックのみで個人情報を含まない。
export async function generateMetadata({
  params,
}: PreviewTypePageProps): Promise<Metadata> {
  const { typeId } = await params;
  if (!(allThirtyTwoTypeIds() as string[]).includes(typeId)) return {};
  const id = typeId as ThirtyTwoTypeId;
  const essence = thirtyTwoEssence(id);
  return {
    title: essence,
    description: thirtyTwoZukanDesc(id),
    alternates: { canonical: `/preview/${typeId}` },
    robots: { index: true, follow: true },
  };
}

export default async function PreviewTypePage({
  params,
}: PreviewTypePageProps) {
  const { typeId } = await params;
  const valid = (allThirtyTwoTypeIds() as string[]).includes(typeId);
  if (!valid) notFound();

  // MePage を子として描画。params.token は無視され、searchParams のプレビュー指定で
  // モック分岐に入る (fromPreview=1 により本番でも許可)。公開プレビューでは
  // previewLock を常に有効にし、課金後に解放される本文をサーバ側で解決・送信しない。
  return (
    <MePage
      params={Promise.resolve({ token: "preview" })}
      searchParams={Promise.resolve({
        previewType: typeId,
        fromPreview: "1",
        previewLock: "1",
      })}
    />
  );
}
