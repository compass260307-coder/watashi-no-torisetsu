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

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-card-border">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex justify-between text-xs font-bold text-muted mb-2">
          <span>
            質問 {currentQuestion} / {totalQuestions}
          </span>
          <span>
            Page {currentPage} / {totalPages}
          </span>
        </div>
        <div
          className="w-full h-1.5 bg-card-border rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full bg-primary-gradient transition-all duration-500 ease-out rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
