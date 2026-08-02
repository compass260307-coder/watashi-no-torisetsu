import type { Metadata } from "next";
import TypesGalleryPage from "@/components/types/TypesGalleryPage";

const BASE_URL = "https://www.watashi-torisetsu.com";

export const metadata: Metadata = {
  title: "性格タイプ",
  description:
    "ワタシのトリセツの32の性格タイプを、海・陸・空・未知の4つのグループで紹介。Big Five理論ベースの性格診断でわかる、あなたと友達のタイプをチェックしよう。",
  alternates: {
    canonical: "/types",
    languages: {
      "ja-JP": `${BASE_URL}/types`,
      "ko-KR": `${BASE_URL}/ko/types`,
      "x-default": `${BASE_URL}/types`,
    },
  },
};

export default function TypesPage() {
  return <TypesGalleryPage locale="ja" />;
}
