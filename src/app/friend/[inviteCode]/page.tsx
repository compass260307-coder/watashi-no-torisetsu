"use client";

import { use, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { friendQuestions, friendAnswerOptions } from "@/lib/friend-questions";
import { track, isPreviewMode } from "@/lib/track";
import { perceiveFromFriendAnswers } from "@/lib/friend-perception";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { StepCard } from "@/components/StepCard";
import { SampleReportModal } from "@/components/SampleReportModal";
import { OwnerTorisetuModal } from "@/components/OwnerTorisetuModal";
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
  const [isOwnerTorisetuModalOpen, setIsOwnerTorisetuModalOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, FriendAnswer>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
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
    // hasName 時は "○○さん"、未取得時は "友達" にすることで
    // 「○○さんから/に/の/はここ」「友達から/に/の/はここ」が自然になる
    const ownerLabel = hasName ? `${ownerName}さん` : "友達";

    return (
      <div className="flex flex-col flex-1">
        <main className="flex flex-col flex-1 items-center px-5 py-10 max-w-lg mx-auto w-full">
          {/* 1. ヘッダー */}
          <div className="flex flex-col items-center text-center mb-6 animate-fade-in-up">
            <h1 className="text-3xl font-extrabold leading-tight mb-2">
              ワタシのトリセツ
            </h1>
            <p className="text-base font-bold text-foreground">
              {ownerLabel}から回答のお願いです
            </p>
          </div>

          {/* 2. ペアペンギン画像 */}
          <div className="w-full flex flex-col items-center text-center mb-6 animate-fade-in-up stagger-2">
            <Image
              src="/mascot/step3-complete.png"
              alt=""
              width={288}
              height={288}
              priority
              className="w-56 sm:w-64 h-auto object-contain"
            />
          </div>

          {/* 3. ワタシのトリセツとは？ (式ビジュアル版) */}
          <section className="w-full rounded-2xl bg-label-bg p-5 mb-6 animate-fade-in-up stagger-2">
            <h3 className="text-base font-bold mb-3 flex items-center justify-center">
              <span className="mr-2">📖</span>
              ワタシのトリセツとは？
            </h3>
            <div className="flex flex-col gap-3 mb-5">
              <p className="text-sm leading-relaxed">
                世界中の心理学研究で使われている
                <span className="font-bold bg-gradient-to-b from-transparent from-50% to-pink-200 to-50% px-0.5">
                  Big Five 理論
                </span>
                に基づく性格診断サービス。
              </p>
              <p className="text-sm leading-relaxed">
                従来の性格診断に
                <span className="font-bold bg-gradient-to-b from-transparent from-50% to-pink-200 to-50% px-0.5">
                  他己評価
                </span>
                を加えることで、より精度の高い分析を実現します。
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              {/* 自己評価ボックス: オーナーが答える */}
              <div className="w-full rounded-xl bg-card-bg px-4 py-3 text-center shadow-sm">
                <div className="text-[11px] text-muted mb-0.5">
                  {ownerLabel}が答える
                </div>
                <div className="text-base font-bold">自己評価</div>
              </div>

              {/* + 記号 */}
              <div className="text-2xl font-bold text-primary leading-none">
                ＋
              </div>

              {/* 他己評価ボックス: あなた(friend)が答える */}
              <div className="w-full rounded-xl bg-card-bg px-4 py-3 text-center shadow-sm">
                <div className="text-[11px] text-muted mb-0.5">
                  あなたが答える
                </div>
                <div className="text-base font-bold">他己評価</div>
              </div>

              {/* = 記号 */}
              <div className="text-2xl font-bold text-primary leading-none">
                ＝
              </div>

              {/* ワタシのトリセツ (ハイライト + クリックでサンプル表示) */}
              <button
                type="button"
                onClick={() => setIsSampleModalOpen(true)}
                className="w-full rounded-xl bg-primary-gradient px-4 py-4 text-center shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                aria-label="サンプルレポートを表示"
              >
                <div className="text-[11px] text-white/90 mb-0.5">
                  {ownerLabel}だけの
                </div>
                <div className="text-base font-bold text-white mb-1">
                  ワタシのトリセツ
                </div>
                <div className="text-[11px] text-white/85 flex items-center justify-center gap-1">
                  <span>👀</span>
                  <span>タップで例を見る</span>
                </div>
              </button>
            </div>
          </section>

          {/* 4. 今、{ownerLabel}はここ (3 STEP カード) */}
          <section className="w-full mb-6 animate-fade-in-up stagger-3">
            <h3 className="text-base font-bold text-center mb-4">
              今、{ownerLabel}はここ
            </h3>
            <div className="flex flex-col gap-4">
              <StepCard
                stepNumber={1}
                imageSrc="/mascot/step1-receive.png"
                title={`${ownerLabel}が自己診断`}
                variant="completed"
              />
              <StepCard
                stepNumber={2}
                imageSrc="/mascot/step2-ask-friend.png"
                title={`あなたが${ownerLabel}の印象を答える`}
                variant="current"
              />
              <StepCard
                stepNumber={3}
                imageSrc="/mascot/step3-complete.png"
                title={`${ownerLabel}のトリセツ完成`}
                variant="future"
              />
            </div>
          </section>

          {/* 5. 呼びかけ */}
          <section className="w-full text-center mb-4 animate-fade-in-up stagger-3">
            <p className="text-base font-bold leading-relaxed">
              あなたから見た{ownerLabel}を、
              <br />
              教えてくれませんか？
            </p>
          </section>

          {/* 6. CTA */}
          <div className="my-4 flex justify-center w-full animate-fade-in-up stagger-4">
            <button
              onClick={() => {
                setStarted(true);
                track("friend_answer_started", { inviteCode });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-gradient px-10 py-5 text-lg font-bold text-white shadow-xl shadow-primary/40 transition-transform duration-200 hover:scale-105 active:scale-95 break-keep"
            >
              回答を始める
              <span className="text-xl leading-none">→</span>
            </button>
          </div>
          <p className="text-[11px] text-muted mt-2 animate-fade-in stagger-4">
            正解はありません。回答は完全匿名で届きます
          </p>
        </main>
        <SampleReportModal
          isOpen={isSampleModalOpen}
          onClose={() => setIsSampleModalOpen(false)}
        />
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
              {/* Section 1: お礼 (コンパクト) */}
              <div className="text-center mb-6 animate-fade-in-up stagger-1">
                <p className="text-2xl font-extrabold mb-1">
                  ありがとう！🐧
                </p>
                <p className="text-base">
                  {hasName ? `${ownerName}さんに届きました` : "友達に届きました"}
                </p>
              </div>

              {/* Section 2-3: 統合カード (更新通知 + type 表示 + のぞきCTA) */}
              {perceivedType && perception && (
                <div className="w-full mx-auto max-w-md rounded-2xl bg-white shadow-md overflow-hidden mb-6 animate-fade-in-up stagger-3">
                  {/* Top: 更新通知バー */}
                  <div className="bg-pink-100 px-4 py-3 text-center">
                    <p className="text-sm font-bold text-pink-700">
                      {hasName
                        ? `${ownerName}さんに、あなたの印象が届きました`
                        : "友達に、あなたの印象が届きました"}
                    </p>
                  </div>

                  {/* Middle: あなたから見た印象 + キャラ + タイプ */}
                  <div className="p-6 text-center">
                    <p className="text-xs text-muted mb-3">
                      {hasName
                        ? `あなたから見た${ownerName}さんは…`
                        : "あなたから見た友達の印象は…"}
                    </p>
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
                    <p className="text-xs text-muted">
                      {perceivedType.subtitle}
                    </p>
                  </div>

                  {/* Bottom: full-width tap バー (perception ベース表示) */}
                  <button
                    type="button"
                    onClick={() => setIsOwnerTorisetuModalOpen(true)}
                    className="w-full border-t border-pink-100 bg-white hover:bg-pink-50 active:bg-pink-100 px-6 py-4 text-base font-bold text-pink-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>
                      {hasName
                        ? `あなたから見た${ownerName}さんを見てみる`
                        : "あなたから見た友達を見てみる"}
                    </span>
                    <span className="text-lg leading-none">→</span>
                  </button>
                </div>
              )}

              {/* Section 4: 「じゃあ、あなたも作ってみよう」見出し */}
              <div className="w-full text-center mt-2 mb-5 animate-fade-in-up stagger-4">
                <p className="text-xl font-extrabold leading-relaxed">
                  じゃあ、あなたも
                  <br />
                  作ってみよう
                </p>
              </div>

              {/* Section 5: 3 STEP カード */}
              <section className="w-full mb-6 animate-fade-in-up stagger-4">
                <div className="flex flex-col gap-4">
                  <StepCard
                    stepNumber={1}
                    imageSrc="/mascot/step1-receive.png"
                    title={<>15問に答えて<br />仮トリセツが届く</>}
                    variant="future"
                  />
                  <StepCard
                    stepNumber={2}
                    imageSrc="/mascot/step2-ask-friend.png"
                    title="友達に診断してもらう"
                    variant="future"
                  />
                  <StepCard
                    stepNumber={3}
                    imageSrc="/mascot/step3-complete.png"
                    title="トリセツが完成"
                    variant="future"
                  />
                </div>
              </section>

              {/* Section 6: メインCTA (強化版) */}
              <div className="w-full flex justify-center mb-2 animate-fade-in-up stagger-4">
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
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-gradient px-10 py-5 text-lg font-bold text-white shadow-xl shadow-primary/40 transition-transform duration-200 hover:scale-105 active:scale-95 break-keep"
                >
                  <span>あなたのトリセツを作る</span>
                  <span className="text-xl leading-none">→</span>
                </Link>
              </div>
              <p className="text-[11px] text-muted text-center mb-6">
                3分・登録不要・完全匿名
              </p>

              {/* Section 7: トップに戻る (控えめ) */}
              <Link
                href="/"
                className="text-xs text-muted/70 underline hover:text-foreground transition-colors"
              >
                トップに戻る
              </Link>
            </>
          )}
        </main>
        {perception && (
          <OwnerTorisetuModal
            isOpen={isOwnerTorisetuModalOpen}
            onClose={() => setIsOwnerTorisetuModalOpen(false)}
            perceivedTypeId={perception.typeId}
            ownerName={ownerName}
            ctaHref={diagnosisHref}
            fullCode={perception.fullCode}
            cModifier={perception.cModifier}
            nModifier={perception.nModifier}
            modifierLabel={perception.modifierLabel}
            facetScores={perception.facetScores}
          />
        )}
      </div>
    );
  }

  // --- Question screen ---
  // 「この人」を {name}さん or 「この友達」に置換
  const questionSubject = hasName ? `${ownerName}さん` : "この友達";
  const questionText = currentQuestion.text.replace(/この人/g, questionSubject);

  // 全質問で統一する回答ボタンのクラス。選択時はピンク濃 + 太borderで強調
  const answerButtonClass = (isSelected: boolean) =>
    `w-full rounded-xl px-4 py-4 text-base font-bold text-gray-800 transition-all hover:scale-[1.02] active:scale-[0.98] ${
      isSelected
        ? "bg-pink-100 border-2 border-pink-400 shadow-md"
        : "bg-pink-50 border border-pink-100 shadow-sm"
    }`;

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
            <span className="text-sm font-bold text-foreground">
              {currentIndex + 1} / {totalQuestions}
            </span>
            {remaining > 0 && (
              <span className="text-xs font-bold text-primary">
                あと{remaining}問
              </span>
            )}
          </div>
          <div className="w-12" />
        </div>

        {/* Progress bar (強化版) */}
        <div className="h-2 bg-primary/15">
          <div
            className="h-full bg-primary-gradient transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Question */}
      <main className="flex flex-col flex-1 items-center px-5 pt-6 pb-4 max-w-lg mx-auto w-full">
        <div
          className={`flex flex-col items-center w-full transition-opacity duration-200 ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Question label */}
          <div className="inline-block rounded-md bg-label-bg px-3 py-1 text-xs font-bold text-primary mb-4 border border-card-border">
            Q{currentIndex + 1}
          </div>

          {/* Question text */}
          <h2 className="text-lg font-bold text-center leading-relaxed mb-6 px-2">
            {questionText}
          </h2>

          {/* Answer options */}
          <div className="flex flex-col gap-3 w-full max-w-sm">
            {currentQuestion.type === "scale"
              ? friendAnswerOptions.map((option) => {
                  const isSelected =
                    answers[currentQuestion.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleScaleAnswer(option.value)}
                      className={answerButtonClass(isSelected)}
                    >
                      {option.label}
                    </button>
                  );
                })
              : currentQuestion.choices?.map((choice) => {
                  const isSelected = answers[currentQuestion.id] === choice;
                  return (
                    <button
                      key={choice}
                      onClick={() => handleChoiceAnswer(choice)}
                      className={answerButtonClass(isSelected)}
                    >
                      {choice}
                    </button>
                  );
                })}
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
