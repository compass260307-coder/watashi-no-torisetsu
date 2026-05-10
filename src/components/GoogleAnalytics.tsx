import Script from "next/script";

// GA4 の gtag.js 本体ローダ + 初期化スニペット。
// production 環境かつ NEXT_PUBLIC_GA_MEASUREMENT_ID 設定済の場合のみ出力。
export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction || !gaId) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
