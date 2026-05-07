"use client";

import { use, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { friendQuestions, friendAnswerOptions } from "@/lib/friend-questions";
import { track, isPreviewMode } from "@/lib/track";
import { perceiveFromFriendAnswers } from "@/lib/friend-perception";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type { AnswerValue } from "@/lib/types";

type FriendAnswer = AnswerValue | string;

const FRIEND_FOOTER_HINTS = [
  "パッと思い浮かんだ印象でOK",
  "正解はないよ、感覚で選んでね",
  "深く考えなくて大丈夫",
  "あなたの直感が一番正確",
  "いい感じ、その調子！",
  "友達だからこそわかることがある",
  "意外と本人は気づいてないかも",
  "あなたの視点が一番大事",
  "もう少しで終わるよ",
  "ラストスパート！",
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
  const perceptionTracked = useRef(false);

  useEffect(() => {
    track("friend_landing_viewed", { inviteCode });
    fetch(`/api/friend-info?code=${inviteCode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.displayName) setOwnerName(data.displayName);
      })
      .catch(() => {});
  }, [inviteCode]);

  const hasName = ownerName !== null && ownerName.trim().length > 0;

  const totalQuestions = friendQuestions.length;
  const currentQuestion = friendQuestions[currentIndex];
  const progress = completed
    ? 100
    : (currentIndex / totalQuestions) * 100;
  const remaining = totalQuestions - currentIndex;

  const submitAnswers = useCallback(
    async (finalAnswers: Record<number, FriendAnswer>) => {
      setSubmitting(true);
      if (isPreviewMode()) {
        track("friend_answer_completed", { inviteCode });
        setSubmitting(false);
        return;
      }
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

  const perception = completed ? perceiveFromFriendAnswers(answers) : null;
  const perceivedType = perception ? torisetsuTypes[perception.typeId] : null;
  const confidenceDots = perception
    ? perception.confidence === "high"
      ? "●●●"
      : perception.confidence === "medium"
        ? "●●○"
        : "●○○"
    : null;

  useEffect(() => {
    if (perception && !perceptionTracked.current) {
      perceptionTracked.current = true;
      track("friend_perception_shown", {
        inviteCode,
        metadata: {
          perceivedTypeId: perception.typeId,
          perceivedConfidence: perception.confidence,
        },
      });
    }
  }, [perception, inviteCode]);

  const diagnosisHref = perception
    ? `/diagnosis?source=${inviteCode}&perceived=${perception.typeId}`
    : `/diagnosis?source=${inviteCode}`;

  // --- Intro screen ---
  if (!started) {
    return (
      <div className="flex flex-col flex-1">
        <main className="flex flex-col flex-1 items-center px-5 py-10 max-w-lg mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8 animate-fade-in-up">
            <h1 className="text-3xl font-extrabold leading-tight mb-2">
              ワタシのトリセツ
            </h1>
            <p className="text-base font-bold text-foreground">
              {hasName
                ? `${ownerName}さんから回答のお願いです`
                : "友達から回答のお願いです"}
            </p>
          </div>

          {/* Hero block: image → emphasized copy */}
          <div className="w-full flex flex-col items-center text-center animate-fade-in-up stagger-2">
            <Image
              src="/mascot/step3-complete.png"
              alt=""
              width={288}
              height={288}
              priority
              className="w-64 sm:w-72 h-auto object-contain mb-6"
            />
            <p className="text-lg font-bold leading-relaxed mb-10">
              <span className="text-primary-gradient">あなただけが知る、</span>
              <br />
              {hasName
                ? `${ownerName}さんの素敵な部分を教えてください`
                : "あなたの友達の素敵な部分を教えてください"}
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={() => {
              setStarted(true);
              track("friend_answer_started", { inviteCode });
            }}
            className="w-full max-w-xs rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all active:scale-[0.98] animate-fade-in-up stagger-4"
          >
            {hasName ? `${ownerName}さんについて10問答える` : "10問答える"}
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
              {/* Section A: Thank you */}
              <h1 className="text-3xl font-extrabold text-center mb-2 animate-fade-in-up stagger-1">
                ありがとう！
              </h1>
              <p className="text-lg font-bold leading-snug text-center mb-2 animate-fade-in-up stagger-2">
                {hasName ? (
                  <>
                    <span className="inline-block">{ownerName}さんのトリセツに</span>
                    <span className="inline-block">追加されました</span>
                  </>
                ) : (
                  <span className="inline-block">トリセツに追加されました</span>
                )}
              </p>
              <p className="text-sm text-muted text-center mb-8 animate-fade-in stagger-3">
                回答は匿名で届きます
              </p>

              {/* Section B: Perception result */}
              {perceivedType && perception && (
                <div className="w-full rounded-2xl border border-card-border bg-card-bg overflow-hidden mb-6 animate-fade-in-up stagger-3">
                  <div className="bg-label-bg px-5 py-2.5 border-b border-card-border">
                    <p className="text-[10px] font-bold tracking-wider text-muted text-center">
                      {hasName
                        ? `あなたから見た${ownerName}さんは…`
                        : "あなたから見た友達の印象は…"}
                    </p>
                  </div>
                  <div className="p-5 text-center">
                    {perceivedType.imageUrl ? (
                      <div className="relative mx-auto mb-2 w-full max-w-[320px] aspect-square">
                        <Image
                          src={perceivedType.imageUrl}
                          alt={`${perceivedType.name}のキャラクター`}
                          width={320}
                          height={320}
                          className="relative z-10 w-full h-full object-contain"
                          priority
                        />
                        <div
                          aria-hidden="true"
                          className="absolute bottom-1 left-1/2 z-0 h-3 w-[55%] -translate-x-1/2 rounded-[50%] blur-md"
                          style={{ backgroundColor: "rgba(0, 0, 0, 0.12)" }}
                        />
                      </div>
                    ) : (
                      <div
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-3xl mb-3"
                        style={{ backgroundColor: `${perceivedType.color}15` }}
                      >
                        {perceivedType.emoji}
                      </div>
                    )}
                    <p
                      className="text-lg font-extrabold mb-1"
                      style={{ color: perceivedType.color }}
                    >
                      {perceivedType.name}
                    </p>
                    <p className="text-xs text-muted mb-3">
                      {perceivedType.subtitle}
                    </p>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-[10px] text-muted">確信度</span>
                      <span
                        className="text-xs tracking-wider"
                        style={{ color: perceivedType.color }}
                      >
                        {confidenceDots}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3-step: invite to make own torisetsu */}
              <div className="w-full mb-6 animate-fade-in-up stagger-4">
                <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-4 uppercase">
                  じゃあ、あなたも作ってみよう
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col items-center rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm">
                    <span className="inline-block rounded-full bg-primary-gradient px-3 py-1 text-[11px] font-bold text-white tracking-wider mb-3">
                      STEP 1
                    </span>
                    <div className="w-40 h-40 mb-3">
                      <Image
                        src="/mascot/step1-receive.png"
                        alt=""
                        width={192}
                        height={192}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h3 className="text-base font-bold text-center leading-snug mb-1">
                      15問に答えて
                      <br />
                      仮トリセツが届く
                    </h3>
                    <p className="text-xs text-muted text-center">
                      直感でOK・3分でできる
                    </p>
                  </div>

                  <div className="flex flex-col items-center rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm">
                    <span className="inline-block rounded-full bg-primary-gradient px-3 py-1 text-[11px] font-bold text-white tracking-wider mb-3">
                      STEP 2
                    </span>
                    <div className="w-40 h-40 mb-3">
                      <Image
                        src="/mascot/step2-ask-friend.png"
                        alt=""
                        width={192}
                        height={192}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h3 className="text-base font-bold text-center leading-snug mb-1">
                      友達に診断してもらう
                    </h3>
                    <p className="text-xs text-muted text-center">
                      友達は10問・2分で完了
                    </p>
                  </div>

                  <div className="flex flex-col items-center rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm">
                    <span className="inline-block rounded-full bg-primary-gradient px-3 py-1 text-[11px] font-bold text-white tracking-wider mb-3">
                      STEP 3
                    </span>
                    <div className="w-40 h-40 mb-3">
                      <Image
                        src="/mascot/step3-complete.png"
                        alt=""
                        width={192}
                        height={192}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h3 className="text-base font-bold text-center leading-snug mb-1">
                      トリセツが完成
                    </h3>
                    <p className="text-xs text-muted text-center">
                      友達3人で深掘りレポート解放
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="w-full flex flex-col items-center mb-6 animate-fade-in-up stagger-4">
                <Link
                  href={diagnosisHref}
                  onClick={() =>
                    track("friend_to_diagnosis_clicked", {
                      inviteCode,
                      metadata: perception
                        ? {
                            perceptionShown: true,
                            perceivedTypeId: perception.typeId,
                            perceivedConfidence: perception.confidence,
                          }
                        : { perceptionShown: false },
                    })
                  }
                  className="inline-block w-full max-w-xs rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all active:scale-[0.98] text-center"
                >
                  自分のトリセツを作る
                </Link>
                <p className="text-[11px] text-muted mt-3">
                  15問・3分・登録不要
                </p>
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
            className="h-full bg-primary transition-all duration-300 ease-out rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Context bar */}
      <div className="bg-label-bg border-b border-card-border px-5 py-2 text-center">
        <p className="text-[11px] text-muted">
          {hasName
            ? `${ownerName}さんについて回答中 ・ あなたの印象でOK`
            : "回答中 ・ あなたの印象でOK"}
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
