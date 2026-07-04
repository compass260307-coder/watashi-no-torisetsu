import type { Metadata } from "next";

const BASE_URL = "https://www.watashi-torisetsu.com";

export const metadata: Metadata = {
  title: { absolute: "ワタシのトリセツ" },
  description: "友達から見たあなたを10問で教えてもらう診断",
  openGraph: {
    title: "ワタシのトリセツ",
    description: "友達から見たあなたを10問で教えてもらう診断",
    type: "website",
    siteName: "ワタシのトリセツ",
    images: [
      {
        url: `${BASE_URL}/ogp-v4.png`,
        width: 1200,
        height: 630,
        alt: "ワタシのトリセツ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ワタシのトリセツ",
    description: "友達から見たあなたを10問で教えてもらう診断",
    images: [`${BASE_URL}/ogp-v4.png`],
  },
};

export default function FriendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
