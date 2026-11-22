// /aisho ページ用のメタデータ。page.tsx は "use client" のため metadata を持てず、
// トップと同じ汎用 title になっていた。公開・シェアされる集客ページなので、
// このサーバ層で専用 title / description / canonical を付与する (見た目は不変)。
import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

// 2026-11-22 本人指示: 日本語版の相性ページは検索結果に出さない（課金済みの人だけの画面にする）。
// 未課金の人は AishoPage が診断側へ送る。サイトマップからも外している（locale-seo の jaNoindex）。
export const metadata: Metadata = {
  title: "相性診断",
  description:
    "気になるあの子との相性を、キャラを選ぶだけで診断。ワタシのトリセツの性格タイプで、ふたりのバランス・いいところ・シーン別の相性が分かる。",
  robots: { index: false, follow: true },
  alternates: localizedAlternates(
    "ja",
    "/aisho",
    "/ko/aisho",
    "/en/aisho",
    "/id/aisho",
  ),
  openGraph: {
    title: "相性診断｜ワタシのトリセツ",
    description:
      "気になるあの子との相性を、キャラを選ぶだけで診断。",
    url: "/aisho",
    type: "website",
    // openGraph はルート layout の設定を丸ごと置き換えるため、
    // images を書かないと og:image が消えてシェアカードに画像が出ない。
    images: [
      {
        url: "/ogp-v5.jpg",
        width: 1200,
        height: 630,
        alt: "相性診断｜ワタシのトリセツ",
      },
    ],
  },
};

export default function AishoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
