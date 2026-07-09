"use client";

interface DiagnosisProgressBarProps {
  currentQuestion: number; // 回答済み問題数 (0-50)
  totalQuestions: number; // 50
  // 「前のページ」タップ時 (page 0 は上位ページへ抜ける想定)。
  // 省略時は戻る導線を出さず、ピルだけを右寄せで表示する (前ページが無い画面用)。
  onPrev?: () => void;
}

// 16Personalities のテスト画面に寄せた自己診断用の上部バー。
//   - 左: 「← 前のページ」戻るリンク
//   - 右: 細いピル型の進捗バー (回答済み割合。テキスト表示は持たない)
//   横幅は質問カード・スケール・フッターと同じ max-w-[1080px] / px-8 に揃える
//   (前のページ〜ピルの左右端が質問文・○・フッター列の左右端と一致する)。
// ※ friend フローの進捗は別デザインの ProgressBar を使うため分離している。
export function DiagnosisProgressBar({
  currentQuestion,
  totalQuestions,
  onPrev,
}: DiagnosisProgressBarProps) {
  const percent = Math.min(
    100,
    Math.round((currentQuestion / totalQuestions) * 100),
  );

  return (
    <div className="sticky top-0 z-10 border-b border-[#2E2E5C]/10 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-4 py-3.5 md:px-8">
        {/* 前のページ (16P 同様、上部左に控えめな戻る導線)。onPrev 省略時は
            空の spacer にしてピルを右寄せに保つ。 */}
        {onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="flex items-center gap-1.5 text-sm font-bold text-[#5B5BEF] transition-opacity hover:opacity-70 md:text-[15px]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            前のページ
          </button>
        ) : (
          <span aria-hidden="true" />
        )}

        {/* 進捗ピル: 回答済み割合。細いバーだけで現在地を示す。 */}
        <div
          className="h-2 w-[38%] min-w-[120px] max-w-[220px] overflow-hidden rounded-full bg-[#ECECF6]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`質問 ${currentQuestion} / ${totalQuestions}`}
        >
          <div
            className="h-full rounded-full bg-[#5B5BEF] transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
