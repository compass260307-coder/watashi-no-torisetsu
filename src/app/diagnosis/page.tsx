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
import {
  StickyCtaFooter,
  ctaPrimary,
  ctaSecondary,
} from "@/components/StickyCtaFooter";

const QUESTIONS_PER_PAGE = 10;
const TOTAL_PAGES = 5;
const TOTAL_QUESTIONS = QUESTIONS_PER_PAGE * TOTAL_PAGES;
const STORAGE_KEY = "torisetsu_answers_v2";
// Phase 1.5-α Day 12-Polish-B: ニックネームの localStorage 保存先 (再訪時の自動入力)
const NICKNAME_KEY = "torisetsu_nickname_v2";
const NICKNAME_MAX = 20;
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

  // Phase 1.5-α Day 12-Polish-B: 基本情報ステップ (50 問の前にニックネーム取得)
  // step = "basic-info" → ニックネーム入力、"questions" → Q1〜Q50
  const [step, setStep] = useState<"basic-info" | "questions">("basic-info");
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);

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
    // Day 12-Polish-B: 既保存のニックネームを input にプリフィル (再訪時の自動入力)
    try {
      const savedNick = localStorage.getItem(NICKNAME_KEY);
      if (savedNick) setNickname(savedNick.slice(0, NICKNAME_MAX));
    } catch {
      // 無視
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

  // Phase 1.5-α Day 12-Polish-B: 基本情報ステップ → 質問ステップへの遷移
  const handleBasicInfoNext = () => {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      setNicknameError("ニックネームを入力してね");
      return;
    }
    if (trimmed.length > NICKNAME_MAX) {
      setNicknameError(`${NICKNAME_MAX} 文字以内で入力してね`);
      return;
    }
    setNicknameError(null);
    try {
      localStorage.setItem(NICKNAME_KEY, trimmed);
    } catch {
      // localStorage 不可でも進める
    }
    setStep("questions");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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
          // Day 12-Polish-B: 基本情報ステップで取得したニックネーム
          displayName: nickname.trim() || undefined,
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
    // キャンセル時はマイ図鑑へ戻る (Web ファースト: Cookie ベースで直接アクセス可)
    router.push("/zukan-mine");
  };

  // Polish-D-A FINAL: 標準 CTA は components/StickyCtaFooter.tsx の
  //   ctaPrimary / ctaSecondary を import して使用する (ローカル定義は廃止)。
  //   disabled は CSS で opacity:50 + cursor-not-allowed のみ、形・枠は維持。

  // Phase 1.5-α Day 12-Polish-B: 基本情報ステップ (50 問の前にニックネームを取得)
  // 「最初の質問」として位置づける UX (ステップではなく Q0 相当)
  if (step === "basic-info") {
    return (
      <div className="relative flex flex-col flex-1 min-h-screen pb-32 bg-[#E4E0F5]">
        {showRediagnoseModal && (
          <RediagnoseConfirmModal
            onConfirm={closeRediagnoseModal}
            onCancel={cancelRediagnose}
          />
        )}
        {/* Polish-B.2: 進捗インジケータは右上に極小表示 (basic-info はミニマル) */}
        <div className="absolute top-3 right-4 z-10">
          <span
            className="text-[10px] font-black tracking-[0.25em] text-[#3A2D6B]/45"
            aria-label={`Step 0 of ${TOTAL_PAGES}`}
          >
            0 / {TOTAL_PAGES}
          </span>
        </div>

        {/* Polish-B.3: Q11/Q12 と同じ世界観に揃える
            (カード + deepPurple ピルバッジ + 太字 deepPurple 見出し + 白入力欄) */}
        <main className="flex flex-col flex-1 px-4 pt-10 pb-4 max-w-lg mx-auto w-full">
          <div className="w-full bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-5">
            <div className="inline-block rounded-full bg-[#3A2D6B] px-3 py-1 text-xs font-black text-white mb-3">
              はじめに
            </div>
            <label
              htmlFor="diagnosis-nickname"
              className="block text-base sm:text-lg font-bold text-[#3A2D6B] leading-relaxed mb-6"
            >
              ニックネームを教えて
            </label>
            <input
              id="diagnosis-nickname"
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (nicknameError) setNicknameError(null);
              }}
              maxLength={NICKNAME_MAX}
              placeholder=""
              autoComplete="off"
              className="w-full rounded-xl border-2 border-[#0094D8]/30 bg-white px-4 py-3 text-base text-[#3A2D6B] font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE993] focus:border-[#3A2D6B] transition-colors"
            />
            {nicknameError && (
              <p role="alert" className="text-[#FE3C72] text-xs font-bold mt-2">
                {nicknameError}
              </p>
            )}
          </div>
        </main>

        {/* Polish-D-A FINAL: 白い床撤去 → StickyCtaFooter (フロスト・グラデ・スクリム) */}
        <StickyCtaFooter>
          <button
            type="button"
            onClick={handleBasicInfoNext}
            className={ctaPrimary}
          >
            次へ
          </button>
        </StickyCtaFooter>
      </div>
    );
  }

  // Polish-D-A FINAL: 白い床撤去 → StickyCtaFooter (全画面共通)
  //   - 戻る は conditional render (page 0 では非表示で 次へ を完全中央に)
  //   - 次へ / 結果を見る は常に同じ ctaPrimary (disabled は opacity のみ)

  return (
    <div className="flex flex-col flex-1 min-h-screen pb-32 bg-[#E4E0F5]">
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
          <p className="text-center text-xs text-[#3A2D6B]/70 font-bold mt-2 mb-4">
            このページの 10 問すべてに答えると、次のページに進めるよ
          </p>
        )}

        {submitError && (
          <p className="text-center text-xs text-[#FE3C72] font-bold mt-2 mb-2">
            送信に失敗しました。もう一度お試しください。
          </p>
        )}
      </main>

      {/* variant="solid": 50 問 ScaleScreen は footer 直上に回答の○が来るため
          ボタン裏で透けないように不透明クリームを敷く */}
      <StickyCtaFooter variant="solid">
        {currentPage > 0 && (
          <button type="button" onClick={handlePrev} className={ctaSecondary}>
            戻る
          </button>
        )}
        {!isLastPage ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!isPageComplete}
            className={ctaPrimary}
          >
            次へ
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isAllComplete || submitting}
            className={ctaPrimary}
          >
            {submitting ? "診断中..." : "結果を見る"}
          </button>
        )}
      </StickyCtaFooter>
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
