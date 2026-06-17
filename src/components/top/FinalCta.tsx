// ⑤ 最終CTA (維持・微修正): 見出し追加 + ボタン維持 + バッジ「3分・登録不要」(全部無料は外す)。
import { CtaButton, ReassureBadge } from "./CtaButton";

export function FinalCta() {
  return (
    <section className="text-center py-8 mt-4">
      <h2 className="text-[#3A2D6B] font-black text-xl mb-4">
        さっそく、はじめてみる?
      </h2>
      <div className="mb-3">
        <CtaButton href="/diagnosis" label="無料で診断する →" />
      </div>
      <div className="flex justify-center">
        <ReassureBadge />
      </div>
    </section>
  );
}
