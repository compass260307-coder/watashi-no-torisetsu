"use client";

// Phase 3-β B-2 + B-3: 友達評価 30 問 + choice 3 問 + 完成画面 (B-3 で本実装)。
// 旧 13 問形式の friend-questions / friend-perception は破壊せず並存。
// LIFF init はオプショナル: LINE 内で開かれていればプロフィール + id_token を取り、
// Web ブラウザ経由なら perceiver_name は「友達」固定 + 任意入力で上書き可能。

import { Suspense, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { track } from "@/lib/track";
import {
  FRIEND_QUESTIONS_V2_PAGE_1,
  FRIEND_QUESTIONS_V2_PAGE_2,
  FRIEND_QUESTIONS_V2_PAGE_3,
  FRIEND_QUESTIONS_V2_TOTAL,
  FRIEND_CHOICE_QUESTIONS_V2,
  renderQuestionText,
  type FriendQuestionV2,
  type FriendChoiceQuestionV2,
} from "@/lib/friend-questions-v2";
import { LikertScale } from "@/components/diagnosis/LikertScale";
import { TorisetsuCard } from "@/components/torisetsu/TorisetsuCard";
import { DimensionPolarityBar } from "@/components/torisetsu/DimensionPolarityBar";
import { FacetBarChart } from "@/components/torisetsu/FacetBarChart";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type {
  AnswerValue,
  BigFiveDimension,
  FacetId,
  TorisetsuTypeId,
} from "@/lib/types";

// =========================================================================
// 状態管理 (進行ステート)
// =========================================================================
type Phase =
  | "intro" // 開始前画面
  | "scale" // 30 問 (3 ページに分割)
  | "choice" // おまけ 3 問
  | "submitting" // API 送信中
  | "complete" // B-3 完成画面
  | "error"; // 送信失敗

// B-2 段階では完成画面は最小限の stub (B-3 で本実装に置換)
type CompletePerception = {
  typeId: string;
  cModifier: "C" | "F";
  nModifier: "N" | "R";
  fullCode: string;
  modifierLabel: string;
  modifierParagraph: string;
  scores: Record<BigFiveDimension, number>;
  facetScores: Record<FacetId, number>;
  confidence: "low" | "medium" | "high";
  qualitativeData: Record<string, string> | null;
};

const SCALE_PAGES: FriendQuestionV2[][] = [
  FRIEND_QUESTIONS_V2_PAGE_1,
  FRIEND_QUESTIONS_V2_PAGE_2,
  FRIEND_QUESTIONS_V2_PAGE_3,
];

export default function FriendPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex flex-col flex-1 items-center justify-center">
          <p className="text-sm text-muted">読み込み中...</p>
        </div>
      }
    >
      <FriendContent inviteCode={inviteCode} />
    </Suspense>
  );
}

function FriendContent({ inviteCode }: { inviteCode: string }) {
  // ======== state ========
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [pageIdx, setPageIdx] = useState<0 | 1 | 2>(0); // scale ページ内 (0-2)
  const [choiceIdx, setChoiceIdx] = useState<0 | 1 | 2>(0); // choice ページ内 (0-2)
  const [scaleAnswers, setScaleAnswers] = useState<Record<number, AnswerValue>>({});
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, string>>({});
  const [perceiverName, setPerceiverName] = useState<string>("友達");
  const [lineIdToken, setLineIdToken] = useState<string | null>(null);
  const [perception, setPerception] = useState<CompletePerception | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const trackedLanding = useRef(false);
  const liffInitialized = useRef(false);

  // ======== 初期化: invite_code から owner 取得 ========
  useEffect(() => {
    if (!trackedLanding.current) {
      trackedLanding.current = true;
      track("friend_landing_viewed", { inviteCode });
    }
    fetch(`/api/friend-info?code=${inviteCode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.displayName) setOwnerName(data.displayName);
      })
      .catch(() => {});
  }, [inviteCode]);

  // ======== LIFF init (オプショナル) ========
  useEffect(() => {
    if (liffInitialized.current) return;
    liffInitialized.current = true;

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return; // LIFF 設定なし → スキップ

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          // LIFF 内だがログインしていない → 強制ログインはしない (Web 経由のケースを壊さない)
          return;
        }
        const profile = await liff.getProfile().catch(() => null);
        if (profile?.displayName) {
          setPerceiverName(profile.displayName);
        }
        const idToken = liff.getIDToken();
        if (idToken) setLineIdToken(idToken);
      } catch {
        // LIFF init 失敗 (Web ブラウザ等) → フォールバックのまま続行
      }
    })();
  }, []);

  const ownerLabel = ownerName ?? "友達";
  const subjectLabel = ownerName ? `${ownerName}さん` : "友達";

  // ======== ハンドラ ========
  const startEvaluation = () => {
    setPhase("scale");
    setPageIdx(0);
    track("friend_v2_started", { inviteCode });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScaleAnswer = (questionId: number, value: AnswerValue) => {
    setScaleAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const currentScalePage = SCALE_PAGES[pageIdx];
  const isCurrentScalePageComplete = currentScalePage.every(
    (q) => scaleAnswers[q.id] !== undefined,
  );
  const answeredScaleCount = Object.keys(scaleAnswers).length;

  const handleScaleNext = () => {
    if (!isCurrentScalePageComplete) return;
    if (pageIdx < 2) {
      setPageIdx((p) => (p + 1) as 0 | 1 | 2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // 全 30 問完了 → choice フェーズへ
      setPhase("choice");
      setChoiceIdx(0);
      track("friend_v2_scale_completed", { inviteCode });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleScalePrev = () => {
    if (pageIdx > 0) {
      setPageIdx((p) => (p - 1) as 0 | 1 | 2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleChoiceAnswer = (choiceId: string, option: string) => {
    setChoiceAnswers((prev) => ({ ...prev, [choiceId]: option }));
    advanceChoice();
  };

  const handleChoiceSkip = () => {
    advanceChoice();
  };

  const advanceChoice = () => {
    if (choiceIdx < 2) {
      setChoiceIdx((c) => (c + 1) as 0 | 1 | 2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      submit();
    }
  };

  const submit = async () => {
    setPhase("submitting");
    setSubmitError(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (lineIdToken) {
        headers["Authorization"] = `Bearer ${lineIdToken}`;
      }
      const res = await fetch("/api/friend-answer/v2", {
        method: "POST",
        headers,
        body: JSON.stringify({
          inviteCode,
          scaleAnswers,
          choiceAnswers,
          perceiverName,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setSubmitError(data?.error ?? `HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      setPerception(data.perception as CompletePerception);
      setPhase("complete");
      track("friend_v2_completed", {
        inviteCode,
        metadata: {
          perceivedTypeId: data.perception?.typeId,
          perceivedFullCode: data.perception?.fullCode,
          confidence: data.perception?.confidence,
        },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  };

  // ======== 画面分岐 ========
  if (phase === "intro") {
    return (
      <IntroScreen
        ownerLabel={ownerLabel}
        subjectLabel={subjectLabel}
        perceiverName={perceiverName}
        onPerceiverNameChange={setPerceiverName}
        onStart={startEvaluation}
      />
    );
  }

  if (phase === "scale") {
    return (
      <ScaleScreen
        page={pageIdx}
        questions={currentScalePage}
        subjectLabel={subjectLabel}
        scaleAnswers={scaleAnswers}
        answeredCount={answeredScaleCount}
        onAnswer={handleScaleAnswer}
        onNext={handleScaleNext}
        onPrev={handleScalePrev}
        isPageComplete={isCurrentScalePageComplete}
      />
    );
  }

  if (phase === "choice") {
    const q = FRIEND_CHOICE_QUESTIONS_V2[choiceIdx];
    return (
      <ChoiceScreen
        question={q}
        subjectLabel={subjectLabel}
        choiceIdx={choiceIdx}
        onSelect={handleChoiceAnswer}
        onSkip={handleChoiceSkip}
      />
    );
  }

  if (phase === "submitting") {
    return <SubmittingScreen subjectLabel={subjectLabel} />;
  }

  if (phase === "error") {
    return (
      <ErrorScreen
        message={submitError ?? "送信に失敗しました"}
        onRetry={submit}
      />
    );
  }

  // phase === "complete"
  return (
    <CompleteScreen
      subjectLabel={subjectLabel}
      perception={perception}
      inviteCode={inviteCode}
    />
  );
}

// =========================================================================
// Intro 画面
// =========================================================================
function IntroScreen({
  ownerLabel,
  subjectLabel,
  perceiverName,
  onPerceiverNameChange,
  onStart,
}: {
  ownerLabel: string;
  subjectLabel: string;
  perceiverName: string;
  onPerceiverNameChange: (v: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col flex-1 items-center px-5 py-10 max-w-lg mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-6 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            WATASHI NO TORISETSU
          </p>
          <h1 className="text-2xl font-extrabold leading-tight mb-3">
            {ownerLabel}から
            <br />
            回答のお願いです
          </h1>
        </div>

        <div className="w-full flex flex-col items-center text-center mb-6 animate-fade-in-up stagger-2">
          <Image
            src="/mascot/step3-complete.png"
            alt=""
            width={224}
            height={224}
            priority
            className="w-48 sm:w-56 h-auto object-contain"
          />
        </div>

        <section className="w-full rounded-2xl bg-label-bg p-5 mb-6 animate-fade-in-up stagger-2">
          <p className="text-sm leading-relaxed text-center mb-2">
            「あなたから見た{subjectLabel}」を 30 問の質問で集めて、
            <br />
            {subjectLabel}専用のトリセツを作るサービスです。
          </p>
          <p className="text-xs text-muted text-center">
            約 4 分・登録不要
          </p>
        </section>

        <section className="w-full mb-6 animate-fade-in-up stagger-3">
          <label
            htmlFor="perceiver-name"
            className="block text-xs font-bold text-muted mb-2"
          >
            あなたの名前 ({subjectLabel}に表示されます)
          </label>
          <input
            id="perceiver-name"
            type="text"
            value={perceiverName}
            onChange={(e) => onPerceiverNameChange(e.target.value)}
            maxLength={20}
            className="w-full rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="友達"
          />
          <p className="text-[11px] text-muted mt-1">
            空のままでも OK (「友達」と表示)
          </p>
        </section>

        <button
          type="button"
          onClick={onStart}
          className="w-full max-w-xs rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          回答をはじめる →
        </button>
      </main>
    </div>
  );
}

// =========================================================================
// Scale 画面 (30 問 × 3 ページ)
// =========================================================================
function ScaleScreen({
  page,
  questions,
  subjectLabel,
  scaleAnswers,
  answeredCount,
  onAnswer,
  onNext,
  onPrev,
  isPageComplete,
}: {
  page: 0 | 1 | 2;
  questions: FriendQuestionV2[];
  subjectLabel: string;
  scaleAnswers: Record<number, AnswerValue>;
  answeredCount: number;
  onAnswer: (qId: number, v: AnswerValue) => void;
  onNext: () => void;
  onPrev: () => void;
  isPageComplete: boolean;
}) {
  const isLastPage = page === 2;
  const percent = Math.round((answeredCount / FRIEND_QUESTIONS_V2_TOTAL) * 100);

  return (
    <div className="flex flex-col flex-1 min-h-screen pb-28">
      {/* sticky progress */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-card-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex justify-between text-xs font-bold text-muted mb-2">
            <span>
              質問 {answeredCount} / {FRIEND_QUESTIONS_V2_TOTAL}
            </span>
            <span>Page {page + 1} / 3</span>
          </div>
          <div className="w-full h-1.5 bg-card-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-gradient transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <main className="flex flex-col flex-1 px-4 pt-6 pb-4 max-w-lg mx-auto w-full">
        {questions.map((q) => (
          <div
            key={q.id}
            className="w-full bg-card-bg rounded-2xl border border-card-border shadow-sm p-5 sm:p-6 mb-4"
          >
            <div className="inline-block rounded-md bg-label-bg px-2.5 py-1 text-[11px] font-bold text-primary border border-card-border mb-3">
              Q{q.id}
            </div>
            <p className="text-base sm:text-lg font-bold text-foreground leading-relaxed mb-6">
              {renderQuestionText(q.text, subjectLabel.replace(/さん$/, ""))}
            </p>
            <LikertScale
              value={scaleAnswers[q.id]}
              onChange={(v) => onAnswer(q.id, v)}
            />
          </div>
        ))}

        {!isPageComplete && (
          <p className="text-center text-xs text-muted mt-2 mb-4">
            このページの 10 問すべてに答えると、次へ進めます
          </p>
        )}
      </main>

      {/* 下部固定ナビ */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-card-border z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex gap-3 items-center">
          <button
            type="button"
            onClick={onPrev}
            disabled={page === 0}
            className={`rounded-full border-2 border-card-border px-5 py-3 text-sm font-bold transition-all ${
              page === 0
                ? "opacity-0 pointer-events-none"
                : "text-muted hover:bg-label-bg"
            }`}
          >
            戻る
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!isPageComplete}
            className={`flex-1 rounded-full px-6 py-3 text-sm font-bold text-white transition-all ${
              isPageComplete
                ? "bg-primary-gradient hover:scale-[1.02] active:scale-[0.98]"
                : "bg-card-border text-muted cursor-not-allowed"
            }`}
          >
            {isLastPage ? "おまけの質問へ →" : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Choice 画面 (おまけ 3 問、各スキップ可)
// =========================================================================
function ChoiceScreen({
  question,
  subjectLabel,
  choiceIdx,
  onSelect,
  onSkip,
}: {
  question: FriendChoiceQuestionV2;
  subjectLabel: string;
  choiceIdx: 0 | 1 | 2;
  onSelect: (id: string, option: string) => void;
  onSkip: () => void;
}) {
  const inviteeName = subjectLabel.replace(/さん$/, "");
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-card-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between text-xs font-bold text-muted">
          <span>おまけ {choiceIdx + 1} / 3</span>
          <span>スキップ可</span>
        </div>
      </div>

      <main className="flex flex-col flex-1 items-center px-5 pt-8 pb-10 max-w-lg mx-auto w-full">
        <div className="inline-block rounded-md bg-label-bg px-2.5 py-1 text-[11px] font-bold text-primary border border-card-border mb-3">
          おまけ
        </div>
        <h2 className="text-lg font-bold text-center mb-6 leading-relaxed">
          {renderQuestionText(question.text, inviteeName)}
        </h2>

        <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(question.id, opt)}
              className="w-full rounded-xl border-2 border-card-border bg-card-bg px-5 py-4 text-sm font-medium transition-all hover:border-primary/40 active:scale-[0.98]"
            >
              {opt}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-muted hover:text-foreground underline transition-colors"
        >
          この質問はスキップ
        </button>
      </main>
    </div>
  );
}

// =========================================================================
// Submitting 画面
// =========================================================================
function SubmittingScreen({ subjectLabel }: { subjectLabel: string }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
      <Image
        src="/mascot/analyzing-penguin.png"
        alt=""
        width={160}
        height={160}
        className="w-32 h-32 object-contain animate-bounce-slow mb-4"
      />
      <p className="text-lg font-bold text-foreground mb-2">
        あなたから見た{subjectLabel}を
        <br />
        生成中...
      </p>
      <p className="text-xs text-muted">少し待ってね 🐧</p>
    </div>
  );
}

// =========================================================================
// Error 画面
// =========================================================================
function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
      <p className="text-base font-bold text-foreground mb-4">
        送信に失敗しました
      </p>
      <p className="text-xs text-muted mb-6">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white"
      >
        もう一度送信する
      </button>
    </div>
  );
}

// =========================================================================
// Complete 画面 (B-3 本実装)
// =========================================================================
function CompleteScreen({
  subjectLabel,
  perception,
  inviteCode,
}: {
  subjectLabel: string;
  perception: CompletePerception | null;
  inviteCode: string;
}) {
  if (!perception) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
        <p className="text-sm text-muted">結果の表示で問題が発生しました</p>
        <Link
          href="/"
          className="mt-6 text-xs text-muted underline hover:text-foreground"
        >
          トップに戻る
        </Link>
      </div>
    );
  }

  const typeData = torisetsuTypes[perception.typeId as TorisetsuTypeId];
  const hasQualitative =
    perception.qualitativeData &&
    Object.keys(perception.qualitativeData).length > 0;

  const handleShareToLine = async () => {
    // LIFF 内なら shareTargetPicker、それ以外なら現 URL をコピー
    try {
      const liff = (await import("@line/liff")).default;
      if (liff.isInClient && liff.isInClient()) {
        const shareText = [
          "🎴 ワタシのトリセツ",
          "",
          "あなたから見た私のトリセツを教えて。",
          "30 問・約 4 分で完成するよ。",
          "",
          window.location.href,
        ].join("\n");
        await liff.shareTargetPicker([{ type: "text", text: shareText }]);
        return;
      }
    } catch {
      // LIFF 不可 → クリップボードコピー
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("招待 URL をコピーしました");
    } catch {
      alert("コピーに失敗しました");
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col items-center px-5 py-8 max-w-lg mx-auto w-full">
        {/* ヘッダー */}
        <div className="text-center mb-5 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            COMPLETED
          </p>
          <h1 className="text-2xl font-extrabold leading-tight">
            ✨ あなたから見た
            <br />
            {subjectLabel}は...
          </h1>
        </div>

        {/* TorisetsuCard + タイプ情報 */}
        <section className="w-full flex flex-col items-center mb-6 animate-fade-in-up stagger-2">
          <TorisetsuCard
            fullCode={perception.fullCode}
            size="md"
            alt={`${typeData?.name ?? perception.typeId} - ${perception.modifierLabel}`}
            priority
          />
          {typeData && (
            <h2
              className="text-xl font-extrabold mt-4 text-center"
              style={{ color: typeData.color }}
            >
              {typeData.name}
            </h2>
          )}
          <div
            className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-wider"
            style={{
              borderColor: (typeData?.color ?? "#888") + "60",
              color: typeData?.color ?? "#888",
              backgroundColor: (typeData?.color ?? "#888") + "10",
            }}
          >
            <span>{perception.fullCode}</span>
            <span className="opacity-40">·</span>
            <span>{perception.modifierLabel}</span>
          </div>
        </section>

        {/* 5 軸プロファイル */}
        <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-4">
            あなたから見た 5 軸プロファイル
          </p>
          <div className="flex flex-col gap-5">
            {(["E", "A", "O", "C", "N"] as BigFiveDimension[]).map((dim) => (
              <DimensionPolarityBar
                key={dim}
                dimension={dim}
                score={perception.scores[dim]}
              />
            ))}
          </div>
        </section>

        {/* 10 ファセット */}
        <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-4">
            10 ファセット詳細
          </p>
          <FacetBarChart facetScores={perception.facetScores} variant="self" />
        </section>

        {/* モディファイア文章 */}
        <section
          className="w-full rounded-2xl p-5 sm:p-6 border mb-5"
          style={
            typeData
              ? {
                  borderColor: `${typeData.color}40`,
                  background: `linear-gradient(to bottom, #ffffff, ${typeData.color}10)`,
                }
              : undefined
          }
        >
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            あなたから見た{subjectLabel}
          </p>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
            {perception.modifierParagraph}
          </p>
        </section>

        {/* おまけの回答 */}
        {hasQualitative && perception.qualitativeData && (
          <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
            <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
              おまけで答えてくれた
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {perception.qualitativeData.favorite_point && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted text-xs">好きなところ</span>
                  <span className="font-bold text-right">
                    {perception.qualitativeData.favorite_point}
                  </span>
                </li>
              )}
              {perception.qualitativeData.animal && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted text-xs">動物に例えると</span>
                  <span className="font-bold text-right">
                    {perception.qualitativeData.animal}
                  </span>
                </li>
              )}
              {perception.qualitativeData.impression_scene && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted text-xs">印象的なシーン</span>
                  <span className="font-bold text-right">
                    {perception.qualitativeData.impression_scene}
                  </span>
                </li>
              )}
            </ul>
          </section>
        )}

        {/* 「届きました」メッセージ */}
        <section className="w-full rounded-2xl bg-label-bg p-5 mb-6 text-center">
          <p className="text-base font-bold mb-1">
            💌 {subjectLabel}に、あなたの眼が届きました
          </p>
          <p className="text-[11px] text-muted leading-relaxed">
            {subjectLabel}のトリセツ図鑑に、
            <br />
            「あなたから見た{subjectLabel}」が追加されます
          </p>
        </section>

        {/* CTA × 2 */}
        <div className="w-full flex flex-col gap-3 mb-6">
          <Link
            href={`/diagnosis?source=${inviteCode}`}
            className="w-full rounded-full bg-primary-gradient px-6 py-4 text-center text-base font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            💡 自分のトリセツも作ってみる
          </Link>
          <button
            type="button"
            onClick={handleShareToLine}
            className="w-full rounded-full border-2 border-primary px-6 py-4 text-base font-bold text-primary transition-all hover:bg-label-bg active:scale-[0.98]"
          >
            📤 LINE でシェア
          </button>
        </div>

        <Link
          href="/"
          className="text-xs text-muted/70 underline hover:text-foreground transition-colors"
        >
          トップに戻る
        </Link>
      </main>
    </div>
  );
}
