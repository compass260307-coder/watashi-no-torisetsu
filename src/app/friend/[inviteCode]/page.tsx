"use client";

// Phase 1.5-α Day 12-C3: /friend/[inviteCode] の Brand v2 + Koi 風リブランド
//
// スコープ:
//   - intro 画面: Koi キャラ風 (ステッカー + キャラ枠 + タイプ名 + コード + サブ特性 +
//     充実説明文 + フローティング CTA)
//   - scale 画面: Day 9 /diagnosis と同じ Brand v2 (lavender + sunYellow バー + 立体 CTA)
//   - choice / consent / submitting / error: 最低限の Brand v2 化
//   - complete 画面: 削除 → submit 成功時に router.push(/evaluate/result/{perceptionId})
//
// 触らない (Day 12-C3 スコープ外):
//   - 評価ロジック本体 (lib/friend-questions-v2 / FRIEND_QUESTIONS_V2_*)
//   - /api/friend-answer/v2 (Phase 3-β 完成済)
//   - friend_perceptions スキーマ
//   - LikertScale コンポーネント (Day 9 で Brand v2 化済、再利用)
//   - 既存 components/FloatingCTABar (LP 用、別物)

import { Suspense, use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { FriendFlowFloatingCta } from "@/components/friend/FriendFlowFloatingCta";
import type { AnswerValue } from "@/lib/types";

// =========================================================================
// 状態管理
// =========================================================================
// Phase 1.5-α Day 12-Polish-B: name overlay 追加
//   旧フロー: intro (名前入力) → scale → choice → consent → submitting
//   新フロー: intro (名前なし) → scale → choice → consent → name → submitting
//   name はモーダル overlay として表示し、入力後すぐ submit() を呼ぶ。
type Phase =
  | "intro"
  | "scale"
  | "choice"
  | "consent"
  | "name"
  | "submitting"
  | "error";

interface OwnerInfo {
  displayName: string | null;
  typeName: string | null;
  typeSubtitle: string | null;
  fullCode: string | null;
  modifierLabel: string | null;
}

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
        <div className="min-h-screen bg-[#E4E0F5] flex flex-col flex-1 items-center justify-center">
          <p className="text-sm font-bold text-[#3A2D6B]/70">読み込み中...</p>
        </div>
      }
    >
      <FriendContent inviteCode={inviteCode} />
    </Suspense>
  );
}

function FriendContent({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [owner, setOwner] = useState<OwnerInfo>({
    displayName: null,
    typeName: null,
    typeSubtitle: null,
    fullCode: null,
    modifierLabel: null,
  });
  const [phase, setPhase] = useState<Phase>("intro");
  const [pageIdx, setPageIdx] = useState<0 | 1 | 2>(0);
  const [choiceIdx, setChoiceIdx] = useState<0 | 1 | 2>(0);
  const [scaleAnswers, setScaleAnswers] = useState<Record<number, AnswerValue>>(
    {},
  );
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, string>>(
    {},
  );
  const [perceiverName, setPerceiverName] = useState<string>("友達");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pdfConsent, setPdfConsent] = useState<boolean>(false);
  const trackedLanding = useRef(false);

  // ===== 初期化: invite_code から owner 情報取得 =====
  useEffect(() => {
    if (!trackedLanding.current) {
      trackedLanding.current = true;
      track("friend_landing_viewed", { inviteCode });
    }
    fetch(`/api/friend-info?code=${inviteCode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setOwner({
          displayName: data.displayName ?? null,
          typeName: data.typeName ?? null,
          typeSubtitle: data.typeSubtitle ?? null,
          fullCode: data.fullCode ?? null,
          modifierLabel: data.modifierLabel ?? null,
        });
      })
      .catch(() => {});
  }, [inviteCode]);

  const ownerName = owner.displayName ?? "友達";
  const subjectLabel = owner.displayName
    ? `${owner.displayName}さん`
    : "友達";

  // ===== ハンドラ =====
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
      setPhase("consent");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const submit = async () => {
    setPhase("submitting");
    setSubmitError(null);
    try {
      const res = await fetch("/api/friend-answer/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          scaleAnswers,
          choiceAnswers,
          perceiverName,
          pdfConsent,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.friendPerceptionId) {
        setSubmitError(data?.error ?? `HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      track("friend_v2_completed", {
        inviteCode,
        metadata: {
          perceivedTypeId: data.perception?.typeId,
          perceivedFullCode: data.perception?.fullCode,
          confidence: data.perception?.confidence,
        },
      });
      // Day 12-C3: 完了画面を廃止、Day 12-C1 で実装した結果ページへ直接遷移
      router.push(`/evaluate/result/${data.friendPerceptionId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  };

  // ===== 画面分岐 =====
  if (phase === "intro") {
    return (
      <IntroScreen
        owner={owner}
        ownerName={ownerName}
        subjectLabel={subjectLabel}
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

  if (phase === "consent") {
    // Day 12-Polish-B: consent の「送信する」→ name overlay へ
    return (
      <ConsentScreen
        ownerName={ownerName}
        subjectLabel={subjectLabel}
        perceiverName={perceiverName}
        pdfConsent={pdfConsent}
        onConsentChange={setPdfConsent}
        onSubmit={() => {
          setPhase("name");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  if (phase === "name") {
    // Day 12-Polish-B: 30 問 + consent 完了直後の overlay で名前を取る
    return (
      <NameOverlay
        perceiverName={perceiverName}
        onPerceiverNameChange={setPerceiverName}
        onSubmit={submit}
      />
    );
  }

  if (phase === "submitting") {
    return <SubmittingScreen subjectLabel={subjectLabel} />;
  }

  // phase === "error"
  return (
    <ErrorScreen
      message={submitError ?? "送信に失敗しました"}
      onRetry={submit}
    />
  );
}

// =========================================================================
// Intro 画面 (Koi 風、A のキャラ + 充実説明 + フローティング CTA)
// Day 12-Polish-B: 名前入力フォームを撤去 (完了直後の name overlay に移動)
// =========================================================================
function IntroScreen({
  owner,
  ownerName,
  subjectLabel,
  onStart,
}: {
  owner: OwnerInfo;
  ownerName: string;
  subjectLabel: string;
  onStart: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4 pb-32">
      <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
        {/* ===== ヘッダー ===== */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/" aria-label="トップへ">
            <Image
              src="/logo.png"
              alt="ワタシのトリセツ"
              width={280}
              height={80}
              priority
              className="w-[120px] h-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]"
            />
          </Link>
          <HamburgerMenu />
        </div>

        {/* ===== ステッカー ===== */}
        <div className="flex justify-center mb-4">
          <div className="bg-[#FFE993] text-[#3A2D6B] font-black px-5 py-2 rounded-full border-2 border-[#3A2D6B] shadow-md -rotate-2 text-base">
            {ownerName}のトリセツ
          </div>
        </div>

        {/* ===== A のキャラ枠 (プレースホルダー、LP のマスコット流用) ===== */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-[280px] aspect-square rounded-3xl bg-gradient-to-b from-[#BCDEF8]/40 to-[#FFD6E0]/40 border-2 border-[#0094D8]/25 flex items-center justify-center overflow-hidden">
            {/* 32 タイプ分のキャラ画像が出来るまでは LP のマスコットを流用 */}
            <Image
              src="/mascot-pair.png"
              alt={owner.typeName ?? "ワタシのトリセツ"}
              width={300}
              height={300}
              priority
              className="w-full h-auto object-contain relative z-10"
            />
            {/* 装飾 (隅) */}
            <Image
              src="/decorations/heart-pink.png"
              alt=""
              width={48}
              height={48}
              aria-hidden="true"
              className="absolute top-3 right-3 w-12 h-12 opacity-70 -rotate-12 pointer-events-none"
            />
            <Image
              src="/decorations/flower-yellow.png"
              alt=""
              width={40}
              height={40}
              aria-hidden="true"
              className="absolute bottom-3 left-3 w-10 h-10 opacity-70 rotate-12 pointer-events-none"
            />
          </div>
        </div>

        {/* ===== タイプ名 + コードバッジ + サブ特性 ===== */}
        <div className="text-center mb-6">
          <p className="text-[#FE3C72] font-bold text-sm mb-1">
            アナタが評価するのは…
          </p>
          {owner.typeName ? (
            <>
              <h1 className="text-[#3A2D6B] font-black text-3xl mb-3 leading-tight drop-shadow-[0_2px_0_rgba(255,255,255,0.6)]">
                {owner.typeName}
              </h1>
              {owner.fullCode && (
                <span className="inline-block bg-[#3A2D6B] text-white font-black text-sm px-4 py-1 rounded-full tracking-[0.25em]">
                  {owner.fullCode}
                </span>
              )}
              {owner.modifierLabel && (
                <div className="flex justify-center mt-3">
                  <span className="bg-[#BCDEF8]/60 text-[#3A2D6B] font-bold text-sm px-4 py-1.5 rounded-full border border-[#0094D8]/30">
                    {owner.modifierLabel}
                  </span>
                </div>
              )}
            </>
          ) : (
            <h1 className="text-[#3A2D6B] font-black text-2xl mb-2 leading-tight">
              {subjectLabel}
            </h1>
          )}
        </div>

        {/* ===== キャラ説明 (充実版、Koi 参考) ===== */}
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-6">
          {owner.typeSubtitle && (
            <p className="text-[#3A2D6B] font-bold text-sm leading-relaxed mb-4">
              {owner.typeSubtitle}
            </p>
          )}
          <p className="text-[#3A2D6B]/85 text-sm leading-relaxed mb-3">
            {ownerName}が「自分はこういう人」と答えたのが、上のタイプ。
            周りからどう見られているかは、また少し違うかも。
          </p>
          <p className="text-[#3A2D6B]/85 text-sm leading-relaxed mb-3">
            アナタから見える{ownerName}を、30
            問の質問でアナタの目線で答えてください。
            考えすぎず、第一印象に近い感覚で大丈夫です。
          </p>
          <p className="text-[#3A2D6B]/85 text-sm leading-relaxed mb-4">
            アナタの回答は、{ownerName}にとって「友達からの眼差し」として
            届きます。日々の会話では伝わらない、{ownerName}
            の良いところを言葉にする時間です。
          </p>
          <div className="border-t border-dashed border-[#3A2D6B]/20 my-4" />
          <p className="text-[#3A2D6B] font-black text-sm leading-relaxed">
            アナタが{ownerName}のことをどう見ているか、答えてみよう。
            <br />
            {ownerName}の自己診断と比べることで、ふたりの
            <span className="text-[#FE3C72]">相互理解度</span>
            が見えてきます。
          </p>
        </div>

        {/* Day 12-Polish-B: 名前入力フォームは削除 (完了直後の name overlay に移動) */}
      </div>

      {/* ===== フローティング CTA ===== */}
      <FriendFlowFloatingCta onClick={onStart} label="相互理解度を測る" />
    </main>
  );
}

// =========================================================================
// Scale 画面 (Day 9 /diagnosis と統一: lavender + sunYellow + 立体 CTA)
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
  const inviteeName = subjectLabel.replace(/さん$/, "");

  const navCtaActive =
    "flex-1 rounded-full px-6 py-4 text-sm font-black bg-[#FFE993] text-[#3A2D6B] border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all duration-150";
  const navCtaDisabled =
    "flex-1 rounded-full px-6 py-4 text-sm font-black bg-[#FFE993]/40 text-[#3A2D6B]/40 border-2 border-[#3A2D6B]/20 cursor-not-allowed";

  return (
    <div className="flex flex-col flex-1 min-h-screen pb-28 bg-[#E4E0F5]">
      {/* sticky progress (Day 9 と同じ Brand v2 化済 ProgressBar 互換) */}
      <div className="sticky top-0 z-10 bg-[#E4E0F5]/95 backdrop-blur-sm border-b border-[#0094D8]/15">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex justify-between text-sm font-bold text-[#3A2D6B] mb-2">
            <span>
              質問 {answeredCount} / {FRIEND_QUESTIONS_V2_TOTAL}
            </span>
            <span>Page {page + 1} / 3</span>
          </div>
          <div
            className="w-full h-2 bg-white/60 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full bg-[#FFE993] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <main className="flex flex-col flex-1 px-4 pt-6 pb-4 max-w-lg mx-auto w-full">
        {questions.map((q) => (
          <div
            key={q.id}
            className="w-full bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-5"
          >
            <div className="inline-block rounded-full bg-[#3A2D6B] px-3 py-1 text-xs font-black text-white mb-3">
              Q{q.id}
            </div>
            <p className="text-base sm:text-lg font-bold text-[#3A2D6B] leading-relaxed mb-6">
              {renderQuestionText(q.text, inviteeName)}
            </p>
            <LikertScale
              value={scaleAnswers[q.id]}
              onChange={(v) => onAnswer(q.id, v)}
            />
          </div>
        ))}

        {!isPageComplete && (
          <p className="text-center text-xs text-[#3A2D6B]/70 font-bold mt-2 mb-4">
            このページの 10 問すべてに答えると、次へ進めるよ
          </p>
        )}
      </main>

      {/* 下部固定ナビ (Day 9 と同じ Brand v2) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-sm border-t border-[#E4E0F5] z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex gap-3 items-center">
          <button
            type="button"
            onClick={onPrev}
            disabled={page === 0}
            className={`rounded-full border-2 px-5 py-3 text-sm font-bold transition-all ${
              page === 0
                ? "opacity-0 pointer-events-none border-transparent"
                : "border-[#3A2D6B]/30 text-[#3A2D6B] hover:bg-[#E4E0F5]"
            }`}
          >
            戻る
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!isPageComplete}
            className={isPageComplete ? navCtaActive : navCtaDisabled}
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
    <div className="min-h-screen bg-[#E4E0F5] flex flex-col flex-1">
      {/* sticky header */}
      <div className="sticky top-0 z-10 bg-[#E4E0F5]/95 backdrop-blur-sm border-b border-[#0094D8]/15">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between text-xs font-bold text-[#3A2D6B]">
          <span>おまけ {choiceIdx + 1} / 3</span>
          <span>スキップ可</span>
        </div>
      </div>

      <main className="flex flex-col flex-1 items-center px-4 pt-8 pb-10 max-w-lg mx-auto w-full">
        <div className="inline-block rounded-full bg-[#3A2D6B] px-3 py-1 text-xs font-black text-white mb-4">
          おまけ
        </div>
        <h2 className="text-lg font-black text-[#3A2D6B] text-center mb-6 leading-relaxed">
          {renderQuestionText(question.text, inviteeName)}
        </h2>

        <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(question.id, opt)}
              className="w-full bg-white rounded-2xl border-2 border-[#0094D8]/30 px-5 py-4 text-sm font-bold text-[#3A2D6B] transition-all hover:bg-[#FFE993]/30 hover:border-[#3A2D6B] active:scale-[0.98]"
            >
              {opt}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[#3A2D6B]/60 hover:text-[#FE3C72] font-bold underline transition-colors"
        >
          この質問はスキップ
        </button>
      </main>
    </div>
  );
}

// =========================================================================
// Consent 画面 (PDF 利用同意)
// =========================================================================
function ConsentScreen({
  ownerName,
  subjectLabel,
  perceiverName,
  pdfConsent,
  onConsentChange,
  onSubmit,
}: {
  ownerName: string;
  subjectLabel: string;
  perceiverName: string;
  pdfConsent: boolean;
  onConsentChange: (value: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4 flex flex-col flex-1">
      <div className="max-w-[480px] mx-auto w-full">
        <header className="text-center mb-6">
          <p className="text-[10px] font-black tracking-[0.3em] text-[#FE3C72] mb-2">
            最後にひとつ
          </p>
          <h1 className="text-xl font-black text-[#3A2D6B] leading-snug">
            {ownerName}さんへの評価、
            <br />
            PDF 利用も許可しますか?
          </h1>
        </header>

        <section className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-5">
          <p className="text-sm text-[#3A2D6B] leading-relaxed mb-3">
            {ownerName}さんは将来、AI が統合した有料の
            「真のトリセツ PDF レポート」(¥500) を作るかもしれません。
          </p>
          <p className="text-sm text-[#3A2D6B] leading-relaxed mb-3">
            その PDF には、アナタの名前 (
            <span className="font-bold text-[#FE3C72]">{perceiverName}</span>
            ) と回答内容が、
            {subjectLabel}を見たひとつの視点として記載されます。
          </p>
          <p className="text-xs text-[#3A2D6B]/70 leading-relaxed">
            PDF は{ownerName}さんが第三者に共有する可能性があります。
          </p>
        </section>

        <section className="bg-[#FFE993]/30 rounded-3xl border-2 border-[#FFE993] shadow-md p-5 mb-5">
          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="checkbox"
              checked={pdfConsent}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[#3A2D6B] cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-[#3A2D6B] leading-relaxed font-bold">
              はい、PDF レポートに{perceiverName}の名前付きで載ること、
              PDF が第三者に共有される可能性に
              <span className="text-[#FE3C72]">同意します</span>。
            </span>
          </label>
        </section>

        <p className="text-xs text-[#3A2D6B]/70 leading-relaxed mb-6 font-bold">
          ※ チェックしない場合も評価は送信されます。{ownerName}さんは
          「アナタから見た{ownerName}さん」を Web 画面で閲覧できますが、
          PDF 化と AI 統合素材化はできなくなります。
        </p>

        <button
          type="button"
          onClick={onSubmit}
          className="w-full bg-[#FFE993] text-[#3A2D6B] font-black text-base px-8 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
        >
          {pdfConsent ? "同意して送信する" : "PDF 利用なしで送信する"}
        </button>

        <p className="mt-4 text-[10px] text-[#3A2D6B]/60 text-center font-bold">
          この設定は後から変更できません。
        </p>
      </div>
    </main>
  );
}

// =========================================================================
// Submitting 画面
// =========================================================================
function SubmittingScreen({ subjectLabel }: { subjectLabel: string }) {
  return (
    <div className="min-h-screen bg-[#E4E0F5] flex flex-col flex-1 items-center justify-center px-5 py-10">
      <Image
        src="/mascot-pair.png"
        alt=""
        width={200}
        height={200}
        aria-hidden="true"
        className="w-40 h-40 object-contain animate-bounce-slow mb-4"
      />
      <p className="text-lg font-black text-[#3A2D6B] text-center mb-2 leading-relaxed">
        アナタから見た{subjectLabel}を
        <br />
        生成中...
      </p>
      <p className="text-xs text-[#3A2D6B]/70 font-bold">少し待ってね</p>
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
    <div className="min-h-screen bg-[#E4E0F5] flex flex-col flex-1 items-center justify-center px-5 py-10">
      <p className="text-base font-black text-[#3A2D6B] mb-4">
        送信に失敗しました
      </p>
      <p className="text-xs text-[#3A2D6B]/70 font-bold mb-6 text-center">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-[#FFE993] text-[#3A2D6B] font-black text-base px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
      >
        もう一度送信する
      </button>
    </div>
  );
}

// =========================================================================
// Phase 1.5-α Day 12-Polish-B: NameOverlay (30 問 + consent 完了直後の名前入力)
// 「結果を見る前に、お名前を教えてください」
// 必須 (空文字スキップ不可)、入力後 submit() で /api/friend-answer/v2 + router.push
// =========================================================================
function NameOverlay({
  perceiverName,
  onPerceiverNameChange,
  onSubmit,
}: {
  perceiverName: string;
  onPerceiverNameChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const trimmed = perceiverName.trim();
  // 初期値 "友達" (state 初期値) は「未入力」と同等扱いで送信不可にする
  const isPlaceholder = trimmed === "" || trimmed === "友達";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="お名前の入力"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4 py-6 animate-modal-fade-in"
    >
      {/* Polish-B.3: Q11/Q12 と同じ世界観に揃える
          (白カード + deepPurple ピルバッジ + 太字 deepPurple 見出し + 白入力欄) */}
      <div className="w-full max-w-md bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-2xl p-6 animate-modal-slide-up">
        <div className="inline-block rounded-full bg-[#3A2D6B] px-3 py-1 text-xs font-black text-white mb-3">
          最後に
        </div>
        <label
          htmlFor="perceiver-name-overlay"
          className="block text-base sm:text-lg font-bold text-[#3A2D6B] leading-relaxed mb-6"
        >
          お名前を教えて
        </label>
        <input
          id="perceiver-name-overlay"
          type="text"
          value={isPlaceholder ? "" : perceiverName}
          onChange={(e) => onPerceiverNameChange(e.target.value)}
          maxLength={20}
          placeholder="名前"
          autoComplete="off"
          autoFocus
          className="w-full rounded-xl border-2 border-[#0094D8]/30 bg-white px-4 py-3 text-base text-[#3A2D6B] font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE993] focus:border-[#3A2D6B] transition-colors mb-6"
        />

        {/* Polish-B.3: CTA 中央寄せ + max-w 制限 (B.2 から維持) */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPlaceholder}
            className="rounded-full px-10 py-4 text-base font-black bg-[#FFE993] text-[#3A2D6B] border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all min-w-[220px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#3A2D6B]"
          >
            結果を見る →
          </button>
        </div>
      </div>
    </div>
  );
}
