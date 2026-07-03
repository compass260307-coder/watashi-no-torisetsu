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
import Link from "next/link";
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
import {
  StickyCtaFooter,
  ctaPrimary,
  ctaSecondary,
} from "@/components/StickyCtaFooter";
import { TrisetsuNameTag } from "@/components/result/TrisetsuNameTag";
import { CharacterHero } from "@/components/result/CharacterHero";
import { FloatingShareCta } from "@/components/result/FloatingShareCta";
import {
  sixteenTypes,
  characterImagePath,
  type SixteenTypeId,
} from "@/lib/sixteen-types";
import { selfResultContent } from "@/lib/self-result-content";
// 32タイプ本文 (フラグ on 時のみ・①本文だけ32化。型名/画像は16のまま=解釈A)
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import {
  selfContentFor,
  thirtyTwoName,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoOneLiner,
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
  // Day 12-Polish-E: owner の 16 タイプ id (/me レイアウト流用版のキャラ/本文 lookup キー)
  sixteenTypeId: SixteenTypeId | null;
  // 32タイプ id (フラグ on 時の①本文 lookup 用。型名/画像は sixteenTypeId のまま)
  thirtyTwoTypeId: ThirtyTwoTypeId | null;
}

// 改修: 10 問 = 1 ページ。
const SCALE_PAGES: FriendQuestionV2[][] = [FRIEND_QUESTIONS_V2_PAGE_1];

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
    sixteenTypeId: null,
    thirtyTwoTypeId: null,
  });
  const [phase, setPhase] = useState<Phase>("intro");
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

  // ===== 画面分岐 =====
  if (phase === "intro") {
    return (
      <IntroScreen
        owner={owner}
        ownerName={ownerName}
        onStart={startEvaluation}
      />
    );
  }

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
// Intro 画面 (Day 12-Polish-E: /me レイアウト流用の "CTA 違い版")
//   - レイアウトは /me と同じ: タグ / ヒーロー(owner のキャラ+型名+essence) / 3 セクション。
//     表示データは owner 本人のもの (selfResultContent[owner16型])。
//   - メイン CTA「相互理解度を測る」は最下部 (3 セクションの後) に配置。タップで評価フロー開始。
//   - フローティング CTA (/me と同じ FloatingShareCta = 右下固定の円形 chunky) を併設。
//     文言「相互理解度を測る」、タップで評価フロー開始。
//   - 友達向けフレーミング文は撤去。旧デザイン (ペアのマスコット等) は新レイアウトに置換済み。
// =========================================================================
function IntroScreen({
  owner,
  ownerName,
  onStart,
}: {
  owner: OwnerInfo;
  ownerName: string;
  onStart: () => void;
}) {
  const typeId = owner.sixteenTypeId;
  const type16 = typeId ? sixteenTypes[typeId] : null;
  // 解釈B: フラグ on で型名・essence・画像を32化 (off=従来16)。
  const c32 = isThirtyTwoEnabled() ? owner.thirtyTwoTypeId : null;
  // ①本文のみフラグで32化。on=32実データ(N高低)→base16フォールバック / off=従来16。
  const sections =
    isThirtyTwoEnabled() && owner.thirtyTwoTypeId
      ? selfContentFor(owner.thirtyTwoTypeId)
      : typeId
        ? selfResultContent[typeId]
        : null;

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
        </div>

        {/* ===== タグ ({owner}のトリセツ) = /me と同じ ===== */}
        <TrisetsuNameTag name={ownerName} className="mb-4" />

        {!type16 || !sections ? (
          // owner 情報の取得待ち (invite_code → 16 タイプ)。短時間の読み込み。
          <div className="py-16 text-center">
            <p className="text-sm font-bold text-[#3A2D6B]/70">読み込み中...</p>
          </div>
        ) : (
          <>
            {/* ===== ヒーロー (owner のキャラ + essence + 型名) = /me と同じ ===== */}
            <CharacterHero
              imageSrc={c32 ? thirtyTwoImagePath(c32) : characterImagePath(typeId!)}
              alt={c32 ? thirtyTwoEssence(c32) : type16.essence}
              essence={c32 ? thirtyTwoEssence(c32) : type16.essence}
              name={c32 ? thirtyTwoName(c32) : type16.name}
              description={c32 ? thirtyTwoOneLiner(c32) : type16.oneLiner}
            />

            {/* ===== 3 セクション (取扱説明書 / 取扱注意ポイント / 相性の良いお相手) = /me と同じ ===== */}
            {sections.map((sec, idx) => (
              <section key={sec.title} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white font-black text-lg flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <h2 className="text-[#3A2D6B] font-black text-xl leading-tight">
                    {sec.title}
                  </h2>
                </div>
                <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
                  {sec.body.split("\n\n").map((para, i) => (
                    <p
                      key={i}
                      className="text-[#3A2D6B] font-bold text-sm leading-relaxed mb-4 last:mb-0"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            {/* ===== メイン CTA (最下部 = 3 セクションの後)。タップで評価フロー開始 ===== */}
            <div className="mb-2">
              <button
                type="button"
                onClick={onStart}
                className="block w-full bg-[#FFE993] text-[#3A2D6B] font-black text-base px-6 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all text-center"
              >
                相互理解度を測る →
              </button>
              <p className="text-center text-[11px] text-[#3A2D6B]/65 font-bold mt-2">
                10 問・約 1 分。アナタの目線で答えるだけ。
              </p>
            </div>
          </>
        )}
      </div>

      {/* /me と同じフローティング CTA (右下固定の円形 chunky)。タップで評価フロー開始。 */}
      <FloatingShareCta
        onClick={onStart}
        line1="相互理解度"
        line2="を測る"
        ariaLabel="相互理解度を測る"
      />
    </main>
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
  const percent = Math.round((answeredCount / FRIEND_QUESTIONS_V2_TOTAL) * 100);
  const inviteeName = subjectLabel.replace(/さん$/, "");

  // Polish-D-A FINAL: ctaPrimary / ctaSecondary を import (ローカル navCta* 廃止)

  return (
    <div className="flex flex-col flex-1 min-h-screen pb-32 bg-[#E4E0F5]">
      {/* sticky progress (Day 9 と同じ Brand v2 化済 ProgressBar 互換) */}
      <div className="sticky top-0 z-10 bg-[#E4E0F5]/95 backdrop-blur-sm border-b border-[#0094D8]/15">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex justify-between text-sm font-bold text-[#3A2D6B] mb-2">
            <span>
              質問 {answeredCount} / {FRIEND_QUESTIONS_V2_TOTAL}
            </span>
            <span>
              Page {page + 1} / {totalPages}
            </span>
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
        {/* Day 12-Polish-E: 評価フロー冒頭のナッジ (素直な第一印象で答えてもらう) */}
        {page === 0 && (
          <div className="bg-[#FFF9F0] rounded-2xl border-2 border-[#FFE993] px-5 py-4 mb-5">
            <p className="text-sm font-bold text-[#3A2D6B] leading-relaxed text-center">
              {inviteeName}本人の自己診断は気にせず、
              <br />
              アナタの素直な印象で答えてね。
            </p>
          </div>
        )}

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
          <p className="text-[10px] font-black tracking-[0.3em] text-[#FE3C72] mb-2">
            最後にひとつ
          </p>
          <h1 className="text-lg sm:text-xl font-black text-[#3A2D6B] leading-snug">
            この評価、{ownerName}さんの
            <br />
            レポートにも使っていい?
          </h1>
        </header>

        {/* 1 行説明 (1 枚の白カードに圧縮) */}
        <section className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-5 mb-4">
          <p className="text-sm text-[#3A2D6B] leading-relaxed">
            アナタの名前 (
            <span className="font-bold text-[#FE3C72]">{perceiverName}</span>) と
            回答が、{ownerName}さんの
            <span className="font-bold">有料レポート</span>
            に「ひとつの視点」として載ることがあります (第三者に共有される
            可能性も)。
          </p>
        </section>

        {/* opt-in (cream / sunYellow 枠) */}
        <section className="bg-[#FFF9F0] rounded-3xl border-2 border-[#FFE993] shadow-md p-5 mb-4">
          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="checkbox"
              checked={pdfConsent}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[#3A2D6B] cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-[#3A2D6B] leading-relaxed font-bold">
              名前付きで載ること・共有の可能性に
              <span className="text-[#FE3C72]">同意する</span>
            </span>
          </label>
        </section>

        {/* 小注記 (未チェック時の挙動 + 後から変更不可) */}
        <p className="text-[11px] text-[#3A2D6B]/65 leading-relaxed font-bold">
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
    <div className="min-h-screen bg-[#E4E0F5] flex flex-col flex-1 items-center justify-center px-5 py-10 pb-32">
      <p className="text-base font-black text-[#3A2D6B] mb-4">
        送信に失敗しました
      </p>
      <p className="text-xs text-[#3A2D6B]/70 font-bold mb-6 text-center">
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
          placeholder=""
          autoComplete="off"
          autoFocus
          className="w-full rounded-xl border-2 border-[#0094D8]/30 bg-white px-4 py-3 text-base text-[#3A2D6B] font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE993] focus:border-[#3A2D6B] transition-colors"
        />

        {/* ③ 本人へのメッセージ (任意) */}
        <label
          htmlFor="perceiver-message-overlay"
          className="block text-sm font-bold text-[#3A2D6B] leading-relaxed mt-5 mb-2"
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
          className="w-full rounded-xl border-2 border-[#0094D8]/30 bg-white px-4 py-3 text-sm text-[#3A2D6B] font-bold resize-none focus:outline-none focus:ring-2 focus:ring-[#FFE993] focus:border-[#3A2D6B] transition-colors"
        />
        <p className="text-right text-[11px] text-[#3A2D6B]/50 font-bold mt-1">
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
