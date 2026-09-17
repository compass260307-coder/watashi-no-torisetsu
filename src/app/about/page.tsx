import type { Metadata } from "next";
import AboutPageContent from "@/components/about/AboutPageContent";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "サービスについて",
  description: "ワタシのトリセツは、自分の診断と友達からの他己評価をかけ合わせて作る自己理解サービス。Big Five 心理学をベースに、「友達から見えているワタシ」がわかります。",
  alternates: localizedAlternates("ja", "/about", "/ko/about"),
  openGraph: {
    title: "サービスについて｜ワタシのトリセツ",
    description: "自分の診断と友達からの他己評価をかけ合わせて作る、自分の取扱説明書。",
    images: [{ url: "/ogp-v5.jpg", width: 1200, height: 630 }],
  },
};

export default function AboutPage() {
  return <AboutPageContent locale="ja" />;
}
