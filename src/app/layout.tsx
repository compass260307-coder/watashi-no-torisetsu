import { Suspense } from "react";
import type { Metadata } from "next";
import { M_PLUS_Rounded_1c, Noto_Sans_JP } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import GoogleAnalyticsTracker from "@/components/GoogleAnalyticsTracker";
import { BottomNav } from "@/components/BottomNav";

const GOOGLE_TAG_MANAGER_ID = "GTM-K39CJGCF";
const GOOGLE_TAG_MANAGER_SCRIPT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GOOGLE_TAG_MANAGER_ID}');`;

const mPlusRounded = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  // 丸ゴはロゴ用レタリングのみ: .wtr-name/.wtr-sub=800 / .wtr-logo-text=900。
  // 本文は Noto Sans に統一済みのため他ウェイトは読み込まない
  // (日本語フォントは 1 ウェイト ≈ 125 個の @font-face になり CSS が肥大するため)。
  weight: ["800", "900"],
  display: "swap",
  variable: "--font-m-plus-rounded",
});

// サイト全体のゴシック (--font-noto-sans)。body 既定 + .body-gothic も共用。
// H1=極太ゴシック(Noto Sans JP 800)、本文=ゴシック(Noto Sans JP 400/500/700)。
// ※ 以前は結果ページ本文用に 400/500 の別インスタンス (--font-noto-sans-jp) が
//   あったが、同一ファミリーで @font-face が丸ごと重複していたため統合した。
const notoSansTop = Noto_Sans_JP({
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
// TikTok広告CV計測: ttclid + utm_* の着地時キャプチャ (last-touch)。
// 上の first-touch (wt_acq_*) とは別系統・別キー (wt_ad_*)。ロジックは
// src/lib/ad-attribution.ts と対 (読み出し側)。追跡パラメータを1つでも
// 含む着地は「新しいクリック」とみなしセット全体を置き換える
// (別キャンペーンの古い値が混ざり残らないように、無いキーは削除する)。
const AD_CLICK_CAPTURE_SCRIPT = `(function(){try{
var KEYS={ttclid:'wt_ad_ttclid',utm_source:'wt_ad_utm_source',utm_medium:'wt_ad_utm_medium',utm_campaign:'wt_ad_utm_campaign',utm_content:'wt_ad_utm_content'};
var qp=new URLSearchParams(window.location.search);
var hit=false;
for(var k in KEYS){if(qp.get(k)){hit=true;break;}}
if(!hit)return;
for(var k in KEYS){var v=qp.get(k);if(v)localStorage.setItem(KEYS[k],v);else localStorage.removeItem(KEYS[k]);}
}catch(e){}})();`;
// 流入元リファラー補完: 外部サイトからの着地時に referrer のホスト名だけを
// first-touch で保存する (wt_ref_host)。utm 無し流入 (検索・SNS内リンク等) の
// acquisition_source フォールバックに使う (読み出し/ホスト→source 変換は
// src/lib/acquisition.ts の resolveAcquisitionForSave)。
// 自ドメインは保存しない。アプリ内 webview は referrer が空のことが多く、
// その場合は従来どおり何も保存されない。
const REFERRER_CAPTURE_SCRIPT = `(function(){try{
var RK='wt_ref_host';
if(localStorage.getItem(RK))return;
var r=document.referrer;
if(!r)return;
var h=new URL(r).hostname;
if(!h||h===window.location.hostname)return;
if(/(^|\\.)watashi-torisetsu\\.com$/.test(h))return;
localStorage.setItem(RK,h);
}catch(e){}})();`;
const DOCUMENT_LANGUAGE_SCRIPT = `(function(){try{
document.documentElement.lang=window.location.pathname.indexOf('/ko')===0?'ko':'ja';
}catch(e){}})();`;
// 16Personalities の SERP を参考に、キーワード直球タイトル + 会話調ベネフィット
// の説明文へ (2026-07-13)。サイト名は WebSite JSON-LD で別途表示されるため、
// タイトルは「無料性格診断テスト」を先頭に置く。
const SHARED_TITLE = "友達と作る無料性格診断テスト｜ワタシのトリセツ";
const SHARED_DESCRIPTION =
  "OCEAN(ビッグファイブ)理論ベースの無料性格診断テスト。約3分で、16タイプ性格診断よりも細かい32タイプのキャラからあなたが見つかります。友達の回答で、自分では気づかない一面までわかる自分だけの取扱説明書が完成。";
const NAVER_SITE_VERIFICATION = "1a6c30462dd160bccda48dddb946fcaaeba0047";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: SHARED_TITLE,
    template: "%s｜ワタシのトリセツ",
  },
  description: SHARED_DESCRIPTION,
  applicationName: "ワタシのトリセツ",
  keywords: [
    "ワタシのトリセツ",
    "私のトリセツ",
    "わたしのトリセツ",
    "ワタシの取説",
    "私の取説",
    "私の取扱説明書",
    "無料性格診断テスト",
    "性格診断テスト",
    "性格診断",
    "MBTI",
    "MBTI診断",
    "OCEAN",
    "OCEAN診断",
    "ビッグファイブ診断",
    "16タイプ",
    "キャラ診断",
    "32タイプ",
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
    title: SHARED_TITLE,
    description: SHARED_DESCRIPTION,
    images: [
      {
        url: "/ogp-v5.jpg",
        width: 1200,
        height: 630,
        alt: "ワタシのトリセツ - 友達と作る、自分の取扱説明書",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARED_TITLE,
    description: SHARED_DESCRIPTION,
    images: ["/ogp-v5.jpg"],
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
  verification: {
    // Search Console 登録時に環境変数で差し替え (未設定時は google は出力されない)
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    // Meta (Facebook) ビジネスマネージャのドメイン認証 (meta タグ方式)。
    other: {
      "facebook-domain-verification": "cr33tjgivkzknog0zudspl9sx2ssxz",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${mPlusRounded.variable} ${notoSansTop.variable}`}
    >
      <head>
        <meta name="naver-site-verification" content={NAVER_SITE_VERIFICATION} />
        <script dangerouslySetInnerHTML={{ __html: DOCUMENT_LANGUAGE_SCRIPT }} />
      </head>
      <body
        className="min-h-dvh flex flex-col"
        // 全ページ共通のボトムナビ (fixed) に本文が隠れないよう、バー実測高
        // (56px 相当) + ナビの safe-area 余白と同じ量を最下部に確保する
        // (BottomNav の padding-bottom と一致させ、本文が隠れず二重スキマも防ぐ)。
        style={{
          paddingBottom: "calc(56px + max(env(safe-area-inset-bottom) - 14px, 0px))",
        }}
      >
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GOOGLE_TAG_MANAGER_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        {/* Day 12-C3: 流入元 first-touch キャプチャ (最上流・同期実行) */}
        <script dangerouslySetInnerHTML={{ __html: ACQUISITION_CAPTURE_SCRIPT }} />
        {/* TikTok広告CV計測: ttclid + utm_* の last-touch キャプチャ (wt_ad_*) */}
        <script dangerouslySetInnerHTML={{ __html: AD_CLICK_CAPTURE_SCRIPT }} />
        {/* 流入元リファラー補完: 外部 referrer ホストの first-touch キャプチャ (wt_ref_host) */}
        <script dangerouslySetInnerHTML={{ __html: REFERRER_CAPTURE_SCRIPT }} />
        {children}
        {/* 全ページ共通ボトムナビ (ハンバーガー撤去の代替) */}
        <BottomNav />
        <GoogleAnalytics />
        <Script id="google-tag-manager" strategy="afterInteractive">
          {GOOGLE_TAG_MANAGER_SCRIPT}
        </Script>
        <Suspense fallback={null}>
          <GoogleAnalyticsTracker />
        </Suspense>
      </body>
    </html>
  );
}
