// トップ用 共通 CTA ボタン (sunYellow ぷっくり立体)。FV と最終CTAで再利用。
import Link from "next/link";

export function CtaButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black text-lg px-10 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_6px_0_#3A2D6B] hover:translate-y-1 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-[5px] active:shadow-[0_1px_0_#3A2D6B] transition-all duration-150"
    >
      {label}
    </Link>
  );
}

/** CTA 直下の安心バッジ (3分 ・ 登録不要)。「全部無料」は入れない方針。 */
export function ReassureBadge() {
  return (
    <p className="inline-block text-[#3A2D6B] text-xs font-bold bg-white/40 backdrop-blur-sm rounded-full px-4 py-1.5">
      ⏱ 3分 ・ 登録不要
    </p>
  );
}
