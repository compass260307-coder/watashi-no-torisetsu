// ★ 32キャラ図鑑ゾーン (仮置き): 見出し+サブ+ボタンのみ。
// 4グループ2×2の世界観デザインは第2弾。グリッド/個別キャラは置かない。
import Link from "next/link";

export function ZukanTeaser() {
  return (
    <section className="my-12 text-center">
      <div className="flex justify-center mb-3">
        <div className="bg-white text-[#0094D8] border-2 border-[#0094D8] px-4 py-1 rounded-full text-xs font-bold">
          全32タイプ・4つの世界
        </div>
      </div>
      <h2 className="text-[#3A2D6B] font-black text-xl mb-2">アナタは、どのコ?</h2>
      <p className="text-[#3A2D6B]/80 font-bold text-sm leading-relaxed mb-5">
        性格を4つの世界で分類した、全32タイプ
      </p>

      {/* TODO: /types ルート未実装。実装後に href を差し替える (現状はクリック無効プレースホルダ) */}
      <Link
        href="#"
        aria-disabled="true"
        className="inline-block bg-white text-[#FE3C72] font-black text-base px-8 py-3 rounded-full border-2 border-[#FE3C72] hover:bg-[#FFF0F5] transition-colors"
      >
        32タイプをぜんぶ見る →
      </Link>
    </section>
  );
}
