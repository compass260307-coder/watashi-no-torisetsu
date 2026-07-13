"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { questions } from "@/lib/questions";
import { diagnose } from "@/lib/diagnosis";
import { track, isPreviewMode } from "@/lib/track";
import { readAcquisition } from "@/lib/acquisition";
import type { AnswerValue } from "@/lib/types";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { DiagnosisProgressBar } from "@/components/diagnosis/DiagnosisProgressBar";
import { DiagnosisHero } from "@/components/diagnosis/DiagnosisHero";
import { QuestionCard } from "@/components/diagnosis/QuestionCard";
import { InAppBrowserModal } from "@/components/InAppBrowserModal";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";

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
  return <DiagnosisContent />;
}

function DiagnosisContent() {
  const router = useRouter();
  const [campaign, setCampaign] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  // ニックネームは独立ステップを廃止し、最初の質問ページ (page 0) の先頭で取得する。
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  // page 0 を抜ける際に未入力なら、この入力欄へスクロール/フォーカスするための参照。
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(0); // 0-indexed (0..4)
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
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
    // useSearchParams による静的ページ全体のクライアント描画化を避けるため、
    // 計測用クエリだけをマウント後に取得する。回答完了時の API 送信値は従来と同じ。
    const params = new URLSearchParams(window.location.search);
    const campaignParam = params.get("campaign");
    const sourceParam = params.get("source");
    setCampaign(campaignParam);
    setSource(sourceParam);

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
    if (sourceParam === "line") {
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
  }, []);
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
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentPage, hydrated]);

  // 起動 track。ref だけだと再マウント (ページ再訪・再診断モーダル表示等) のたびに
  // 発火して分母が膨らむため、セッション (タブ) 単位で1回に dedup する (2026-07-13)。
  useEffect(() => {
    if (trackedStart.current) return;
    trackedStart.current = true;
    try {
      if (sessionStorage.getItem("torisetsu_diag_started") === "1") return;
      sessionStorage.setItem("torisetsu_diag_started", "1");
    } catch {
      // sessionStorage 不可でも計測は続行 (dedup なし)
    }
    track("diagnosis_started");
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
  // ニックネームは必須。page 0 の「次へ」は全問回答 + ニックネーム入力で活性化。
  const hasNickname = nickname.trim().length > 0;
  const canAdvance =
    isPageComplete && (currentPage !== 0 || hasNickname);

  // ニックネーム必須ゲート: page 0 (ニックネーム同居ページ) を抜ける前に呼ぶ。
  // 未入力/超過なら error を出し入力欄へスクロール&フォーカスして false を返す。
  // OK なら localStorage に保存して true を返す。
  const ensureNickname = (): boolean => {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      setNicknameError("ニックネームを入力してね");
      nicknameInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      nicknameInputRef.current?.focus({ preventScroll: true });
      return false;
    }
    if (trimmed.length > NICKNAME_MAX) {
      setNicknameError(`${NICKNAME_MAX} 文字以内で入力してね`);
      return false;
    }
    setNicknameError(null);
    try {
      localStorage.setItem(NICKNAME_KEY, trimmed);
    } catch {
      // localStorage 不可でも進める
    }
    return true;
  };

  // #2 「続きから」: 保存した回答と進捗を復元し、質問ステップへ
  const handleResumeContinue = () => {
    if (!pendingResume) return;
    setAnswers(pendingResume.answers);
    setCurrentPage(pendingResume.page);
    setPendingResume(null);
    // 先頭へのスクロールは currentPage 変化を見る useEffect に集約。
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
    // 到達計測は「その質問に初めて答えたとき」のみ (2026-07-13)。
    // 同値の再タップ・選び直しでも発火すると diagQuestionReach が水増しされ、
    // 離脱ポイント分析 (到達曲線) が歪むため。
    const isFirstAnswer = answers[questionId] === undefined;
    setAnswers((prev) => {
      if (prev[questionId] === value) return prev;
      return { ...prev, [questionId]: value }; // 別の選択肢なら上書き (選び直し可)
    });
    if (isFirstAnswer) {
      track("diagnosis_question_answered", {
        metadata: { questionId },
      });
    }

    // ページ送りは自動ではなく、質問の下の「次へ」CTA で明示的に行う (handleNext)。
    // ここでは同一ページ内の「次の質問」へのオートスクロールだけを担う。

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
    if (currentPage === 0 && !ensureNickname()) return;
    setCurrentPage((p) => p + 1);
    // 先頭へのスクロールは currentPage 変化を見る useEffect に集約。
  };

  // 進捗バーの「前のページ」: 前ページへ戻す。page 0 (先頭) はトップへ抜ける。
  const handlePrev = () => {
    if (currentPage === 0) {
      router.push("/");
      return;
    }
    setCurrentPage((p) => Math.max(0, p - 1));
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
          // API側で診断結果を再計算し、typeId / scores の改ざんを防ぐための原回答。
          answers,
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
    router.push("/");
  };

  // Polish-D-A FINAL: 標準 CTA は components/StickyCtaFooter.tsx の
  //   ctaPrimary / ctaSecondary を import して使用する (ローカル定義は廃止)。
  //   disabled は CSS で opacity:50 + cursor-not-allowed のみ、形・枠は維持。

  // Phase 1.5-α Day 12-Polish-B: 基本情報ステップ (50 問の前にニックネームを取得)
  // 「最初の質問」として位置づける UX (ステップではなく Q0 相当)
  // 16P 方式: 前進は自動ページ送りが担い、「戻る」ボタンは置かない
  // (16P 同様、迷わず前へ進む一方通行の体験にする)。

  return (
    <>
    {/* サイト共通ヘッダー (16P 風スクロール連動) */}
    <ScrollHideHeader>
      <TopHeader />
    </ScrollHideHeader>
    <div
      className="flex flex-col flex-1 min-h-screen pb-12 bg-white"
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
      {/* page 0 の最上部にだけ 16P 風ヒーロー (マスコット + 見出し)。 */}
      {currentPage === 0 && (
        <DiagnosisHero
          title="無料性格診断テスト"
          subtitle="OCEANでわかる32タイプ"
        />
      )}
      {/* 最初のページ (page 0) には進捗バーを出さない (ヒーローに集中させる)。 */}
      {currentPage !== 0 && (
        <DiagnosisProgressBar
          currentQuestion={answeredCount}
          totalQuestions={TOTAL_QUESTIONS}
          onPrev={handlePrev}
        />
      )}

      <main className="flex flex-col flex-1 w-full pt-6 pb-4">
        {/* page 0 の先頭にニックネーム入力を同居させる (旧: 独立した basic-info ステップ)。
            Q1 の直前に置き、最初の画面で「ニックネーム + 最初の質問」を一緒に見せる。 */}
        {currentPage === 0 && (
          <div className="mb-8 mx-auto w-full max-w-[1080px] px-4 md:px-8">
            {/* ニックネーム入力は白カードで囲い、質問(区切り線のみ)と差別化する。
                カードはフッター幅 (max-w-[1080px]) に揃え、入力は中央で読みやすい幅に収める。 */}
            <div className="rounded-2xl border border-[#2E2E5C]/10 bg-white p-6 shadow-[0_2px_10px_rgba(42,58,92,0.08)]">
              <div className="mx-auto max-w-md">
                <label
                  htmlFor="diagnosis-nickname"
                  className="block text-center font-bold text-[#2E2E5C] leading-relaxed mb-4"
                  style={{ fontSize: "clamp(20px, 2.4vw, 26px)" }}
                >
                  ニックネームを教えて
                </label>
                <input
                  ref={nicknameInputRef}
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
              </div>
            </div>
          </div>
        )}
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

        {submitError && (
          <p className="text-center text-xs text-[#E86AA6] font-bold mt-2 mb-2">
            送信に失敗しました。もう一度お試しください。
          </p>
        )}

        {/* 質問の下の CTA: 押すと次ページへ (自動ページ送りは廃止)。
            ページ全問回答で活性化。page 0 はニックネーム必須。 */}
        <div className="mx-auto mt-10 flex w-full max-w-[1080px] flex-col items-center gap-2 px-4 md:px-8">
          {!isLastPage ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance}
              className={soraPrimary}
            >
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
          {/* page 0 で全問回答済みなのにニックネーム未入力なら、必須である旨を明示 */}
          {currentPage === 0 && isPageComplete && !hasNickname && (
            <p className="text-xs font-bold text-[#E86AA6]">
              ニックネームを入力してね
            </p>
          )}
        </div>
      </main>
    </div>
    {/* サイト共通フッター */}
    <TopFooter />
    </>
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
