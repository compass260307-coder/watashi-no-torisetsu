import {
  renderDetailedReportHtml,
  renderDetailedReportHtmlKo,
} from "@/lib/email";
import { isAccessProduct, type AccessProduct } from "@/lib/access-products";

/**
 * 購入完了メールのローカル確認用プレビュー。
 * 本番では内容を返さず、メール送信や実ユーザーデータにも触れない。
 *
 * ?product=self_report|full_access|premium_bundle / &locale=ko で切替。
 * destiny / chat / friend の既定値は現行の販売内容 (完全版=チャットあり・設計図なし)。
 * &destiny=1 &chat=0 のように明示指定で上書きできる (旧世代購入者向け文面の確認用)。
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const token = "EXAMPLE_TOKEN";

  const requestedProduct = url.searchParams.get("product");
  const product: AccessProduct = isAccessProduct(requestedProduct)
    ? requestedProduct
    : "full_access";
  const locale = url.searchParams.get("locale") === "ko" ? "ko" : "ja";
  const flag = (name: string, fallback: boolean) => {
    const value = url.searchParams.get(name);
    return value === "1" ? true : value === "0" ? false : fallback;
  };

  const localePrefix = locale === "ko" ? "/ko" : "";
  const args = {
    pdfUrl: `${origin}/report/${token}/pdf?previewType=earnest-elephant__N`,
    meUrl: `${origin}${localePrefix}/me/${token}?previewType=earnest-elephant__N`,
    unmeiUrl: `${origin}${localePrefix}/unmei`,
    hoshiyomiUrl: `${origin}${localePrefix}/hoshiyomi`,
    greetingName: "わかん",
    product,
    destinyFeaturesIncluded: flag("destiny", product === "premium_bundle"),
    hoshiyomiChatIncluded: flag("chat", product !== "self_report"),
    friendFeaturesIncluded: flag("friend", product !== "self_report"),
  };

  return new Response(
    locale === "ko"
      ? renderDetailedReportHtmlKo(args)
      : renderDetailedReportHtml(args),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
