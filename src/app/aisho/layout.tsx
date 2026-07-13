// /aisho ページ用のメタデータ。page.tsx は "use client" のため metadata を持てず、
// トップと同じ汎用 title になっていた。公開・シェアされる集客ページなので、
// このサーバ層で専用 title / description / canonical を付与する (見た目は不変)。
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "相性診断",
  description:
    "気になるあの子との相性を、キャラを選ぶだけで診断。自分の診断がなくてもOK。ワタシのトリセツの性格タイプで、ふたりのバランス・いいところ・シーン別の相性がわかる。",
  alternates: { canonical: "/aisho" },
  openGraph: {
    title: "相性診断｜ワタシのトリセツ",
    description:
      "気になるあの子との相性を、キャラを選ぶだけで診断。自分の診断がなくてもOK。",
    url: "/aisho",
    type: "website",
  },
};

export default function AishoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
