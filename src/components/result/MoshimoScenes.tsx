// ⑥「もしもの時のアナタ」の本体表示 (/me 結果ページ / 2026-07-22)。
//
// - 無料シーン (不審者/集合写真): シーン名 + 反応本文をそのまま表示 (シェアの燃料)。
// - 課金シーン (テスト前/終電): 未解放時は鍵円 + 解除カードのティザー
//   (シーン別の注意点 SceneCautionTeaser と同じ体裁)。本文はサーバで解決して
//   いない (moshimo-resolve がフェイルクローズ)。解放済みは無料シーンと同じ組版。
//
// サーバコンポーネント (状態なし)。CTA は PaywallScrollButton (client) に委譲。
// 日本語のみ (呼び出し側で locale を見て出し分ける)。

import { PaywallScrollButton } from "@/components/result/PaywallScrollButton";
import type { MoshimoScene } from "@/lib/moshimo-resolve";

// 鍵アイコン (SceneCautionTeaser / DeepDiveSections と同一形状)。
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

// 吹き出しアイコン (エンタメ章なので注意マークではなく会話モチーフ)。
function BubbleGlyph({ size = 18 }: { size?: number }) {
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
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function MoshimoScenes({ scenes }: { scenes: MoshimoScene[] }) {
  const open = scenes.filter((s) => !s.locked);
  const locked = scenes.filter((s) => s.locked);
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        {open.map((scene) => (
          <div key={scene.title}>
            <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
              <span
                aria-hidden="true"
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center"
                style={{ color: scene.color }}
              >
                <BubbleGlyph size={18} />
              </span>
              {scene.title}
            </p>
            <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
              {scene.body}
            </p>
          </div>
        ))}
      </div>

      {/* 未解放シーン: シーン名入りの鍵チップを敷き詰める (鍵円だと8個で単調 +
          余白が間延びするため 2026-07-22 にチップ型へ変更)。色はシーン別カラー。 */}
      {locked.length > 0 && (
        <div className="mt-8 rounded-2xl border border-[#ECEDF6] bg-white px-4 py-8 shadow-[0_6px_20px_rgba(46,46,92,0.09)] md:px-10 md:py-10">
          <div className="mb-8 flex flex-wrap justify-center gap-x-2 gap-y-2.5">
            {locked.map((scene) => (
              <span
                key={scene.title}
                className="inline-flex items-center gap-1.5 rounded-full border-2 bg-white py-2 pl-3 pr-3.5 text-[12.5px] font-black leading-none text-[#2E2E5C]"
                style={{ borderColor: scene.color }}
              >
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 text-[#B9BCCF]"
                >
                  <LockGlyph size={13} />
                </span>
                {scene.title}
              </span>
            ))}
          </div>

          <div className="relative mx-auto max-w-[480px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] px-5 pb-6 pt-7 text-center md:max-w-[640px]">
            <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
              <LockGlyph size={14} />
            </span>
            <p className="mb-1.5 text-[19px] font-black text-[#2E2E5C]">
              今すぐロックを解除
            </p>
            <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
              完全版のレポートを入手して、
              <br className="md:hidden" />
              もしもの時のアナタをぜんぶ見てみましょう。
            </p>
            <PaywallScrollButton
              source="moshimo_card"
              className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
            >
              今すぐアクセス
            </PaywallScrollButton>
          </div>
        </div>
      )}
    </div>
  );
}
