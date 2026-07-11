// PR3: 課金案内カード (トップ以外の全ページ最下部に常設)。
//
// 目的: 旧導線は「キャリア」しか訴求できておらず「友達の個人結果も解放される」ことが
//   伝わらなかった。MBTI 式に「解放される中身を項目で見せて価値を可視化」する。
//
// 解放される 3 項目 (すべて実際に課金で解放される中身。水増ししない):
//   - キャリアの深掘りアドバイス   (/me 深掘りタブ・課金ゲート)
//   - 成長のヒント                 (/me 深掘りタブ・課金ゲート)
//   - 友達が見た「ほんとうのアナタ」(/tako 個別ページ・課金ゲート)
//   ※相性(/aisho)シーン別は無料据え置きのため載せない (過剰約束回避)。
//
// id="fullaccess-promo": ページ内のロック要素からの scrollToPaywall() のスクロール先。
// CTA は既存 FullAccessCta を全幅で再利用 (未ログイン=401 はトップへ funnel)。
//
// フォントはアプリの既存パラダイム (Noto + font-black) に合わせ、ネイビー #2E2E5C 基調。

import { FullAccessCta } from "./FullAccessCta";

function CheckItem({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E7F6EC]"
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="#3FA96A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-black leading-snug text-[#2E2E5C]">
          {title}
        </span>
        <span className="body-gothic block text-[13px] leading-[1.6] text-[#5A5A6E]">
          {desc}
        </span>
      </span>
    </li>
  );
}

export function FullAccessPromoCard({ ownerToken }: { ownerToken?: string }) {
  return (
    <section aria-labelledby="fullaccess-promo-title" className="px-4 pt-6 pb-14 md:px-8">
      <div
        id="fullaccess-promo"
        className="mx-auto w-full max-w-[460px] scroll-mt-[80px] rounded-3xl border border-[#D8E4F5] bg-gradient-to-b from-white to-[#F2F5FC] px-6 py-8 text-center shadow-[0_12px_36px_rgba(46,46,92,0.12)]"
      >
        {/* 1. 続編訴求 (小・アクセント色) */}
        <p className="text-[13px] font-bold text-[#5B5BEF]">
          無料で見た「アナタのトリセツ」の、その先へ。
        </p>
        {/* 2. 見出し (大・太・ネイビー) */}
        <h2
          id="fullaccess-promo-title"
          className="mt-2 text-[26px] font-black leading-tight text-[#2E2E5C]"
        >
          ぜんぶ、ひらく。
        </h2>
        {/* 3. サブ */}
        <p className="mt-2 text-[13.5px] font-bold leading-[1.7] text-[#6A6A7C]">
          ロックされている深掘りが、まとめて解放されます。
        </p>

        {/* 4. 解放される 3 項目 (緑丸チェック) */}
        <ul className="mx-auto mb-7 mt-6 grid max-w-[320px] gap-4 text-left">
          <CheckItem
            title="キャリアの深掘りアドバイス"
            desc="向いてる働き方・環境・強みの活かし方まで。"
          />
          <CheckItem
            title="成長のヒント"
            desc="伸ばし方・つまずきポイント・次の一歩。"
          />
          <CheckItem
            title="友達が見た「ほんとうのアナタ」"
            desc="ひとりずつ、全員ぶんの個人結果。"
          />
        </ul>

        {/* 5. 価格 */}
        <div className="mb-1 flex items-baseline justify-center gap-1">
          <span className="text-[22px] font-black text-[#2E2E5C]">¥</span>
          <span className="text-[46px] font-black leading-none text-[#2E2E5C]">
            299
          </span>
        </div>
        {/* 6. 買い切りの安心 */}
        <p className="mb-6 text-[12.5px] font-bold text-[#8A8AA3]">
          一度きりの購入で、ずっと見返せる。サブスクじゃない。
        </p>

        {/* 7. CTA (幅いっぱい・ネイビー・白) */}
        <FullAccessCta ownerToken={ownerToken}>¥299ですべてひらく →</FullAccessCta>
      </div>
    </section>
  );
}
