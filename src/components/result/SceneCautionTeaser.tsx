// ③「アナタの注意点」直下の「シーン別の注意点」ロックティーザー (2026-07-14 指示)。
//
// 深掘りロック (DeepDiveSections) と同じ体裁: 色付きの鍵円を横並び + 中央に解除カード。
// ⚠ シーン別注意点の本文データはまだ存在しない (ティーザーのみ)。そのため呼び出し側
//   (/me) は未解放時のみ表示すること。解放済みユーザーに「開かない鍵」を見せない。
//   本文データ投入後に、解放時の実表示へ差し替える。
//
// サーバコンポーネント (状態なし)。CTA は PaywallScrollButton (client) に委譲。

import { PaywallScrollButton } from "@/components/result/PaywallScrollButton";
import { SCENE_CAUTION_ID } from "@/lib/scroll-to-paywall";

// 鍵アイコン (RelationsLocked / DeepDiveSections と同一形状)。
function LockGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// シーン。色は関係別の見られ方と同系統のパレット。
const SCENE_ITEMS: { label: string; color: string }[] = [
  { label: "友達といる時", color: "#56BFE8" },
  { label: "恋人といる時", color: "#F48BAE" },
  { label: "キャリアにおいて", color: "#4CAF7D" },
  { label: "家族といる時", color: "#F2C14E" },
];

export function SceneCautionTeaser() {
  return (
    <div className="mt-10">
      <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
        シーン別の注意点
      </h3>
      <div
        id={SCENE_CAUTION_ID}
        className="rounded-2xl border border-[#ECEDF6] bg-white px-4 py-8 shadow-[0_6px_20px_rgba(46,46,92,0.09)] md:px-10 md:py-10"
      >
        {/* 鍵付きの円 (SP 2列 / md 4列) */}
        <div className="mb-8 grid grid-cols-2 gap-x-2 gap-y-6 md:grid-cols-4">
          {SCENE_ITEMS.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2.5">
              <span
                className="flex h-[108px] w-[108px] items-center justify-center rounded-full border-4 bg-white text-[#B9BCCF]"
                style={{ borderColor: item.color }}
              >
                <LockGlyph size={30} />
              </span>
              <span className="text-[13px] font-black text-[#2E2E5C]">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* 解除カード (上辺アクセント線 + 鍵バッジ) */}
        <div className="relative mx-auto max-w-[480px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] px-5 pb-6 pt-7 text-center md:max-w-[640px]">
          <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
            <LockGlyph size={14} />
          </span>
          <p className="mb-1.5 text-[19px] font-black text-[#2E2E5C]">
            今すぐロックを解除
          </p>
          <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
            完全版のレポートを入手して、これらの結果を見てみましょう。
            <br className="md:hidden" />
            シーンごとのつまずきポイントが分かります。
          </p>
          <PaywallScrollButton
            source="scene_caution_card"
            className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
          >
            今すぐアクセス
          </PaywallScrollButton>
        </div>
      </div>
    </div>
  );
}
