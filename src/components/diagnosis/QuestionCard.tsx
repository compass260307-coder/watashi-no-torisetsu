"use client";

import type { AnswerValue, Question } from "@/lib/types";
import { LikertScale } from "./LikertScale";

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}

export function QuestionCard({
  question,
  questionNumber,
  value,
  onChange,
}: QuestionCardProps) {
  // Phase 1.5-α Day 9: Brand v2 化
  // - カード: rounded-3xl + border-2 #0094D8/25 + shadow-md で LP の特徴カードと統一
  // - Q番号バッジ: deepPurple bg + 白字 + 丸ピル
  // - 質問文: deepPurple
  // - 質問文 / 回答ロジック / スコアリングは一切変更しない (見た目のみ)
  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-5">
      <div className="inline-block rounded-full bg-[#3A2D6B] px-3 py-1 text-xs font-black text-white mb-3">
        Q{questionNumber}
      </div>
      <p className="text-base sm:text-lg font-bold text-[#3A2D6B] leading-relaxed mb-6">
        {question.text}
      </p>
      <LikertScale value={value} onChange={onChange} />
    </div>
  );
}
