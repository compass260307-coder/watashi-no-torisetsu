"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { friendQuestions, friendAnswerOptions } from "@/lib/friend-questions";
import type { AnswerValue } from "@/lib/types";

type FriendAnswer = AnswerValue | string;

export default function FriendPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = use(params);
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, FriendAnswer>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const totalQuestions = friendQuestions.length;
  const currentQuestion = friendQuestions[currentIndex];
  const progress = completed
    ? 100
    : (currentIndex / totalQuestions) * 100;

  const submitAnswers = useCallback(
    async (finalAnswers: Record<number, FriendAnswer>) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/friend-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode, answers: finalAnswers }),
        });
        if (!res.ok) {
          setSubmitError(true);
        }
      } catch {
        setSubmitError(true);
      } finally {
        setSubmitting(false);
      }
    },
    [inviteCode],
  );

  const advance = useCallback(
    (newAnswers: Record<number, FriendAnswer>) => {
      if (currentIndex < totalQuestions - 1) {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setIsTransitioning(false);
        }, 300);
      } else {
        setIsTransitioning(true);
        setTimeout(() => {
          setCompleted(true);
          setIsTransitioning(false);
        }, 300);
        submitAnswers(newAnswers);
      }
    },
    [currentIndex, totalQuestions, submitAnswers],
  );

  const handleScaleAnswer = useCallback(
    (value: AnswerValue) => {
      if (isTransitioning) return;
      const newAnswers = { ...answers, [currentQuestion.id]: value };
      setAnswers(newAnswers);
      advance(newAnswers);
    },
    [answers, currentQuestion?.id, isTransitioning, advance],
  );

  const handleChoiceAnswer = useCallback(
    (choice: string) => {
      if (isTransitioning) return;
      const newAnswers = { ...answers, [currentQuestion.id]: choice };
      setAnswers(newAnswers);
      advance(newAnswers);
    },
    [answers, currentQuestion?.id, isTransitioning, advance],
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

  // --- Intro screen ---
  if (!started) {
    return (
      <div className="flex flex-col flex-1">
        <main className="flex flex-col flex-1 items-center justify-center px-5 py-12 max-w-lg mx-auto w-full">
          <div className="inline-block rounded-md bg-label-bg px-3 py-1 text-[10px] font-bold tracking-wider text-muted mb-6 border border-card-border">
            INSTRUCTION MANUAL
          </div>

          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-xl font-extrabold mb-2 text-center">
            ワタシのトリセツ
          </h1>
          <p className="text-sm text-muted text-center leading-relaxed mb-8">
            友達があなたに
            <br />
            <span className="font-bold text-foreground">
              「自分の印象を教えてほしい」
            </span>
            とお願いしています。
          </p>

          <div className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-8">
            <p className="text-xs font-bold text-muted mb-3">
              あなたから見たその人の印象を教えてください
            </p>
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-label-bg text-sm shrink-0">
                  ✏️
                </span>
                <span className="text-sm">
                  <span className="font-bold">5問だけ。</span>1分で終わります
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-label-bg text-sm shrink-0">
                  🔒
                </span>
                <span className="text-sm">ログイン・登録は不要です</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-label-bg text-sm shrink-0">
                  🤫
                </span>
                <span className="text-sm">回答は匿名で届きます</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-label-bg text-sm shrink-0">
                  💡
                </span>
                <span className="text-sm">正解はありません。直感でOK</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => setStarted(true)}
            className="w-full max-w-xs rounded-full bg-primary px-8 py-4 text-base font-bold text-white shadow-md transition-colors hover:bg-primary-hover active:scale-[0.98]"
          >
            回答をはじめる
          </button>
        </main>
      </div>
    );
  }

  // --- Completion screen ---
  if (completed) {
    return (
      <div
        className={`flex flex-col flex-1 transition-opacity duration-300 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
      >
        <main className="flex flex-col flex-1 items-center justify-center px-5 py-12 max-w-lg mx-auto w-full">
          {submitting ? (
            <div className="text-muted text-sm">送信中...</div>
          ) : submitError ? (
            <>
              <div className="text-5xl mb-4">😢</div>
              <h1 className="text-2xl font-extrabold mb-2 text-center">
                送信できませんでした
              </h1>
              <p className="text-sm text-muted text-center leading-relaxed mb-8">
                通信エラーが発生しました。
                <br />
                もう一度お試しください。
              </p>
              <button
                onClick={() => {
                  setSubmitError(false);
                  submitAnswers(answers);
                }}
                className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-white"
              >
                もう一度送信する
              </button>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4 animate-scale-in">🎉</div>
              <h1 className="text-2xl font-extrabold mb-2 text-center animate-fade-in-up stagger-1">
                ありがとう！
              </h1>
              <p className="text-sm text-muted text-center leading-relaxed mb-2 animate-fade-in-up stagger-2">
                あなたの回答で、
                <br />
                友達のトリセツが少し完成しました
              </p>
              <p className="text-xs text-muted/60 mb-10 animate-fade-in stagger-3">
                回答は匿名で届きます
              </p>

              <div className="w-full rounded-2xl border border-card-border bg-card-bg overflow-hidden mb-6 animate-fade-in-up stagger-4">
                <div className="bg-label-bg px-6 py-3 text-center border-b border-card-border">
                  <p className="text-[10px] font-bold tracking-wider text-muted">
                    NEXT STEP
                  </p>
                </div>
                <div className="p-6 text-center">
                  <div className="text-3xl mb-3">📋</div>
                  <p className="text-sm font-bold mb-1">
                    あなたのトリセツも作ってみない？
                  </p>
                  <p className="text-xs text-muted mb-5 leading-relaxed">
                    友達にも聞いてみよう。15問・3分で完成
                  </p>
                  <Link
                    href="/diagnosis"
                    className="inline-block w-full max-w-xs rounded-full bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover active:scale-[0.98]"
                  >
                    自分のトリセツを作る
                  </Link>
                  <p className="text-[10px] text-muted mt-3">
                    登録不要・完全無料
                  </p>
                </div>
              </div>

              <Link
                href="/"
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                トップに戻る
              </Link>
            </>
          )}
        </main>
      </div>
    );
  }

  // --- Question screen ---
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

      {/* Context bar */}
      <div className="bg-label-bg border-b border-card-border px-5 py-2 text-center">
        <p className="text-[11px] text-muted">
          友達について回答中 ・ あなたから見た印象でOK
        </p>
      </div>

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
