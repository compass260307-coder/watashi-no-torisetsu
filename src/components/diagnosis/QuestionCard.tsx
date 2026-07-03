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
  // feat/top-page: 16Personalities のテスト画面を参考にした構成へ刷新。
  //   - 白カード / Q番号バッジを廃止し、質問文を中央寄せの大きめテキストに
  //   - 質問間は細い区切り線のみ (白背景に質問が縦に流れる 16P の型)
  //   - 回答済みの質問はフェード (現在の質問に視線が集まる 16P の挙動。
  //     hover / focus 内包時は戻して答え直しも読みやすく)
  //   - 質問文 / 回答ロジック / スコアリングは一切変更しない (見た目のみ)
  const answered = value !== undefined;
  return (
    <div
      aria-label={`質問 ${questionNumber}`}
      className={[
        "w-full max-w-2xl mx-auto px-2 py-8 sm:py-10",
        "border-b border-[#2E2E5C]/10",
        "transition-opacity duration-300",
        answered ? "opacity-50 hover:opacity-100 focus-within:opacity-100" : "",
      ].join(" ")}
    >
      <p className="text-center text-[17px] sm:text-[20px] font-bold text-[#2E2E5C] leading-relaxed mb-7">
        {question.text}
      </p>
      <LikertScale value={value} onChange={onChange} />
    </div>
  );
}
