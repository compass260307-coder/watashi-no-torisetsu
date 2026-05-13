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
  return (
    <div className="w-full max-w-lg mx-auto bg-card-bg rounded-2xl border border-card-border shadow-sm p-5 sm:p-6 mb-4">
      <div className="inline-block rounded-md bg-label-bg px-2.5 py-1 text-[11px] font-bold text-primary border border-card-border mb-3">
        Q{questionNumber}
      </div>
      <p className="text-base sm:text-lg font-bold text-foreground leading-relaxed mb-6">
        {question.text}
      </p>
      <LikertScale value={value} onChange={onChange} />
    </div>
  );
}
