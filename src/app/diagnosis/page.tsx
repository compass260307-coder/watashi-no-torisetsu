"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { questions, answerOptions } from "@/lib/questions";
import { diagnose } from "@/lib/diagnosis";
import { track, isPreviewMode } from "@/lib/track";
import type { AnswerValue } from "@/lib/types";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";

const MIN_LOADING_MS = 20000;

const FOOTER_HINTS = [
  "深く考えなくてOK、直感で選んでね",
  "パッと浮かんだ方でOK",
  "正解はないよ、気楽にね",
  "考えすぎず、サクッと選ぼう",
  "迷ったら「なんとなく」で大丈夫",
];

export default function DiagnosisPage() {
  return (
    <Suspense>
      <DiagnosisContent />
    </Suspense>
  );
}

function DiagnosisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaign = searchParams.get("campaign");
  const source = searchParams.get("source");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tracked = useRef(false);
  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true;
      track("diagnosis_started");
    }
  }, []);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const progress = (currentIndex / totalQuestions) * 100;
  const remaining = totalQuestions - currentIndex;

  const handleAnswer = useCallback(
    async (value: AnswerValue) => {
      if (isTransitioning) return;

      const newAnswers = { ...answers, [currentQuestion.id]: value };
      setAnswers(newAnswers);
      track("diagnosis_question_answered", { metadata: { questionIndex: currentIndex } });

      if (currentIndex < totalQuestions - 1) {
        const nextIndex = currentIndex + 1;
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentIndex(nextIndex);
          setIsTransitioning(false);
        }, 300);
      } else {
        const result = diagnose(newAnswers);
        localStorage.setItem("torisetsu_result", JSON.stringify(result));
        track("diagnosis_completed", { metadata: { typeId: result.typeId } });

        setSubmitting(true);
        const startedAt = Date.now();
        const waitMin = async () => {
          const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
          }
        };

        if (isPreviewMode()) {
          localStorage.setItem("torisetsu_invite_code", "preview");
          await waitMin();
          router.push("/result");
          return;
        }

        try {
          const res = await fetch("/api/diagnosis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              typeId: result.typeId,
              scores: result.scores,
              campaign: campaign || undefined,
              sourceInviteCode: source || undefined,
            }),
          });
          const data = await res.json();
          if (data.inviteCode) {
            localStorage.setItem("torisetsu_invite_code", data.inviteCode);
          }
          if (data.ownerToken) {
            localStorage.setItem("torisetsu_owner_token", data.ownerToken);
            await waitMin();
            router.push(`/result/${data.ownerToken}`);
            return;
          }
        } catch {
          // Supabase失敗時はlocalStorageでフォールバック、最低待機もスキップ
          router.push("/result");
          return;
        }

        await waitMin();
        router.push("/result");
      }
    },
    [
      answers,
      currentIndex,
      currentQuestion.id,
      isTransitioning,
      totalQuestions,
      router,
      campaign,
      source,
    ],
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

  if (submitting) {
    return <DiagnosisAnalyzingLoader />;
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">
              {currentIndex + 1} / {totalQuestions}
            </span>
            {remaining <= 5 && remaining > 0 && (
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
            className="h-full bg-primary transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

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
            {answerOptions.map((option) => {
              const isSelected =
                answers[currentQuestion.id] === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className={`w-full rounded-xl border-2 px-5 py-4 text-sm font-medium transition-all active:scale-[0.98] ${
                    isSelected
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-card-border bg-card-bg text-foreground hover:border-primary/40"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer hint - rotating */}
      <footer className="py-4 text-center text-xs text-muted">
        {FOOTER_HINTS[currentIndex % FOOTER_HINTS.length]}
      </footer>
    </div>
  );
}
