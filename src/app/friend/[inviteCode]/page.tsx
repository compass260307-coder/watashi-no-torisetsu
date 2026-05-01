"use client";

import { use, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { friendQuestions, friendAnswerOptions } from "@/lib/friend-questions";
import { track } from "@/lib/track";
import type { AnswerValue } from "@/lib/types";

type FriendAnswer = AnswerValue | string;

const FRIEND_FOOTER_HINTS = [
  "パッと思い浮かんだ印象でOK",
  "正解はないよ、感覚で選んでね",
  "深く考えなくて大丈夫",
  "あなたの直感が一番正確",
  "もう少しで終わるよ",
];

export default function FriendPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = use(params);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, FriendAnswer>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    fetch(`/api/friend-info?code=${inviteCode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.displayName) setOwnerName(data.displayName);
      })
      .catch(() => {});
  }, [inviteCode]);

  const who = ownerName ?? "友達";

  const totalQuestions = friendQuestions.length;
  const currentQuestion = friendQuestions[currentIndex];
  const progress = completed
    ? 100
    : (currentIndex / totalQuestions) * 100;
  const remaining = totalQuestions - currentIndex;

  const submitAnswers = useCallback(
    async (finalAnswers: Record<number, FriendAnswer>) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/friend-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode, answers: finalAnswers }),
        });
        if (res.ok) {
          track("friend_answer_completed", { inviteCode });
        } else {
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
      track("friend_question_answered", { inviteCode, metadata: { questionIndex: currentIndex } });
      advance(newAnswers);
    },
    [answers, currentQuestion?.id, isTransitioning, advance, currentIndex, inviteCode],
  );

  const handleChoiceAnswer = useCallback(
    (choice: string) => {
      if (isTransitioning) return;
      const newAnswers = { ...answers, [currentQuestion.id]: choice };
      setAnswers(newAnswers);
      track("friend_question_answered", { inviteCode, metadata: { questionIndex: currentIndex } });
      advance(newAnswers);
    },
    [answers, currentQuestion?.id, isTransitioning, advance, currentIndex, inviteCode],
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
        <main className="flex flex-col flex-1 items-center px-5 py-10 max-w-lg mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6 animate-fade-in-up">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-[10px] font-bold tracking-wider text-muted mb-1">
              ワタシのトリセツ
            </p>
          </div>

          {/* Request card */}
          <div className="w-full rounded-2xl border border-card-border bg-card-bg overflow-hidden mb-4 animate-fade-in-up stagger-2">
            <div className="bg-label-bg px-5 py-2.5 border-b border-card-border">
              <p className="text-[10px] font-bold tracking-wider text-muted text-center">
                {who}さんからのお願い
              </p>
            </div>
            <div className="p-5">
              <p className="text-[15px] font-bold text-center leading-relaxed mb-2">
                あなたから見た{who}さんの印象を
                <br />
                教えてください
              </p>
              <p className="text-xs text-muted text-center leading-relaxed mb-4">
                あなたの回答で、{who}さんのトリセツに
                <br />
                「友達から見た印象」が追加されます
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background p-2.5 text-center">
                  <span className="text-sm">👀</span>
                  <p className="text-[11px] mt-1">第一印象</p>
                </div>
                <div className="rounded-lg bg-background p-2.5 text-center">
                  <span className="text-sm">✨</span>
                  <p className="text-[11px] mt-1">隠れた魅力</p>
                </div>
                <div className="rounded-lg bg-background p-2.5 text-center">
                  <span className="text-sm">📖</span>
                  <p className="text-[11px] mt-1">仲良くなるコツ</p>
                </div>
                <div className="rounded-lg bg-background p-2.5 text-center">
                  <span className="text-sm">💕</span>
                  <p className="text-[11px] mt-1">愛されるクセ</p>
                </div>
              </div>
            </div>
          </div>

          {/* Safety points */}
          <div className="w-full flex flex-wrap justify-center gap-2 mb-8 animate-fade-in-up stagger-3">
            <span className="rounded-full bg-card-bg border border-card-border px-3 py-1.5 text-[11px] text-muted">
              ✏️ 5問だけ・1分で完了
            </span>
            <span className="rounded-full bg-card-bg border border-card-border px-3 py-1.5 text-[11px] text-muted">
              🔒 ログイン不要
            </span>
            <span className="rounded-full bg-card-bg border border-card-border px-3 py-1.5 text-[11px] text-muted">
              🤫 匿名で届く
            </span>
            <span className="rounded-full bg-card-bg border border-card-border px-3 py-1.5 text-[11px] text-muted">
              💡 直感でOK
            </span>
          </div>

          {/* CTA */}
          <button
            onClick={() => {
              setStarted(true);
              track("friend_answer_started", { inviteCode });
            }}
            className="w-full max-w-xs rounded-full bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover active:scale-[0.98] animate-fade-in-up stagger-4"
          >
            {who}さんについて5問答える
          </button>
          <p className="text-[10px] text-muted mt-3 animate-fade-in stagger-4">
            正解はありません。感じたままでOK
          </p>
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
              <p className="text-sm text-center leading-relaxed mb-1 animate-fade-in-up stagger-2">
                あなたの回答が、
                <span className="font-bold">{who}さんのトリセツ</span>
                に追加されました
              </p>
              <p className="text-xs text-muted/60 mb-10 animate-fade-in stagger-3">
                回答は匿名で届きます
              </p>

              {/* CTA card */}
              <div className="w-full rounded-2xl border border-card-border bg-card-bg overflow-hidden mb-6 animate-fade-in-up stagger-4">
                <div className="p-6 text-center">
                  <p className="text-sm text-muted leading-relaxed mb-1">
                    あなたも、友達からどう見えているか
                  </p>
                  <p className="text-sm text-muted leading-relaxed mb-5">
                    気になりませんか？
                  </p>
                  <p className="text-[15px] font-bold mb-2">
                    自分のトリセツを作ると
                  </p>
                  <div className="flex flex-col gap-1.5 mb-5">
                    <p className="text-xs text-muted">
                      ✓ 自分では気づけない一面が見える
                    </p>
                    <p className="text-xs text-muted">
                      ✓ 友達からの意外な評価がわかる
                    </p>
                    <p className="text-xs text-muted">
                      ✓ 15問・3分・登録不要
                    </p>
                  </div>
                  <Link
                    href="/diagnosis"
                    onClick={() => track("friend_to_diagnosis_clicked", { inviteCode })}
                    className="inline-block w-full max-w-xs rounded-full bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover active:scale-[0.98]"
                  >
                    自分のトリセツを作る
                  </Link>
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">
              {currentIndex + 1} / {totalQuestions}
            </span>
            {remaining <= 3 && remaining > 0 && (
              <span className="text-[10px] text-primary font-bold">
                あと{remaining}問
              </span>
            )}
          </div>
          <div className="w-12" />
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-card-border">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Context bar */}
      <div className="bg-label-bg border-b border-card-border px-5 py-2 text-center">
        <p className="text-[11px] text-muted">
          {who}さんについて回答中 ・ あなたの印象でOK
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

      {/* Footer hint - rotating */}
      <footer className="py-4 text-center text-xs text-muted">
        {FRIEND_FOOTER_HINTS[currentIndex % FRIEND_FOOTER_HINTS.length]}
      </footer>
    </div>
  );
}
