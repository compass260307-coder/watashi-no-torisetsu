"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { questions } from "@/lib/questions";
import { diagnose } from "@/lib/diagnosis";
import { track, isPreviewMode } from "@/lib/track";
import type { AnswerValue } from "@/lib/types";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { ProgressBar } from "@/components/diagnosis/ProgressBar";
import { QuestionCard } from "@/components/diagnosis/QuestionCard";

const QUESTIONS_PER_PAGE = 10;
const TOTAL_PAGES = 5;
const TOTAL_QUESTIONS = QUESTIONS_PER_PAGE * TOTAL_PAGES;
const STORAGE_KEY = "torisetsu_answers_v2";
const MIN_LOADING_MS = 20000;

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
  // Phase 3-β D-4: ?source=line (LINE リッチメニュー経由) + 過去診断あり → 再診断モーダル表示
  const isFromLine = source === "line";

  const [currentPage, setCurrentPage] = useState(0); // 0-indexed (0..4)
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  // D-4: 再診断確認モーダル
  const [showRediagnoseModal, setShowRediagnoseModal] = useState(false);

  const trackedStart = useRef(false);

  // localStorage 復元 (初回マウント時のみ; SSR 後のハイドレーション正規パターン)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<number, AnswerValue>;
        // 不正な保存値は弾く
        const valid: Record<number, AnswerValue> = {};
        for (const [k, v] of Object.entries(parsed)) {
          const id = Number(k);
          if (
            Number.isInteger(id) &&
            id >= 1 &&
            id <= TOTAL_QUESTIONS &&
            typeof v === "number" &&
            v >= 1 &&
            v <= 7
          ) {
            valid[id] = v as AnswerValue;
          }
        }
        setAnswers(valid);
        // 既に途中まで回答済みなら、最初の未回答が含まれるページに飛ばす
        const firstUnanswered = questions.find((q) => valid[q.id] === undefined);
        if (firstUnanswered) {
          const pageIdx = Math.floor(
            (firstUnanswered.id - 1) / QUESTIONS_PER_PAGE,
          );
          setCurrentPage(pageIdx);
        }
      }
    } catch {
      // 破損データは無視
    }
    // Phase 3-β D-4: ?source=line + 過去診断結果 (torisetsu_result) があれば再診断確認モーダル表示
    if (isFromLine) {
      try {
        const previousResult = localStorage.getItem("torisetsu_result");
        if (previousResult) setShowRediagnoseModal(true);
      } catch {
        // localStorage 不可なら表示しない (新規扱い)
      }
    }
    setHydrated(true);
  }, [isFromLine]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 回答変更時に自動保存
  useEffect(() => {
    if (!hydrated) return;
    if (Object.keys(answers).length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // quota など失敗してもクリティカルではない
    }
  }, [answers, hydrated]);

  // 起動 track (1 回のみ)
  useEffect(() => {
    if (!trackedStart.current) {
      trackedStart.current = true;
      track("diagnosis_started");
    }
  }, []);

  const pageQuestions = questions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE,
  );
  const isPageComplete = pageQuestions.every(
    (q) => answers[q.id] !== undefined,
  );
  const isAllComplete = questions.every((q) => answers[q.id] !== undefined);
  const answeredCount = Object.keys(answers).length;
  const isLastPage = currentPage === TOTAL_PAGES - 1;

  const handleAnswer = (questionId: number, value: AnswerValue) => {
    setAnswers((prev) => {
      if (prev[questionId] === value) return prev;
      return { ...prev, [questionId]: value };
    });
    track("diagnosis_question_answered", {
      metadata: { questionId },
    });
  };

  const handleNext = () => {
    if (!isPageComplete || isLastPage) return;
    setCurrentPage((p) => p + 1);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrev = () => {
    if (currentPage === 0) return;
    setCurrentPage((p) => p - 1);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    if (!isAllComplete || submitting) return;
    setSubmitError(false);
    setSubmitting(true);

    const result = diagnose(answers);
    try {
      localStorage.setItem("torisetsu_result", JSON.stringify(result));
    } catch {
      // 無視
    }
    track("diagnosis_completed", { metadata: { typeId: result.typeId } });

    const startedAt = Date.now();
    const waitMin = async () => {
      const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    };

    const clearProgress = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // 無視
      }
    };

    if (isPreviewMode()) {
      try {
        localStorage.setItem("torisetsu_invite_code", "preview");
      } catch {
        // 無視
      }
      await waitMin();
      clearProgress();
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
          facetScores: result.facetScores,
          fullCode: result.fullCode,
          cModifier: result.cModifier,
          nModifier: result.nModifier,
          modifierLabel: result.modifierLabel,
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
        clearProgress();
        router.push(`/result/${data.ownerToken}`);
        return;
      }
    } catch {
      clearProgress();
      router.push("/result");
      return;
    }

    await waitMin();
    clearProgress();
    router.push("/result");
  };

  if (submitting) {
    return <DiagnosisAnalyzingLoader />;
  }

  // Phase 3-β D-4: 再診断確認モーダル
  const closeRediagnoseModal = () => setShowRediagnoseModal(false);
  const cancelRediagnose = () => {
    // キャンセル時はマイ図鑑へ戻る (LIFF redirect 経由)
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
    if (liffId) {
      window.location.replace(
        `https://liff.line.me/${liffId}?dest=zukan-mine`,
      );
    } else {
      router.push("/");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen pb-28">
      {showRediagnoseModal && (
        <RediagnoseConfirmModal
          onConfirm={closeRediagnoseModal}
          onCancel={cancelRediagnose}
        />
      )}
      <ProgressBar
        currentQuestion={answeredCount}
        totalQuestions={TOTAL_QUESTIONS}
        currentPage={currentPage + 1}
        totalPages={TOTAL_PAGES}
      />

      <main className="flex flex-col flex-1 px-4 pt-6 pb-4 w-full">
        {pageQuestions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            questionNumber={q.id}
            value={answers[q.id]}
            onChange={(v) => handleAnswer(q.id, v)}
          />
        ))}

        {!isPageComplete && (
          <p className="text-center text-xs text-muted mt-2 mb-4">
            このページの 10 問すべてに答えると、次のページに進めるよ
          </p>
        )}

        {submitError && (
          <p className="text-center text-xs text-red-500 mt-2 mb-2">
            送信に失敗しました。もう一度お試しください。
          </p>
        )}
      </main>

      {/* 下部固定ナビ */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-card-border z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex gap-3 items-center">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentPage === 0}
            className={`rounded-full border-2 border-card-border px-5 py-3 text-sm font-bold transition-all ${
              currentPage === 0
                ? "opacity-0 pointer-events-none"
                : "text-muted hover:bg-label-bg"
            }`}
          >
            戻る
          </button>

          {!isLastPage ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!isPageComplete}
              className={`flex-1 rounded-full px-6 py-3 text-sm font-bold text-white transition-all ${
                isPageComplete
                  ? "bg-primary-gradient hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-card-border text-muted cursor-not-allowed"
              }`}
            >
              次へ
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isAllComplete || submitting}
              className={`flex-1 rounded-full px-6 py-3 text-sm font-bold text-white transition-all ${
                isAllComplete && !submitting
                  ? "bg-primary-gradient hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-card-border text-muted cursor-not-allowed"
              }`}
            >
              {submitting ? "診断中..." : "結果を見る"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Phase 3-β D-4: 再診断確認モーダル
// LINE 経由 (?source=line) + 過去診断結果 (localStorage.torisetsu_result) 存在時に
// 診断 50 問の前にだけ表示。OK で診断スタート、キャンセルでマイ図鑑に戻る。
// =========================================================================
function RediagnoseConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rediagnose-title"
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-modal-slide-up">
        <h2
          id="rediagnose-title"
          className="text-lg font-extrabold text-center mb-3"
        >
          🔄 再診断について
        </h2>
        <p className="text-sm text-foreground leading-relaxed mb-2">
          過去の診断とトリセツ図鑑は
          <span className="font-bold text-primary">全部残ります</span>。
        </p>
        <p className="text-sm text-muted leading-relaxed mb-6">
          新しいあなたの発見、楽しみですね 🐧
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98]"
          >
            OK、新しく診断する
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted hover:text-foreground underline transition-colors"
          >
            キャンセル (マイ図鑑に戻る)
          </button>
        </div>
      </div>
    </div>
  );
}
