import type { Metadata } from "next";
import "./globals.css";

const BASE_URL = "https://watashi-no-torisetsu.vercel.app";

export const metadata: Metadata = {
  title: "ワタシのトリセツ｜友達と作る、ワタシのトリセツ",
  description:
    "自分が思う私と、友達から見える私。そのギャップが、本当のあなたを見せてくれる。15問の診断で、あなたのトリセツを作ろう。",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "ワタシのトリセツ｜友達と作る、ワタシのトリセツ",
    description: "15問の診断で、あなたのトリセツを作ろう。",
    type: "website",
    siteName: "ワタシのトリセツ",
    images: [{ url: "/ogp-v2.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ワタシのトリセツ",
    description: "15問の診断で、あなたのトリセツを作ろう。",
    images: ["/ogp-v2.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
