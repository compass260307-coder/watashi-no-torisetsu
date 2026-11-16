"use client";

import type { AnswerValue } from "@/lib/types";

interface LikertScaleProps {
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  leftLabel?: string;
  rightLabel?: string;
  optionLabels?: Partial<Record<AnswerValue, string>>;
  // "lg": PC (md+) で○を一回り大きくする (横幅の広い自己診断ページ用)。
  //   friend フロー等の狭い画面は既定 "base" のまま (追加クラスなし)。
  size?: "base" | "lg";
}

const BUTTON_VALUES: AnswerValue[] = [7, 6, 5, 4, 3, 2, 1];

// feat/top-page: トップページのデザイン言語に統一 (16Personalities のスケールを参考)。
//   同意側 (7-5) = Sora ブルー #5B5BEF 階調 / 中央 (4) = ニュートラルグレー /
//   不同意側 (3-1) = ウォームピンク #E86AA6 階調 (TopStats のアクセントと同系)。
// 選択値・並び順・ラベル文言は一切変更しない (見た目のみ)。
// モバイル (<md) の○は固定 px ではなく「行幅に対する比率 (basis %) + aspect-square」で
//   フルードに伸縮する (比率 48:40:34:30、7個の basis 合計 ≒ 100%)。gap-2 は固定なので、
//   どの画面幅でも○が左右端まで埋まり、余り幅が隙間に化けない。
//   行側の max-w-md (448px) が上限で、md の lg サイズ (72px) を超えて育たない。
const BUTTON_STYLES: Record<
  AnswerValue,
  {
    sizeClass: string;
    lgSizeClass: string; // size="lg" 時に md+ で付与する拡大クラス
    borderClass: string;
    selectedBgClass: string;
    selectedRingClass: string;
    label: string;
  }
> = {
  7: {
    sizeClass: "aspect-square basis-[17.52%]",
    lgSizeClass: "md:basis-auto md:h-[72px] md:w-[72px]",
    borderClass: "border-[#5B5BEF]",
    selectedBgClass: "bg-[#5B5BEF]",
    selectedRingClass: "ring-[#DCDCFA]",
    label: "強くそう思う",
  },
  6: {
    sizeClass: "aspect-square basis-[14.6%]",
    lgSizeClass: "md:basis-auto md:h-[60px] md:w-[60px]",
    borderClass: "border-[#5B5BEF]/70",
    selectedBgClass: "bg-[#5B5BEF]/70",
    selectedRingClass: "ring-[#DCDCFA]/70",
    label: "そう思う",
  },
  5: {
    sizeClass: "aspect-square basis-[12.41%]",
    lgSizeClass: "md:basis-auto md:h-[50px] md:w-[50px]",
    borderClass: "border-[#C6C6F5]",
    selectedBgClass: "bg-[#C6C6F5]",
    selectedRingClass: "ring-[#DCDCFA]/50",
    label: "ややそう思う",
  },
  4: {
    sizeClass: "aspect-square basis-[10.95%]",
    lgSizeClass: "md:basis-auto md:h-[42px] md:w-[42px]",
    borderClass: "border-[#2E2E5C]/30",
    selectedBgClass: "bg-[#2E2E5C]/50",
    selectedRingClass: "ring-[#2E2E5C]/15",
    label: "どちらでもない",
  },
  3: {
    sizeClass: "aspect-square basis-[12.41%]",
    lgSizeClass: "md:basis-auto md:h-[50px] md:w-[50px]",
    borderClass: "border-[#F3C4DA]",
    selectedBgClass: "bg-[#F3C4DA]",
    selectedRingClass: "ring-[#F3C4DA]/50",
    label: "あまりそう思わない",
  },
  2: {
    sizeClass: "aspect-square basis-[14.6%]",
    lgSizeClass: "md:basis-auto md:h-[60px] md:w-[60px]",
    borderClass: "border-[#E86AA6]/70",
    selectedBgClass: "bg-[#E86AA6]/70",
    selectedRingClass: "ring-[#F8D8E8]/70",
    label: "そう思わない",
  },
  1: {
    sizeClass: "aspect-square basis-[17.52%]",
    lgSizeClass: "md:basis-auto md:h-[72px] md:w-[72px]",
    borderClass: "border-[#E86AA6]",
    selectedBgClass: "bg-[#E86AA6]",
    selectedRingClass: "ring-[#F8D8E8]",
    label: "強くそう思わない",
  },
};

export function LikertScale({
  value,
  onChange,
  leftLabel = "強くそう思う",
  rightLabel = "強くそう思わない",
  optionLabels,
  size = "base",
}: LikertScaleProps) {
  const isLg = size === "lg";
  return (
    <div className="flex flex-col gap-3 w-full">
      {/* ラベルはスケール上に左右配置 (同意 = Sora ブルー / 不同意 = ピンク)。
          px なし + ○の行と同じ max-w: 両端の○の外周とラベルの端を揃える。 */}
      <div
        className={`mx-auto flex w-full max-w-md justify-between text-[10px] sm:text-xs ${
          isLg ? "md:max-w-none md:text-sm" : ""
        }`}
      >
        <span className="text-[#5B5BEF] font-bold">{leftLabel}</span>
        <span className="text-[#E86AA6] font-bold">{rightLabel}</span>
      </div>
      {/* モバイル (<md) は○自体が basis % で行幅いっぱいに伸縮し、隙間は gap-2 固定
          (余り幅が隙間に化けない)。max-w-md は○が育ちすぎないための上限。
          lg の md+ は従来どおり固定サイズの中央寄せクラスター。 */}
      <div
        className={`mx-auto flex w-full max-w-md items-center justify-between gap-2 ${
          isLg ? "md:max-w-none md:justify-center md:gap-5" : ""
        }`}
      >
        {BUTTON_VALUES.map((v) => {
          const style = BUTTON_STYLES[v];
          const isSelected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-label={optionLabels?.[v] ?? style.label}
              aria-pressed={isSelected}
              className={[
                // shrink 可: basis の合計 (≒100%) + gap ぶんを flexbox が比例配分で
                // 縮めることで、○の大小比を保ったまま行幅ぴったりに収まる。
                "rounded-full border-2 transition-all duration-150 outline-none",
                "flex items-center justify-center",
                "hover:scale-110 active:scale-95",
                "focus-visible:ring-4",
                style.sizeClass,
                isLg ? style.lgSizeClass : "",
                style.borderClass,
                isSelected
                  ? `${style.selectedBgClass} ${style.selectedRingClass} ring-4`
                  : "bg-white",
              ].join(" ")}
            >
              {/* 選択中の非色の手がかり (色覚に依存しない): 白チェック + ネイビーの縁取り影で
                  濃淡どちらの塗りでも視認できる。aria-pressed と併せて選択状態を伝える。 */}
              {isSelected && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-1/2 h-1/2 text-white"
                  style={{
                    filter: "drop-shadow(0 0.5px 1px rgba(46,46,92,0.9))",
                  }}
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
