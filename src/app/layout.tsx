import { Suspense } from "react";
import type { Metadata } from "next";
import {
  M_PLUS_Rounded_1c,
  Zen_Maru_Gothic,
  Noto_Sans_JP,
} from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import GoogleAnalyticsTracker from "@/components/GoogleAnalyticsTracker";

const mPlusRounded = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  // 900 は Phase 1.5-α Brand v2 ヒーローの h1 / CTA (font-black) で使用
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
  variable: "--font-m-plus-rounded",
});

// feat/top-page: 新トップページ (TopHero) 専用フォント。
// 既存ページの M PLUS Rounded はそのまま、トップだけ Zen Maru Gothic を使う
// (見出し/ロゴ/ラベル/CTA = 700, 本文 = 400)。CSS 変数で局所適用する。
const zenMaru = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-zen-maru",
});

// feat/top-page (16P型リニューアル): トップヒーローのタイポ。
// H1=極太ゴシック(Noto Sans JP 800)、本文=ゴシック(Noto Sans JP 400/500/700)。
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  variable: "--font-noto-sans",
});

const BASE_URL = "https://www.watashi-torisetsu.com";

// Day 12-C3: SNS媒体別＋キャンペーン別の新規流入元 first-touch キャプチャ。
// 描画の最上流で同期的に実行 (InAppBrowserModal / リダイレクト等の前) し、
// localStorage に保存する。ロジックは src/lib/acquisition.ts と同義 (最上流で
// 同期実行するためインライン化が必要)。
//   - source   : utm_source 優先 / なければ ref
//   - campaign : utm_campaign 優先 / なければ camp
//   - first-touch: 既に値があれば上書きしない
//   - LIFF はクエリを落とすので liff.state / state に退避された元クエリも見る
// ⚠️ source_user_id / generation (招待ツリー) とは無関係。
const ACQUISITION_CAPTURE_SCRIPT = `(function(){try{
var SK='wt_acq_source',CK='wt_acq_campaign';
function pick(p){return{s:p.get('utm_source')||p.get('ref'),c:p.get('utm_campaign')||p.get('camp')};}
var qp=new URLSearchParams(window.location.search);
var a=pick(qp);
if(!a.s&&!a.c){var st=qp.get('liff.state')||qp.get('state');if(st){try{var d=decodeURIComponent(st);var i=d.indexOf('?');var ip=new URLSearchParams(i>=0?d.slice(i+1):d);a=pick(ip);}catch(e){}}}
if(a.s&&!localStorage.getItem(SK))localStorage.setItem(SK,a.s);
if(a.c&&!localStorage.getItem(CK))localStorage.setItem(CK,a.c);
}catch(e){}})();`;
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
    <html
      lang="ja"
      className={`${mPlusRounded.variable} ${zenMaru.variable} ${notoSansJP.variable}`}
    >
      <body className="min-h-dvh flex flex-col">
        {/* Day 12-C3: 流入元 first-touch キャプチャ (最上流・同期実行) */}
        <script dangerouslySetInnerHTML={{ __html: ACQUISITION_CAPTURE_SCRIPT }} />
        {children}
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <GoogleAnalyticsTracker />
        </Suspense>
      </body>
    </html>
  );
}
