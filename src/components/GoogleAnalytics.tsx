import Script from "next/script";
import {
  isThirdPartyMeasurementEnabled,
  MEASUREMENT_EXCLUDED_PATH_JS,
} from "@/lib/third-party-measurement";

// GA4 の gtag.js 本体ローダ + 初期化スニペット。
// 計測許可環境 (本番) かつ NEXT_PUBLIC_GA_MEASUREMENT_ID 設定済の場合のみ出力。
// 社内向けページ (/internal/) では gtag.js を読み込まず、page_view も送らない。
export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const isProduction = isThirdPartyMeasurementEnabled();

  if (!isProduction || !gaId) return null;

  return (
    <Script id="google-analytics" strategy="afterInteractive">
      {`
        if (!${MEASUREMENT_EXCLUDED_PATH_JS}) {
          var gaLoader = document.createElement('script');
          gaLoader.async = true;
          gaLoader.src = 'https://www.googletagmanager.com/gtag/js?id=${gaId}';
          document.head.appendChild(gaLoader);
          window.dataLayer = window.dataLayer || [];
          window.gtag = function(){window.dataLayer.push(arguments);};
          window.gtag('js', new Date());
          window.gtag('config', '${gaId}', {
            page_path: window.location.pathname,
          });
        }
      `}
    </Script>
  );
}
