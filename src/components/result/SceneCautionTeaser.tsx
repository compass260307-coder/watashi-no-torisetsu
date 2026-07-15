// ③「アナタの注意点」直下の「シーン別の注意点」(2026-07-14 指示 / 2026-07-15 本文投入)。
//
// - 未解放: SceneCautionTeaser … 深掘りロック (DeepDiveSections) と同じ体裁
//   (色付きの鍵円を横並び + 中央に解除カード)。
// - 解放済み: SceneCautionList … 本文 (part-two-resolve の buildSceneCautions)。
//   組版は武器/関係別と同じチェックリスト風で、アイコンはシーン色の注意マーク。
//
// サーバコンポーネント (状態なし)。CTA は PaywallScrollButton (client) に委譲。

import { PaywallScrollButton } from "@/components/result/PaywallScrollButton";
import { SCENE_CAUTION_ID } from "@/lib/scroll-to-paywall";
import type { SceneCaution } from "@/lib/part-two-resolve";

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

// 解放済みの実表示。武器/関係別と同じ組版 (枠なし2カラム・太字タイトル + 字下げ本文)。
// アイコンは「注意点」なので警告三角。色はティザーの鍵円と同じシーン別カラー。
export function SceneCautionList({ items }: { items: SceneCaution[] }) {
  const colorOf = (scene: string) =>
    SCENE_ITEMS.find((it) => it.label === scene)?.color ?? "#2E2E5C";
  return (
    <div className="mt-10">
      <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
        シーン別の注意点
      </h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.scene}>
            <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
              <span
                aria-hidden="true"
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center"
                style={{ color: colorOf(it.scene) }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              {it.scene}
            </p>
            <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

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
