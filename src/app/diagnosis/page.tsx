"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { questions } from "@/lib/questions";
import { diagnose } from "@/lib/diagnosis";
import { track, isPreviewMode } from "@/lib/track";
import { readAcquisition } from "@/lib/acquisition";
import type { AnswerValue } from "@/lib/types";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { ProgressBar } from "@/components/diagnosis/ProgressBar";
import { QuestionCard } from "@/components/diagnosis/QuestionCard";
import { StickyCtaFooter } from "@/components/StickyCtaFooter";
import { InAppBrowserModal } from "@/components/InAppBrowserModal";

// feat/top-page: 診断ページをトップページのデザイン言語 (白 / ネイビー / Sora ブルー /
// Noto Sans) に統一。CTA も共通の sunYellow ではなくトップの sora-cta ピルを使う。
// 質問文・回答ロジック・自動送り・途中保存・計測は一切変更しない (見た目のみ)。
const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const soraPrimary =
  "sora-cta rounded-full px-10 py-4 min-w-[180px] font-bold text-center block transition-all duration-150 hover:translate-y-px active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";

const QUESTIONS_PER_PAGE = 10;
const TOTAL_PAGES = 5;
const TOTAL_QUESTIONS = QUESTIONS_PER_PAGE * TOTAL_PAGES;
const STORAGE_KEY = "torisetsu_answers_v2";
// 質問セットのバージョン (質問数で構成を識別)。質問構成が変わると保存を破棄して最初から。
// ※ 質問数が同じまま構成だけ変えた場合は、この末尾の数字を手動で上げて旧保存を弾く。
const QUESTION_SET_VERSION = `q${questions.length}-1`;

// localStorage 保存フォーマット (回答 + 現在ページ + バージョン)。
type SavedProgress = {
  v: string;
  answers: Record<number, AnswerValue>;
  page: number;
};
// Phase 1.5-α Day 12-Polish-B: ニックネームの localStorage 保存先 (再訪時の自動入力)
const NICKNAME_KEY = "torisetsu_nickname_v2";
const NICKNAME_MAX = 20;
const MIN_LOADING_MS = 20000;

// prefers-reduced-motion 尊重: 有効時はスムーズスクロールを無効化 (auto = 瞬間)。
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

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
  // 自動ページ送りの待機中 (0.55s)。この間は footer (次へ) を出さない —
  // ページ完了と同時に isPageComplete が立つため、抑制しないと遷移直前に
  // 「次へ」が一瞬チラつく。
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  // 途中保存の再開候補 (null = 保存なし / すでに選択済み)。選択UI表示中だけ非 null。
  const [pendingResume, setPendingResume] = useState<{
    answers: Record<number, AnswerValue>;
    page: number;
  } | null>(null);
  // D-4: 再診断確認モーダル
  const [showRediagnoseModal, setShowRediagnoseModal] = useState(false);

  const trackedStart = useRef(false);
  // 各質問要素への参照 (回答時の次質問オートスクロール用)。キー = question.id。
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // localStorage 復元 (初回マウント時のみ; SSR 後のハイドレーション正規パターン)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SavedProgress>;
        // #4 バージョン整合: 旧フォーマット / 構成不一致は破棄して最初から
        if (!parsed || parsed.v !== QUESTION_SET_VERSION) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          // 不正な保存値は弾く
          const valid: Record<number, AnswerValue> = {};
          for (const [k, v] of Object.entries(parsed.answers ?? {})) {
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
          if (Object.keys(valid).length > 0) {
            // 再開ページ: 保存ページが有効ならそれ、無効なら最初の未回答ページ
            let page = parsed.page;
            if (
              typeof page !== "number" ||
              !Number.isInteger(page) ||
              page < 0 ||
              page > TOTAL_PAGES - 1
            ) {
              const firstUnanswered = questions.find(
                (q) => valid[q.id] === undefined,
              );
              page = firstUnanswered
                ? Math.floor((firstUnanswered.id - 1) / QUESTIONS_PER_PAGE)
                : TOTAL_PAGES - 1;
            }
            // #2 自動復元はせず、選択UI (続きから / 最初から) を出すため候補だけ保持
            setPendingResume({ answers: valid, page });
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch {
      // 破損データは無視 (通常どおり最初から)
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

  // #1 自動保存: 回答 or ページ変更のたびに、回答内容 + 現在ページ + バージョンを保存
  useEffect(() => {
    if (!hydrated) return;
    if (Object.keys(answers).length === 0) return;
    try {
      const payload: SavedProgress = {
        v: QUESTION_SET_VERSION,
        answers,
        page: currentPage,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // quota など失敗してもクリティカルではない
    }
  }, [answers, currentPage, hydrated]);

  // ページ送り / 質問ステップ突入時: 先頭 (一番上の質問) へスクロールを戻す。
  // クリックハンドラ内の同期 scrollTo は再レンダー前に走り効かないことがあるため、
  // コミット後の effect で実行する。ページ切替は文脈が変わるので auto (瞬間移動)。
  useEffect(() => {
    if (!hydrated || step !== "questions") return;
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentPage, step, hydrated]);

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
    // 先頭へのスクロールは step/currentPage 変化を見る useEffect に集約。
  };

  // #2 「続きから」: 保存した回答と進捗を復元し、質問ステップへ
  const handleResumeContinue = () => {
    if (!pendingResume) return;
    setAnswers(pendingResume.answers);
    setCurrentPage(pendingResume.page);
    setStep("questions");
    setPendingResume(null);
    // 先頭へのスクロールは step/currentPage 変化を見る useEffect に集約。
  };

  // #2 「最初から」: 保存を削除して新規スタート (basic-info のまま)
  const handleResumeFresh = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 無視
    }
    setPendingResume(null);
  };

  const handleAnswer = (questionId: number, value: AnswerValue) => {
    setAnswers((prev) => {
      if (prev[questionId] === value) return prev;
      return { ...prev, [questionId]: value }; // 別の選択肢なら上書き (選び直し可)
    });
    track("diagnosis_question_answered", {
      metadata: { questionId },
    });

    // === 自動ページ送り (16P 方式): この回答でページの全問が埋まったら次ページへ ===
    // 発火条件は「未回答だった質問に答えて、ページの未回答が 0 になった瞬間」のみ。
    //  - 戻って見直し中の答え直し (すでに全問回答済み) では発火しない
    //    (見直しの途中で勝手にページが変わらない)。その場合の前進は footer の
    //    「次へ」(ページ完了時のみ表示) で行う。
    //  - 最終ページは自動送信しない (「結果を見る」を明示的に押す。
    //    API 送信 + 分析ローディングに勝手に入らない)。
    const wasUnanswered = answers[questionId] === undefined;
    const pageJustCompleted =
      wasUnanswered &&
      pageQuestions.every(
        (q) => q.id === questionId || answers[q.id] !== undefined,
      );
    if (pageJustCompleted && !isLastPage) {
      // 選択の色が付くのを一拍見せてからページ送り (ページ先頭へのスクロールは
      // currentPage 変化を見る useEffect に集約済み)。待機中は footer を抑制。
      setAutoAdvancing(true);
      window.setTimeout(() => {
        setCurrentPage((p) => p + 1);
        setAutoAdvancing(false);
      }, 550);
      return;
    }

    // === 自動送り: 「次の質問が未回答のときだけ」その質問へ進む ===
    // 判定基準は「初回かどうか」ではなく「進む先 (= 次の質問) が未回答か」。
    //  - 通常進行 (次が未回答) → 次の質問へオートスクロール。
    //  - 戻って答え直し等で次がすでに回答済み → 進まず留まる (答え済みの先へ飛ばさない)。
    const idx = pageQuestions.findIndex((q) => q.id === questionId);
    if (idx === -1) return;
    const target = pageQuestions[idx + 1]; // 同ページ内の「次の質問」
    if (!target) return; // ページ最後 (未完了 = どこかに未回答が残っている) → 留まる
    if (answers[target.id] !== undefined) return; // 次が回答済み → 留まる
    const el = questionRefs.current[target.id];
    if (!el) return;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    // クリックのレンダリング後に実行 (1 フレーム遅延)。
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior, block: "center" });
      // a11y: フォーカスも次の質問へ移し、スクロール後の迷子を防ぐ
      // (スクロールは上で実施済みなので preventScroll で二重スクロールを避ける)。
      el.focus({ preventScroll: true });
    });
  };

  const handleNext = () => {
    if (!isPageComplete || isLastPage) return;
    setCurrentPage((p) => p + 1);
    // 先頭へのスクロールは currentPage 変化を見る useEffect に集約。
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

    // Day 12-C3: first-touch で保存した流入元 (媒体/キャンペーン) を読む。
    // 新規ユーザー作成時のみ users に書かれる (API 側で creation 分岐のみ採用)。
    const acq = readAcquisition();

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
          // Day 12-C3: SNS媒体別＋キャンペーン別の流入元 (first-touch)
          acquisitionSource: acq.source || undefined,
          acquisitionCampaign: acq.campaign || undefined,
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
      <div
        className="relative flex flex-col flex-1 min-h-screen pb-32 bg-white"
        style={{ fontFamily: FONT_STACK }}
      >
        {/* SNS アプリ内ブラウザ (WebView) 対策: 検出時のみ Safari/Chrome 推奨モーダル */}
        <InAppBrowserModal />
        {showRediagnoseModal && (
          <RediagnoseConfirmModal
            onConfirm={closeRediagnoseModal}
            onCancel={cancelRediagnose}
          />
        )}
        {pendingResume && !showRediagnoseModal && (
          <ResumeChoiceModal
            answeredCount={Object.keys(pendingResume.answers).length}
            totalQuestions={TOTAL_QUESTIONS}
            onContinue={handleResumeContinue}
            onFresh={handleResumeFresh}
          />
        )}
        {/* 進捗インジケータは右上に極小表示 (basic-info はミニマル) */}
        <div className="absolute top-3 right-4 z-10">
          <span
            className="text-[10px] font-bold tracking-[0.25em] text-[#2E2E5C]/45"
            aria-label={`Step 0 of ${TOTAL_PAGES}`}
          >
            0 / {TOTAL_PAGES}
          </span>
        </div>

        {/* 16P 風ミニマル: 白背景に中央寄せの見出し + 入力欄のみ (カード/バッジ廃止) */}
        <main className="flex flex-col flex-1 justify-center px-6 pt-10 pb-4 max-w-md mx-auto w-full">
          <label
            htmlFor="diagnosis-nickname"
            className="block text-center font-bold text-[#2E2E5C] leading-relaxed mb-8"
            style={{ fontSize: "clamp(20px, 2.4vw, 26px)" }}
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
            className="w-full rounded-xl border border-[#2E2E5C]/25 bg-white px-4 py-3.5 text-center text-lg text-[#2E2E5C] font-bold focus:outline-none focus:ring-2 focus:ring-[#5B5BEF] focus:border-[#5B5BEF] transition-colors"
          />
          {nicknameError && (
            <p
              role="alert"
              className="text-[#E86AA6] text-xs font-bold mt-2 text-center"
            >
              {nicknameError}
            </p>
          )}
        </main>

        <StickyCtaFooter variant="white">
          <button
            type="button"
            onClick={handleBasicInfoNext}
            className={soraPrimary}
          >
            次へ
          </button>
        </StickyCtaFooter>
      </div>
    );
  }

  // 16P 方式: 前進は自動ページ送りが担い、「戻る」ボタンは置かない
  // (16P 同様、迷わず前へ進む一方通行の体験にする)。

  return (
    <div
      className="flex flex-col flex-1 min-h-screen pb-32 bg-white"
      style={{ fontFamily: FONT_STACK }}
    >
      {showRediagnoseModal && (
        <RediagnoseConfirmModal
          onConfirm={closeRediagnoseModal}
          onCancel={cancelRediagnose}
        />
      )}
      {pendingResume && !showRediagnoseModal && (
        <ResumeChoiceModal
          answeredCount={Object.keys(pendingResume.answers).length}
          totalQuestions={TOTAL_QUESTIONS}
          onContinue={handleResumeContinue}
          onFresh={handleResumeFresh}
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
          // ref + tabIndex(-1): 回答時に次の未回答質問へ scrollIntoView/focus するための受け皿。
          // 視覚は QuestionCard が担うので wrapper は無装飾 (outline は programmatic focus 用に消す)。
          <div
            key={q.id}
            ref={(el) => {
              questionRefs.current[q.id] = el;
            }}
            tabIndex={-1}
            className="outline-none"
          >
            <QuestionCard
              question={q}
              questionNumber={q.id}
              value={answers[q.id]}
              onChange={(v) => handleAnswer(q.id, v)}
            />
          </div>
        ))}

        {!isPageComplete && (
          <p className="text-center text-xs text-[#8A8AA3] font-bold mt-4 mb-4">
            10 問すべてに答えると、自動で次のページに進むよ
          </p>
        )}

        {submitError && (
          <p className="text-center text-xs text-[#E86AA6] font-bold mt-2 mb-2">
            送信に失敗しました。もう一度お試しください。
          </p>
        )}
      </main>

      {/* variant="white": 白基調ページのため footer も白ベタ + 上端フェード
          (footer 直上に回答の○が来るので半透明 scrim は使わない)。
          自動ページ送り化に伴い footer を出すのは:
            - 最終ページ (結果を見る) 常時
            - 完了済みページに「自動送りなし」で居るとき (途中保存の再開で
              ちょうど完了済みページに着地したレアケース) の「次へ」のみ。
          自動送りの待機中 (autoAdvancing) は isPageComplete が立っていても
          出さない — 遷移直前に「次へ」が一瞬チラつくのを防ぐ。 */}
      {(isLastPage || (isPageComplete && !autoAdvancing)) && (
      <StickyCtaFooter variant="white">
        {!isLastPage ? (
          <button type="button" onClick={handleNext} className={soraPrimary}>
            次へ
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isAllComplete || submitting}
            className={soraPrimary}
          >
            {submitting ? "診断中..." : "結果を見る"}
          </button>
        )}
      </StickyCtaFooter>
      )}
    </div>
  );
}

// =========================================================================
// 途中保存の再開選択モーダル (前回の続きから / 最初から)
// 保存があるときだけ表示。続きから = 復元、最初から = 保存削除して新規。
// =========================================================================
function ResumeChoiceModal({
  answeredCount,
  totalQuestions,
  onContinue,
  onFresh,
}: {
  answeredCount: number;
  totalQuestions: number;
  onContinue: () => void;
  onFresh: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-title"
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-modal-slide-up">
        <h2
          id="resume-title"
          className="text-lg font-extrabold text-center text-[#2E2E5C] mb-3"
        >
          🔖 前回の続きから?
        </h2>
        <p className="text-sm text-[#2E2E5C] leading-relaxed text-center mb-6">
          前回の回答が残っています (
          <span className="font-bold text-[#5B5BEF]">
            {answeredCount} / {totalQuestions} 問
          </span>
          )。
          <br />
          続きから再開できます。
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="sora-cta w-full rounded-full px-6 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98]"
          >
            前回の続きから
          </button>
          <button
            type="button"
            onClick={onFresh}
            className="text-xs text-[#8A8AA3] hover:text-[#2E2E5C] underline transition-colors"
          >
            最初からやり直す
          </button>
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
          className="text-lg font-extrabold text-center text-[#2E2E5C] mb-3"
        >
          🔄 再診断について
        </h2>
        <p className="text-sm text-[#2E2E5C] leading-relaxed mb-2">
          過去の診断とトリセツ図鑑は
          <span className="font-bold text-[#5B5BEF]">全部残ります</span>。
        </p>
        <p className="text-sm text-[#8A8AA3] leading-relaxed mb-6">
          新しいあなたの発見、楽しみですね 🐧
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="sora-cta w-full rounded-full px-6 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98]"
          >
            OK、新しく診断する
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[#8A8AA3] hover:text-[#2E2E5C] underline transition-colors"
          >
            キャンセル (マイ図鑑に戻る)
          </button>
        </div>
      </div>
    </div>
  );
}
