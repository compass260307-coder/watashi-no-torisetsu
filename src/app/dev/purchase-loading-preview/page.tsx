import { notFound } from "next/navigation";
import { PurchaseLoadingScreen } from "@/components/result/PurchaseLoadingScreen";
import { preferFaceImage } from "@/lib/character-image";
import { heroColorsForGroup, resultActionColorsForGroup } from "@/lib/hero-colors";
import {
  thirtyTwoEssence,
  thirtyTwoGroup,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";

// 完全版の購入直後の準備画面の UI 確認専用ページ。本番デプロイではページ自体を公開しない。
// 本番と同じ文言・20秒で流れ、終わると最初から流し直す。
//   ?type=sparkle-dolphin__N のように、2枚目の図に出す本人のタイプを選べる (指定なしは earnest-elephant__N)。
export default async function PurchaseLoadingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const typeId = (
    typeof params.type === "string" && /^[a-z-]+__[NR]$/.test(params.type)
      ? params.type
      : "earnest-elephant__N"
  ) as ThirtyTwoTypeId;
  const group = thirtyTwoGroup(typeId);
  const action = resultActionColorsForGroup(group);

  return (
    <PurchaseLoadingScreen
      ownerToken="preview"
      waitingForAccess={false}
      preview
      self={{
        face: preferFaceImage(thirtyTwoImagePath(typeId)),
        typeName: thirtyTwoEssence(typeId),
        heroColor: heroColorsForGroup(group).heroBg,
        buttonColor: action.accent,
        buttonShadow: action.shadow,
      }}
    />
  );
}
