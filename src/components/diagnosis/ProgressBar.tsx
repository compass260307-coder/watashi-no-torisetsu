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

  // feat/top-page: トップページのデザイン言語に統一 (白 + ネイビー + Sora ブルー)。
  // 16P 同様、テスト中は上部の細い進捗バーだけで現在地を示す。
  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#2E2E5C]/10">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex justify-between text-sm font-bold text-[#2E2E5C] mb-2">
          <span>
            質問 {currentQuestion} / {totalQuestions}
          </span>
          <span className="text-[#8A8AA3]">
            Page {currentPage} / {totalPages}
          </span>
        </div>
        <div
          className="w-full h-2 bg-[#ECECF6] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full bg-[#5B5BEF] transition-all duration-500 ease-out rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
