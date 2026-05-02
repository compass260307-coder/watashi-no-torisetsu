"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { friendQuestions, friendAnswerOptions } from "@/lib/friend-questions";
import type { AnswerValue } from "@/lib/types";

type FriendAnswer = AnswerValue | string;

export default function FriendPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, FriendAnswer>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const totalQuestions = friendQuestions.length;
  const currentQuestion = friendQuestions[currentIndex];
  const progress = completed
    ? 100
    : (currentIndex / totalQuestions) * 100;

  const advance = useCallback(
    (newAnswers: Record<number, FriendAnswer>) => {
      if (currentIndex < totalQuestions - 1) {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setIsTransitioning(false);
        }, 300);
      } else {
        localStorage.setItem(
          "torisetsu_friend_answers",
          JSON.stringify(newAnswers)
        );
        setIsTransitioning(true);
        setTimeout(() => {
          setCompleted(true);
          setIsTransitioning(false);
        }, 300);
      }
    },
    [currentIndex, totalQuestions]
  );

  const handleScaleAnswer = useCallback(
    (value: AnswerValue) => {
      if (isTransitioning) return;
      const newAnswers = { ...answers, [currentQuestion.id]: value };
      setAnswers(newAnswers);
      advance(newAnswers);
    },
    [answers, currentQuestion?.id, isTransitioning, advance]
  );

  const handleChoiceAnswer = useCallback(
    (choice: string) => {
      if (isTransitioning) return;
      const newAnswers = { ...answers, [currentQuestion.id]: choice };
      setAnswers(newAnswers);
      advance(newAnswers);
    },
    [answers, currentQuestion?.id, isTransitioning, advance]
  );

  const handleBack = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => prev - 1);
        setIsTransitioning(false);
      }, 200);
    }
  }, [currentIndex, isTransitioning]);

  if (completed) {
    return (
      <div
        className={`flex flex-col flex-1 transition-opacity duration-300 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
      >
        <main className="flex flex-col flex-1 items-center justify-center px-5 py-12 max-w-lg mx-auto w-full">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-extrabold mb-2 text-center">
            ありがとう！
          </h1>
          <p className="text-sm text-muted text-center leading-relaxed mb-2">
            あなたの回答が、
            <br />
            友達のトリセツを完成させます
          </p>
          <p className="text-xs text-muted/60 mb-10">
            回答は匿名で届きます
          </p>

          <div className="w-full rounded-2xl border border-card-border bg-card-bg p-6 text-center mb-6">
            <p className="text-sm font-bold mb-1">
              あなたのトリセツも作ってみない？
            </p>
            <p className="text-xs text-muted mb-5 leading-relaxed">
              15問答えるだけ、3分で完成
            </p>
            <Link
              href="/diagnosis"
              className="inline-block w-full max-w-xs rounded-full bg-primary px-8 py-4 text-base font-bold text-white shadow-md transition-colors hover:bg-primary-hover active:scale-[0.98]"
            >
              自分のトリセツを作る
            </Link>
          </div>

          <Link
            href="/"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            トップに戻る
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-card-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={handleBack}
            className={`text-sm font-medium transition-opacity ${
              currentIndex > 0
                ? "text-muted hover:text-foreground"
                : "opacity-0 pointer-events-none"
            }`}
          >
            ← 戻る
          </button>
          <span className="text-xs font-bold text-muted">
            {currentIndex + 1} / {totalQuestions}
          </span>
          <div className="w-12" />
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-card-border">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Intro banner (first question only) */}
      {currentIndex === 0 && !isTransitioning && (
        <div className="bg-label-bg border-b border-card-border px-5 py-3 text-center">
          <p className="text-xs text-muted leading-relaxed">
            友達があなたにトリセツの回答をお願いしています
            <br />
            <span className="font-bold">10問・2分で終わります</span>
          </p>
        </div>
      )}

      {/* Question */}
      <main className="flex flex-col flex-1 items-center justify-center px-5 py-8 max-w-lg mx-auto w-full">
        <div
          className={`flex flex-col items-center w-full transition-opacity duration-200 ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Question label */}
          <div className="inline-block rounded-md bg-label-bg px-3 py-1 text-xs font-bold text-primary mb-6 border border-card-border">
            Q{currentIndex + 1}
          </div>

          {/* Question text */}
          <h2 className="text-lg font-bold text-center leading-relaxed mb-10 px-2">
            {currentQuestion.text}
          </h2>

          {/* Answer options */}
          <div className="flex flex-col gap-3 w-full max-w-sm">
            {currentQuestion.type === "scale" ? (
              friendAnswerOptions.map((option) => {
                const isSelected =
                  answers[currentQuestion.id] === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleScaleAnswer(option.value)}
                    className={`w-full rounded-xl border-2 px-5 py-4 text-sm font-medium transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-card-border bg-card-bg text-foreground hover:border-primary/40"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })
            ) : (
              currentQuestion.choices?.map((choice) => {
                const isSelected =
                  answers[currentQuestion.id] === choice;
                return (
                  <button
                    key={choice}
                    onClick={() => handleChoiceAnswer(choice)}
                    className={`w-full rounded-xl border-2 px-5 py-4 text-sm font-medium transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-card-border bg-card-bg text-foreground hover:border-primary/40"
                    }`}
                  >
                    {choice}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted">
        {currentQuestion.type === "choice"
          ? "ピンとくるものを選んでね"
          : "直感で選んでね"}
      </footer>
    </div>
  );
}
