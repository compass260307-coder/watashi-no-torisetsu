"use client";

import type { AnswerValue } from "@/lib/types";

interface LikertScaleProps {
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  leftLabel?: string;
  rightLabel?: string;
}

const BUTTON_VALUES: AnswerValue[] = [7, 6, 5, 4, 3, 2, 1];

// Phase 1.5-α Day 9: Brand v2 化 — ピンク階調 → #FE3C72 系、ブルー階調 → #0094D8 系
// サイズ・選択値・並び順・ラベル文言は一切変更しない (見た目のみ)
// 7-5: 同意 (vividPink + pinkBlush) / 4: 中央 (deepPurple 透過) / 3-1: 不同意 (logoBlue + skyBlue)
const BUTTON_STYLES: Record<
  AnswerValue,
  {
    sizeClass: string;
    borderClass: string;
    selectedBgClass: string;
    selectedRingClass: string;
    label: string;
  }
> = {
  7: {
    sizeClass: "h-11 w-11 sm:h-14 sm:w-14",
    borderClass: "border-[#FE3C72]",
    selectedBgClass: "bg-[#FE3C72]",
    selectedRingClass: "ring-[#FFD6E0]",
    label: "強くそう思う",
  },
  6: {
    sizeClass: "h-9 w-9 sm:h-12 sm:w-12",
    borderClass: "border-[#FE3C72]/70",
    selectedBgClass: "bg-[#FE3C72]/70",
    selectedRingClass: "ring-[#FFD6E0]/70",
    label: "そう思う",
  },
  5: {
    sizeClass: "h-8 w-8 sm:h-10 sm:w-10",
    borderClass: "border-[#FFD6E0]",
    selectedBgClass: "bg-[#FFD6E0]",
    selectedRingClass: "ring-[#FFD6E0]/50",
    label: "ややそう思う",
  },
  4: {
    sizeClass: "h-7 w-7 sm:h-8 sm:w-8",
    borderClass: "border-[#3A2D6B]/30",
    selectedBgClass: "bg-[#3A2D6B]/50",
    selectedRingClass: "ring-[#3A2D6B]/15",
    label: "どちらでもない",
  },
  3: {
    sizeClass: "h-8 w-8 sm:h-10 sm:w-10",
    borderClass: "border-[#BCDEF8]",
    selectedBgClass: "bg-[#BCDEF8]",
    selectedRingClass: "ring-[#BCDEF8]/50",
    label: "あまりそう思わない",
  },
  2: {
    sizeClass: "h-9 w-9 sm:h-12 sm:w-12",
    borderClass: "border-[#0094D8]/70",
    selectedBgClass: "bg-[#0094D8]/70",
    selectedRingClass: "ring-[#BCDEF8]/70",
    label: "そう思わない",
  },
  1: {
    sizeClass: "h-11 w-11 sm:h-14 sm:w-14",
    borderClass: "border-[#0094D8]",
    selectedBgClass: "bg-[#0094D8]",
    selectedRingClass: "ring-[#BCDEF8]",
    label: "強くそう思わない",
  },
};

export function LikertScale({
  value,
  onChange,
  leftLabel = "強くそう思う",
  rightLabel = "強くそう思わない",
}: LikertScaleProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {/* モバイル: ラベルはスケール上に左右配置
          Day 9: ピンク → #FE3C72 (vividPink) / ブルー → #0094D8 (logoBlue) */}
      <div className="flex justify-between text-[10px] sm:text-xs px-1">
        <span className="text-[#FE3C72] font-bold">{leftLabel}</span>
        <span className="text-[#0094D8] font-bold">{rightLabel}</span>
      </div>
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 w-full">
        {BUTTON_VALUES.map((v) => {
          const style = BUTTON_STYLES[v];
          const isSelected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-label={style.label}
              aria-pressed={isSelected}
              className={[
                "rounded-full border-2 transition-all duration-150 outline-none flex-shrink-0",
                "hover:scale-110 active:scale-95",
                "focus-visible:ring-4",
                style.sizeClass,
                style.borderClass,
                isSelected
                  ? `${style.selectedBgClass} ${style.selectedRingClass} ring-4`
                  : "bg-white",
              ].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}
