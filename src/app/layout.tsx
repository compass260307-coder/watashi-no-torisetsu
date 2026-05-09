import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const mPlusRounded = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  variable: "--font-m-plus-rounded",
});

const BASE_URL = "https://www.watashi-torisetsu.com";
const SHARED_DESCRIPTION =
  "15問答えて、友達3人にも聞いてみる。Big Five理論ベースの性格診断で、自分でも気づかない一面を発見。大学生向け、登録不要・完全無料・3分で完成。";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "ワタシのトリセツ｜友達と作る、自分の取扱説明書",
    template: "%s｜ワタシのトリセツ",
  },
  description: SHARED_DESCRIPTION,
  applicationName: "ワタシのトリセツ",
  keywords: [
    "ワタシのトリセツ",
    "性格診断",
    "自己分析",
    "Big Five",
    "ビッグファイブ",
    "他己評価",
    "大学生",
    "友達",
    "取扱説明書",
    "トリセツ",
    "無料診断",
    "性格テスト",
  ],
  authors: [{ name: "ワタシのトリセツ運営" }],
  creator: "ワタシのトリセツ運営",
  publisher: "ワタシのトリセツ運営",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: BASE_URL,
    siteName: "ワタシのトリセツ",
    title: "ワタシのトリセツ｜友達と作る、自分の取扱説明書",
    description: SHARED_DESCRIPTION,
    images: [
      {
        url: "/ogp-v3.png",
        width: 1200,
        height: 630,
        alt: "ワタシのトリセツ - 友達と作る、自分の取扱説明書",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ワタシのトリセツ｜友達と作る、自分の取扱説明書",
    description: SHARED_DESCRIPTION,
    images: ["/ogp-v3.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Search Console 登録時に環境変数で差し替え (未設定時は出力されない)
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={mPlusRounded.variable}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
