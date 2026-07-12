"use client";

// 自己分析「深掘り」セクション (/me/[token] 結果ページ、発散バーの直下)。
//
// 設計方針 (PR2 で変更):
//   - タブ切替を持つためクライアントコンポーネント ("use client")。
//   - ★本文データ (TYPE_DEEP_DIVE / LOVE_BY_TYPE_32 / CAREER_BY_TYPE_32) は
//     ここで import しない。import するとバンドルに全本文が同梱され課金ゲートが無意味に
//     なるため、サーバ (/me) が resolveDeepDiveSections() で「許可されたぶんだけ」解決し、
//     props (sections) で渡す。このコンポーネントは受け取って並べるだけの表示層。
//   - 未課金の課金タブ (キャリア/成長) は section.body===null / locked===true で来る。
//     その場合は本文の代わりに、最下部の課金案内カードへスライドするボタンを出す
//     (PR3: 実 CTA はページ最下部の FullAccessPromoCard に一本化)。

import { useState } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import type {
  DeepDiveTabKey,
  ResolvedDeepDiveSection,
} from "@/lib/deep-dive-resolve";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";

// ※「みんなの目」(他己) タブは /tako/[token] へ移設。ここは自己深掘り3タブのみ。

interface DeepDiveSectionsProps {
  /** サーバ (resolveDeepDiveSections) で解決済みの3タブ。未課金の課金タブは body=null。 */
  sections: ResolvedDeepDiveSection[];
  /** タブ別の挿絵 (シーン別イラスト)。null/未指定なら非表示 (親が fs 走査して渡す)。 */
  sceneImages?: Partial<Record<DeepDiveTabKey, string | null>>;
  className?: string;
}

export function DeepDiveSections({
  sections,
  sceneImages,
  className = "",
}: DeepDiveSectionsProps) {
  // 初期選択は「恋愛傾向」(love) を明示指定 (並びが変わっても love を初期表示)。
  const loveIndex = Math.max(
    0,
    sections.findIndex((s) => s.key === "love"),
  );
  const [active, setActive] = useState(loveIndex);

  if (sections.length === 0) return null;
  const current = sections[active] ?? sections[0];

  return (
    <section className={`mb-8 ${className}`.trim()}>
      {/* 見出し: ①②と同じ 16P 風 (丸囲み数字 + 大きめタイトル) */}
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
        >
          3
        </span>
        <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
          アナタの深掘り
        </h2>
      </div>

      {/* タブ (横並びボタン。モバイルは横スクロール) */}
      <div
        role="tablist"
        aria-label="深掘りカテゴリ"
        className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1"
      >
        {sections.map((s, i) => {
          const selected = i === active && !s.locked;
          // ロックタブ (キャリア/成長・未課金) はパネルを開かず、押下で最下部の
          // 課金カード (#fullaccess-promo) へスクロール。無料タブは通常のタブ切替。
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => (s.locked ? scrollToPaywall() : setActive(i))}
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-black transition-colors ${
                selected
                  ? "bg-[#2E2E5C] text-white border-[#2E2E5C]"
                  : "bg-white text-[#2E2E5C] border-[#0094D8]/25 hover:bg-[#F4F4FE]"
              }`}
            >
              {/* ロックタブは鍵アイコンを添える (押すと下の課金カードへ) */}
              {s.locked && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="10" width="16" height="11" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              )}
              {s.tab}
            </button>
          );
        })}
      </div>

      <article role="tabpanel" className="px-1 pt-1 pb-2">
        {/* 挿絵 (タブ対応のシーン別イラスト): タブ内の一番上に表示 */}
        {sceneImages?.[current.key] && (
          <SmoothImage
            src={sceneImages[current.key]!}
            alt=""
            width={960}
            height={640}
            className="mx-auto mb-6 h-auto w-full max-w-[560px] md:max-w-[760px]"
          />
        )}

        {/* スコア由来の一文 (パーソナライズ・無料メタ)。ロック時も出す。 */}
        <p className="text-[#2E2E5C]/70 text-sm mb-4">{current.note}</p>

        {current.locked || current.body === null ? (
          /* ===== 課金ロック (キャリア/成長・未課金) ===== */
          <div className="rounded-3xl bg-[#F7F7FB] px-5 py-7 text-center">
            {/* 本文の代わりのダミー目隠し (本文は載っていない) */}
            <div aria-hidden="true" className="mb-6 space-y-3 select-none">
              {[94, 80, 88, 66].map((w, i) => (
                <div
                  key={i}
                  className="mx-auto h-4 rounded-full bg-[#E7E7F0] blur-[2px]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
            <p className="text-[#2E2E5C] font-black text-[15px] leading-[1.6]">
              「{current.tab}」のくわしい深掘りは
              <br />
              友達3人 or ¥299 でひらきます。
            </p>
            <p className="mt-2 text-[#8A8AA3] font-bold text-[13px] leading-[1.6]">
              友達3人ならタダ。急ぐなら一度きりの ¥299 で、
              <br className="md:hidden" />
              キャリアも成長も相性も、ぜんぶ。
            </p>
            <div className="mt-5 flex flex-col items-center">
              {/* PR3: 押すと同ページ最下部の課金案内カードへスライド (遷移なし)。
                  実 CTA は最下部カードに一本化。 */}
              <button
                type="button"
                onClick={scrollToPaywall}
                className="flex w-full max-w-[300px] items-center justify-center rounded-full bg-[#2E2E5C] px-6 py-3.5 text-base font-black text-white shadow-[0_4px_0_#1b1b3e] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-[0_0_0_#1b1b3e]"
              >
                ぜんぶ、ひらく →
              </button>
            </div>
          </div>
        ) : (
          /* ===== 本文 (無料の恋愛 or 課金済み) ===== */
          current.body.split("\n\n").map((para, i) => (
            <p
              key={i}
              className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0"
            >
              {para}
            </p>
          ))
        )}
      </article>
    </section>
  );
}
