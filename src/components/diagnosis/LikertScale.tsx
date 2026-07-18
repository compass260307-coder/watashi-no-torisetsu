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
// サイズ・選択値・並び順・ラベル文言は一切変更しない (見た目のみ)。
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
    sizeClass: "h-11 w-11 sm:h-14 sm:w-14",
    lgSizeClass: "md:h-[72px] md:w-[72px]",
    borderClass: "border-[#5B5BEF]",
    selectedBgClass: "bg-[#5B5BEF]",
    selectedRingClass: "ring-[#DCDCFA]",
    label: "強くそう思う",
  },
  6: {
    sizeClass: "h-9 w-9 sm:h-12 sm:w-12",
    lgSizeClass: "md:h-[60px] md:w-[60px]",
    borderClass: "border-[#5B5BEF]/70",
    selectedBgClass: "bg-[#5B5BEF]/70",
    selectedRingClass: "ring-[#DCDCFA]/70",
    label: "そう思う",
  },
  5: {
    sizeClass: "h-8 w-8 sm:h-10 sm:w-10",
    lgSizeClass: "md:h-[50px] md:w-[50px]",
    borderClass: "border-[#C6C6F5]",
    selectedBgClass: "bg-[#C6C6F5]",
    selectedRingClass: "ring-[#DCDCFA]/50",
    label: "ややそう思う",
  },
  4: {
    sizeClass: "h-7 w-7 sm:h-8 sm:w-8",
    lgSizeClass: "md:h-[42px] md:w-[42px]",
    borderClass: "border-[#2E2E5C]/30",
    selectedBgClass: "bg-[#2E2E5C]/50",
    selectedRingClass: "ring-[#2E2E5C]/15",
    label: "どちらでもない",
  },
  3: {
    sizeClass: "h-8 w-8 sm:h-10 sm:w-10",
    lgSizeClass: "md:h-[50px] md:w-[50px]",
    borderClass: "border-[#F3C4DA]",
    selectedBgClass: "bg-[#F3C4DA]",
    selectedRingClass: "ring-[#F3C4DA]/50",
    label: "あまりそう思わない",
  },
  2: {
    sizeClass: "h-9 w-9 sm:h-12 sm:w-12",
    lgSizeClass: "md:h-[60px] md:w-[60px]",
    borderClass: "border-[#E86AA6]/70",
    selectedBgClass: "bg-[#E86AA6]/70",
    selectedRingClass: "ring-[#F8D8E8]/70",
    label: "そう思わない",
  },
  1: {
    sizeClass: "h-11 w-11 sm:h-14 sm:w-14",
    lgSizeClass: "md:h-[72px] md:w-[72px]",
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
      {/* ラベルはスケール上に左右配置 (同意 = Sora ブルー / 不同意 = ピンク) */}
      <div
        className={`flex justify-between px-1 text-[10px] sm:text-xs ${
          isLg ? "md:text-sm" : ""
        }`}
      >
        <span className="text-[#5B5BEF] font-bold">{leftLabel}</span>
        <span className="text-[#E86AA6] font-bold">{rightLabel}</span>
      </div>
      <div
        className={`flex w-full items-center justify-center gap-1.5 sm:gap-2.5 ${
          isLg ? "md:gap-5" : ""
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
                "rounded-full border-2 transition-all duration-150 outline-none flex-shrink-0",
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
