"use client";

import type { AnswerValue } from "@/lib/types";

interface LikertScaleProps {
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  leftLabel?: string;
  rightLabel?: string;
}

const BUTTON_VALUES: AnswerValue[] = [7, 6, 5, 4, 3, 2, 1];

// 値 → モバイル / sm 以降のサイズ・色クラス
// 7-5: 同意 (ブランドピンク階調) / 4: 中央 (ニュートラル) / 3-1: 不同意 (ブルー階調)
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
    borderClass: "border-pink-500",
    selectedBgClass: "bg-pink-500",
    selectedRingClass: "ring-pink-200",
    label: "強くそう思う",
  },
  6: {
    sizeClass: "h-9 w-9 sm:h-12 sm:w-12",
    borderClass: "border-pink-400",
    selectedBgClass: "bg-pink-400",
    selectedRingClass: "ring-pink-100",
    label: "そう思う",
  },
  5: {
    sizeClass: "h-8 w-8 sm:h-10 sm:w-10",
    borderClass: "border-pink-300",
    selectedBgClass: "bg-pink-300",
    selectedRingClass: "ring-pink-100",
    label: "ややそう思う",
  },
  4: {
    sizeClass: "h-7 w-7 sm:h-8 sm:w-8",
    borderClass: "border-gray-300",
    selectedBgClass: "bg-gray-400",
    selectedRingClass: "ring-gray-200",
    label: "どちらでもない",
  },
  3: {
    sizeClass: "h-8 w-8 sm:h-10 sm:w-10",
    borderClass: "border-blue-300",
    selectedBgClass: "bg-blue-300",
    selectedRingClass: "ring-blue-100",
    label: "あまりそう思わない",
  },
  2: {
    sizeClass: "h-9 w-9 sm:h-12 sm:w-12",
    borderClass: "border-blue-400",
    selectedBgClass: "bg-blue-400",
    selectedRingClass: "ring-blue-100",
    label: "そう思わない",
  },
  1: {
    sizeClass: "h-11 w-11 sm:h-14 sm:w-14",
    borderClass: "border-blue-500",
    selectedBgClass: "bg-blue-500",
    selectedRingClass: "ring-blue-200",
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
      {/* モバイル: ラベルはスケール上に左右配置 */}
      <div className="flex justify-between text-[10px] sm:text-xs px-1">
        <span className="text-pink-600 font-bold">{leftLabel}</span>
        <span className="text-blue-600 font-bold">{rightLabel}</span>
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
