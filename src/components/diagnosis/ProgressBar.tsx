"use client";

interface ProgressBarProps {
  currentQuestion: number;   // 回答済み問題数 (0-50)
  totalQuestions: number;    // 50
  currentPage: number;       // 1-indexed (1-5)
  totalPages: number;        // 5
}

export function ProgressBar({
  currentQuestion,
  totalQuestions,
  currentPage,
  totalPages,
}: ProgressBarProps) {
  const percent = Math.min(
    100,
    Math.round((currentQuestion / totalQuestions) * 100),
  );

  // Phase 1.5-α Day 9: Brand v2 化 (sunYellow バー + deepPurple テキスト)
  // - 背景は lavender 半透明 + blur で下のページ背景と馴染ませる
  // - バー本体は white/60 で控えめ、フィルは #FFE993 で進捗を明るく可視化
  return (
    <div className="sticky top-0 z-10 bg-[#E4E0F5]/95 backdrop-blur-sm border-b border-[#0094D8]/15">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex justify-between text-sm font-bold text-[#3A2D6B] mb-2">
          <span>
            質問 {currentQuestion} / {totalQuestions}
          </span>
          <span>
            Page {currentPage} / {totalPages}
          </span>
        </div>
        <div
          className="w-full h-2 bg-white/60 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full bg-[#FFE993] transition-all duration-500 ease-out rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
