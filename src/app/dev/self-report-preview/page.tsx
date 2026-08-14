import { notFound } from "next/navigation";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";

// /me の診断をやり直さず、3コース商品カードだけを確認するローカル専用プレビュー。
export default function SelfReportPreviewPage() {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-dvh bg-[#F6F7FB] py-8 md:py-12">
      <div className="mx-auto max-w-[720px] px-4 text-center">
        <p className="text-[11px] font-black tracking-[0.14em] text-[#5B5BEF]">
          LOCAL PREVIEW
        </p>
        <h1 className="mt-2 text-[22px] font-black text-[#2A3A5C]">
          3コース商品カードの確認
        </h1>
        <p className="mt-3 text-[13px] font-bold leading-[1.8] text-[#7A8498]">
          実際の自己診断結果ページと同じカードです。
          <br />
          CTAを押すとStripeのテスト決済画面へ進みます。
        </p>
      </div>

      <FullAccessPromoCard
        imageSrc="/characters/scenes/unknown_work.webp"
        imageAlt="自己分析レポートのイメージ"
        group="unknown"
        returnTo="me"
        ctaSource="dev_self_report_preview"
      />
    </main>
  );
}
