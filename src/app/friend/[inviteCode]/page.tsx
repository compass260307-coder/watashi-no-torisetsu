"use client";

// Phase 1.5-α Day 12-C3: /friend/[inviteCode] の Brand v2 + Koi 風リブランド
//
// スコープ:
//   - intro 画面: Koi キャラ風 (ステッカー + キャラ枠 + タイプ名 + コード + サブ特性 +
//     充実説明文 + フローティング CTA)
//   - scale 画面: Day 9 /diagnosis と同じ Brand v2 (lavender + sunYellow バー + 立体 CTA)
//   - choice / consent / submitting / error: 最低限の Brand v2 化
//   - complete 画面: 削除 → submit 成功時に router.push(/evaluate/sent/{perceptionId})
//     (Day 12-Polish-F で着地先を獲得エンジン /evaluate/sent に変更)
//
// 触らない (Day 12-C3 スコープ外):
//   - 評価ロジック本体 (lib/friend-questions-v2 / FRIEND_QUESTIONS_V2_*)
//   - /api/friend-answer/v2 (Phase 3-β 完成済)
//   - friend_perceptions スキーマ
//   - LikertScale コンポーネント (Day 9 で Brand v2 化済、再利用)
//   - 既存 components/FloatingCTABar (LP 用、別物)

import { Suspense, use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";
import {
  FRIEND_QUESTIONS_V2_PAGE_1,
  FRIEND_QUESTIONS_V2_TOTAL,
  FRIEND_CHOICE_QUESTIONS_V2,
  renderQuestionText,
  type FriendQuestionV2,
  type FriendChoiceQuestionV2,
} from "@/lib/friend-questions-v2";
import { LikertScale } from "@/components/diagnosis/LikertScale";
import { ProgressBar } from "@/components/diagnosis/ProgressBar";
import {
  StickyCtaFooter,
  ctaPrimary,
  ctaSecondary,
} from "@/components/StickyCtaFooter";
import {
  characterImagePath,
  type SixteenTypeId,
} from "@/lib/sixteen-types";
// 32タイプ本文 (フラグ on 時のみ・①本文だけ32化。型名/画像は16のまま=解釈A)
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import {
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { AnswerValue } from "@/lib/types";

// =========================================================================
// 状態管理
// =========================================================================
// Phase 1.5-α Day 12-Polish-B: name overlay 追加
//   旧フロー: intro (名前入力) → scale → choice → consent → submitting
//   新フロー: intro (名前なし) → scale → choice → consent → name → submitting
//   name はモーダル overlay として表示し、入力後すぐ submit() を呼ぶ。
type Phase =
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
  // Day 12-Polish-E: owner の 16 タイプ id (/me レイアウト流用版のキャラ/本文 lookup キー)
  sixteenTypeId: SixteenTypeId | null;
  // 32タイプ id (フラグ on 時の①本文 lookup 用。型名/画像は sixteenTypeId のまま)
  thirtyTwoTypeId: ThirtyTwoTypeId | null;
}

// 改修: 10 問 = 1 ページ。
const SCALE_PAGES: FriendQuestionV2[][] = [FRIEND_QUESTIONS_V2_PAGE_1];

// prefers-reduced-motion 尊重 (自己診断 diagnosis/page.tsx と同挙動)。
// true のときオートスクロールを smooth ではなく auto (瞬間) にする。
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
          <p className="text-sm font-bold text-[#2E2E5C]/70">読み込み中...</p>
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
    sixteenTypeId: null,
    thirtyTwoTypeId: null,
  });
  // 導線改善: intro (owner トリセツ全文) を廃止し、踏んだ瞬間から質問 (scale) 直行。
  // owner のトリセツ相当は送信完了後の /evaluate/sent で「ご褒美」+自己診断CTAとして表示。
  const [phase, setPhase] = useState<Phase>("scale");
  const [pageIdx, setPageIdx] = useState<number>(0);
  const [choiceIdx, setChoiceIdx] = useState<0 | 1 | 2>(0);
  const [scaleAnswers, setScaleAnswers] = useState<Record<number, AnswerValue>>(
    {},
  );
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, string>>(
    {},
  );
  const [perceiverName, setPerceiverName] = useState<string>("友達");
  // ③ 本人へのメッセージ (任意・最大200字)
  const [message, setMessage] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pdfConsent, setPdfConsent] = useState<boolean>(false);
  const trackedLanding = useRef(false);

  // ===== 初期化: invite_code から owner 情報取得 =====
  useEffect(() => {
    if (!trackedLanding.current) {
      trackedLanding.current = true;
      track("friend_landing_viewed", { inviteCode });
      // intro 廃止に伴い、評価開始 = マウント時 (質問直行) に発火へ移設。
      track("friend_v2_started", { inviteCode });
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
          sixteenTypeId: (data.sixteenTypeId as SixteenTypeId | null) ?? null,
          thirtyTwoTypeId:
            (data.thirtyTwoTypeId as ThirtyTwoTypeId | null) ?? null,
        });
      })
      .catch(() => {});
  }, [inviteCode]);

  const ownerName = owner.displayName ?? "友達";
  const subjectLabel = owner.displayName
    ? `${owner.displayName}さん`
    : "友達";

  // ===== ハンドラ =====
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
    if (pageIdx < SCALE_PAGES.length - 1) {
      setPageIdx((p) => p + 1);
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
      setPageIdx((p) => p - 1);
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
          message,
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
      // Day 12-Polish-F: 送信完了後は獲得エンジン (理解度 + アナタの目に映る owner
      // + 自己診断 CTA) を返す遷移ページへ。詳細ギャップ/課金は owner 限定の
      // /evaluate/result 側に集約し、友達にはここでは出さない。
      router.push(`/evaluate/sent/${data.friendPerceptionId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  };

  // ===== 画面分岐 (intro 廃止: 初期 phase="scale" で質問直行) =====
  if (phase === "scale") {
    return (
      <ScaleScreen
        page={pageIdx}
        totalPages={SCALE_PAGES.length}
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
        message={message}
        onMessageChange={setMessage}
        onSubmit={submit}
      />
    );
  }

  if (phase === "submitting") {
    return (
      <SubmittingScreen
        subjectLabel={subjectLabel}
        imageSrc={
          isThirtyTwoEnabled() && owner.thirtyTwoTypeId
            ? thirtyTwoImagePath(owner.thirtyTwoTypeId)
            : owner.sixteenTypeId
              ? characterImagePath(owner.sixteenTypeId)
              : "/mascot-pair.png"
        }
      />
    );
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
// Scale 画面 (Day 9 /diagnosis と統一: lavender + sunYellow + 立体 CTA)
// =========================================================================
function ScaleScreen({
  page,
  totalPages,
  questions,
  subjectLabel,
  scaleAnswers,
  answeredCount,
  onAnswer,
  onNext,
  onPrev,
  isPageComplete,
}: {
  page: number;
  totalPages: number;
  questions: FriendQuestionV2[];
  subjectLabel: string;
  scaleAnswers: Record<number, AnswerValue>;
  answeredCount: number;
  onAnswer: (qId: number, v: AnswerValue) => void;
  onNext: () => void;
  onPrev: () => void;
  isPageComplete: boolean;
}) {
  const isLastPage = page === totalPages - 1;
  const inviteeName = subjectLabel.replace(/さん$/, "");

  // 自己診断 (diagnosis/page.tsx 244-274) と同じオートスクロール:
  //   回答すると同ページ内の「次の未回答質問」へスクロール + フォーカス。
  //   次が回答済み (答え直し等) / ページ最後の質問 は自動送りしない。
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const answerAndAdvance = (questionId: number, value: AnswerValue) => {
    onAnswer(questionId, value);
    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx === -1) return;
    const next = questions[idx + 1];
    if (!next) return; // ページ最後 → 「次へ」ボタンに委譲
    if (scaleAnswers[next.id] !== undefined) return; // 次が回答済み → 留まる
    const el = questionRefs.current[next.id];
    if (!el) return;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    // クリックの再レンダー後に実行 (1 フレーム遅延)。
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior, block: "center" });
      // a11y: フォーカスも次の質問へ (スクロール済みなので preventScroll)。
      el.focus({ preventScroll: true });
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen pb-32 bg-[#E4E0F5]">
      {/* 進捗バー: 自己診断と同じ共有 <ProgressBar> に統一 (旧インライン実装を置換) */}
      <ProgressBar
        currentQuestion={answeredCount}
        totalQuestions={FRIEND_QUESTIONS_V2_TOTAL}
        currentPage={page + 1}
        totalPages={totalPages}
      />

      <main className="flex flex-col flex-1 px-4 pt-6 pb-4 max-w-lg mx-auto w-full">
        {/* Day 12-Polish-E: 評価フロー冒頭のナッジ (素直な第一印象で答えてもらう) */}
        {page === 0 && (
          <div className="bg-[#F4F4FE] rounded-2xl border-2 border-[#5B5BEF] px-5 py-4 mb-5">
            <p className="text-sm font-bold text-[#2E2E5C] leading-relaxed text-center">
              {inviteeName}本人の自己診断は気にせず、
              <br />
              アナタの素直な印象で答えてね。
            </p>
          </div>
        )}

        {questions.map((q) => (
          <div
            key={q.id}
            ref={(el) => {
              questionRefs.current[q.id] = el;
            }}
            tabIndex={-1}
            className="w-full bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-5 outline-none"
          >
            <div className="inline-block rounded-full bg-[#2E2E5C] px-3 py-1 text-xs font-black text-white mb-3">
              Q{q.id}
            </div>
            <p className="text-base sm:text-lg font-bold text-[#2E2E5C] leading-relaxed mb-6">
              {renderQuestionText(q.text, inviteeName)}
            </p>
            <LikertScale
              value={scaleAnswers[q.id]}
              onChange={(v) => answerAndAdvance(q.id, v)}
            />
          </div>
        ))}

        {!isPageComplete && (
          <p className="text-center text-xs text-[#2E2E5C]/70 font-bold mt-2 mb-4">
            このページの 10 問すべてに答えると、次へ進めるよ
          </p>
        )}
      </main>

      {/* variant="solid": スケール 30 問は footer 直上に LikertScale の○が来るため
          ボタン裏で透けないように不透明クリームを敷く */}
      <StickyCtaFooter variant="solid">
        {page > 0 && (
          <button type="button" onClick={onPrev} className={ctaSecondary}>
            戻る
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!isPageComplete}
          className={ctaPrimary}
        >
          {isLastPage ? "おまけの質問へ →" : "次へ"}
        </button>
      </StickyCtaFooter>
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
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between text-xs font-bold text-[#2E2E5C]">
          <span>おまけ {choiceIdx + 1} / 3</span>
          <span>スキップ可</span>
        </div>
      </div>

      <main className="flex flex-col flex-1 items-center px-4 pt-8 pb-10 max-w-lg mx-auto w-full">
        <div className="inline-block rounded-full bg-[#2E2E5C] px-3 py-1 text-xs font-black text-white mb-4">
          おまけ
        </div>
        <h2 className="text-lg font-black text-[#2E2E5C] text-center mb-6 leading-relaxed">
          {renderQuestionText(question.text, inviteeName)}
        </h2>

        <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(question.id, opt)}
              className="w-full bg-white rounded-2xl border-2 border-[#0094D8]/30 px-5 py-4 text-sm font-bold text-[#2E2E5C] transition-all hover:bg-[#5B5BEF]/30 hover:border-[#2E2E5C] active:scale-[0.98]"
            >
              {opt}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[#2E2E5C]/60 hover:text-[#5B5BEF] font-bold underline transition-colors"
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
// Polish-E E-2: ConsentScreen 軽量化 (1 カード圧縮)
//   - 旧: 3 段落の説明 + 別カードのチェック + 否定形 CTA「PDF 利用なしで送信する」
//   - 新: eyebrow + 短いタイトル + 1 行説明白カード + opt-in cream カード + 小注記
//     + 単一 CTA「送信する」(同意フラグはチェック状態で送信、否定形 CTA 廃止)
//   - 保持: 名前付き掲載 / 第三者共有の可能性 / opt-in / 後から変更不可
//     (権利説明の実質はそのまま、表現を圧縮しただけ)
//   - subjectLabel は使わず ownerName + さん で統一
function ConsentScreen({
  ownerName,
  perceiverName,
  pdfConsent,
  onConsentChange,
  onSubmit,
}: {
  ownerName: string;
  perceiverName: string;
  pdfConsent: boolean;
  onConsentChange: (value: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4 pb-32 flex flex-col flex-1">
      <div className="max-w-[480px] mx-auto w-full">
        <header className="text-center mb-5">
          <p className="text-[10px] font-black tracking-[0.3em] text-[#5B5BEF] mb-2">
            最後にひとつ
          </p>
          <h1 className="text-lg sm:text-xl font-black text-[#2E2E5C] leading-snug">
            この評価、{ownerName}さんの
            <br />
            レポートにも使っていい?
          </h1>
        </header>

        {/* 1 行説明 (1 枚の白カードに圧縮) */}
        <section className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-5 mb-4">
          <p className="text-sm text-[#2E2E5C] leading-relaxed">
            アナタの名前 (
            <span className="font-bold text-[#5B5BEF]">{perceiverName}</span>) と
            回答が、{ownerName}さんの
            <span className="font-bold">有料レポート</span>
            に「ひとつの視点」として載ることがあります (第三者に共有される
            可能性も)。
          </p>
        </section>

        {/* opt-in (cream / sunYellow 枠) */}
        <section className="bg-[#F4F4FE] rounded-3xl border-2 border-[#5B5BEF] shadow-md p-5 mb-4">
          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="checkbox"
              checked={pdfConsent}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[#2E2E5C] cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-[#2E2E5C] leading-relaxed font-bold">
              名前付きで載ること・共有の可能性に
              <span className="text-[#5B5BEF]">同意する</span>
            </span>
          </label>
        </section>

        {/* 小注記 (未チェック時の挙動 + 後から変更不可) */}
        <p className="text-[11px] text-[#2E2E5C]/65 leading-relaxed font-bold">
          ※ 未チェックでも評価は届きます (Web で閲覧可・レポート化のみ不可)。
          この設定は後から変更できません。
        </p>
      </div>

      {/* 単一 CTA「送信する」(同意フラグはチェック状態で送信) */}
      <StickyCtaFooter>
        <button type="button" onClick={onSubmit} className={ctaPrimary}>
          送信する
        </button>
      </StickyCtaFooter>
    </main>
  );
}

// =========================================================================
// Submitting 画面
// =========================================================================
function SubmittingScreen({
  subjectLabel,
  imageSrc,
}: {
  subjectLabel: string;
  imageSrc: string;
}) {
  return (
    <div className="min-h-screen bg-[#E4E0F5] flex flex-col flex-1 items-center justify-center px-5 py-10">
      {/* Day 12-Polish-E: 旧ペアマスコットを owner のキャラ画像に置換 (新レイアウトと統一) */}
      <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-[0_10px_28px_rgba(58,45,107,0.16)] animate-bounce-slow mb-4">
        <Image
          src={imageSrc}
          alt=""
          width={320}
          height={320}
          aria-hidden="true"
          className="w-full h-full object-cover"
        />
      </div>
      <p className="text-lg font-black text-[#2E2E5C] text-center mb-2 leading-relaxed">
        アナタから見た{subjectLabel}を
        <br />
        生成中...
      </p>
      <p className="text-xs text-[#2E2E5C]/70 font-bold">少し待ってね</p>
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
    <div className="min-h-screen bg-[#E4E0F5] flex flex-col flex-1 items-center justify-center px-5 py-10 pb-32">
      <p className="text-base font-black text-[#2E2E5C] mb-4">
        送信に失敗しました
      </p>
      <p className="text-xs text-[#2E2E5C]/70 font-bold mb-6 text-center">
        {message}
      </p>
      {/* Polish-D-A FINAL: 再試行ボタンを StickyCtaFooter に移動 */}
      <StickyCtaFooter>
        <button type="button" onClick={onRetry} className={ctaPrimary}>
          もう一度送信する
        </button>
      </StickyCtaFooter>
    </div>
  );
}

// =========================================================================
// Phase 1.5-α Day 12-Polish-B: NameOverlay (30 問 + consent 完了直後の名前入力)
// 「結果を見る前に、お名前を教えてください」
// 必須 (空文字スキップ不可)、入力後 submit() で /api/friend-answer/v2 + router.push
// =========================================================================
const MESSAGE_MAX = 200;

function NameOverlay({
  perceiverName,
  onPerceiverNameChange,
  message,
  onMessageChange,
  onSubmit,
}: {
  perceiverName: string;
  onPerceiverNameChange: (v: string) => void;
  message: string;
  onMessageChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const trimmed = perceiverName.trim();
  // 初期値 "友達" (state 初期値) は「未入力」と同等扱いで送信不可にする
  const isPlaceholder = trimmed === "" || trimmed === "友達";

  // Polish-D-A FINAL: モーダル内のボタンを StickyCtaFooter に移動。
  //   - モーダル親 div の中に配置することで、ダイアログ背景の上に footer が乗る
  //     (DOM 順で後ろなので、同じ z-50 でも footer が前面に来る)
  //   - 親に pb-32 を追加して、カードが footer に重ならないよう中央領域を上にずらす
  // Polish-E E-3: 幕を黒ディム (bg-black/50) → lavender 半透明 (bg-[#E4E0F5]/85) に。
  //   暗いグレーの幕で「怖い」+「上下分断」感が出ていたため、A 側 basic-info と
  //   同じパステルトーンに統一。
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="お名前の入力"
      className="fixed inset-0 z-50 bg-[#E4E0F5]/85 backdrop-blur-sm flex items-center justify-center px-4 py-6 pb-32 animate-modal-fade-in"
    >
      {/* Polish-B.3: Q11/Q12 と同じ世界観 (白カード + ピル + 太字見出し + 白入力欄) */}
      <div className="w-full max-w-md bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-2xl p-6 animate-modal-slide-up">
        <div className="inline-block rounded-full bg-[#2E2E5C] px-3 py-1 text-xs font-black text-white mb-3">
          最後に
        </div>
        <label
          htmlFor="perceiver-name-overlay"
          className="block text-base sm:text-lg font-bold text-[#2E2E5C] leading-relaxed mb-6"
        >
          お名前を教えて
        </label>
        <input
          id="perceiver-name-overlay"
          type="text"
          value={isPlaceholder ? "" : perceiverName}
          onChange={(e) => onPerceiverNameChange(e.target.value)}
          maxLength={20}
          placeholder=""
          autoComplete="off"
          autoFocus
          className="w-full rounded-xl border-2 border-[#0094D8]/30 bg-white px-4 py-3 text-base text-[#2E2E5C] font-bold focus:outline-none focus:ring-2 focus:ring-[#5B5BEF] focus:border-[#2E2E5C] transition-colors"
        />

        {/* ③ 本人へのメッセージ (任意) */}
        <label
          htmlFor="perceiver-message-overlay"
          className="block text-sm font-bold text-[#2E2E5C] leading-relaxed mt-5 mb-2"
        >
          ひとことメッセージ (任意)
        </label>
        <textarea
          id="perceiver-message-overlay"
          value={message}
          onChange={(e) => onMessageChange(e.target.value.slice(0, MESSAGE_MAX))}
          maxLength={MESSAGE_MAX}
          rows={3}
          placeholder="本人に伝えたいことがあれば自由にどうぞ"
          className="w-full rounded-xl border-2 border-[#0094D8]/30 bg-white px-4 py-3 text-sm text-[#2E2E5C] font-bold resize-none focus:outline-none focus:ring-2 focus:ring-[#5B5BEF] focus:border-[#2E2E5C] transition-colors"
        />
        <p className="text-right text-[11px] text-[#2E2E5C]/50 font-bold mt-1">
          {message.length} / {MESSAGE_MAX}
        </p>
      </div>

      <StickyCtaFooter>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPlaceholder}
          className={ctaPrimary}
        >
          結果を見る →
        </button>
      </StickyCtaFooter>
    </div>
  );
}
