"use client";

// 評価完了ページ (/evaluate/sent) 末尾の「自分も無料で診断する」CTA。
// 新オーナー転換の主導線。クリックを KPI (friend_v2_self_cta_clicked) で計測するため、
// サーバーページの素の <Link> をこの client コンポーネントに置き換える。

import Link from "next/link";
import { track } from "@/lib/track";
import { ctaPrimary } from "@/components/StickyCtaFooter";

interface SelfDiagnosisCtaButtonProps {
  /** IntersectionObserver で floating CTA を隠すためのアンカー id。 */
  id?: string;
  href?: string;
  label?: string;
  /** 計測メタ: どのCTAからか (bottom / floating 等)。 */
  source?: string;
}

export function SelfDiagnosisCtaButton({
  id,
  href = "/diagnosis",
  label = "自分のトリセツを生成 →",
  source = "sent_bottom",
}: SelfDiagnosisCtaButtonProps) {
  return (
    <div id={id} className="flex justify-center pt-1 pb-2">
      <Link
        href={href}
        className={ctaPrimary}
        onClick={() =>
          track("friend_v2_self_cta_clicked", { metadata: { source } })
        }
      >
        {label}
      </Link>
    </div>
  );
}
