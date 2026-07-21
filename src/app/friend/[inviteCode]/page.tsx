"use client";

// Phase 1.5-α Day 12-C3: /friend/[inviteCode] の Brand v2 + Koi 風リブランド
//
// スコープ:
//   - intro 画面: Koi キャラ風 (ステッカー + キャラ枠 + タイプ名 + コード + サブ特性 +
//     充実説明文 + フローティング CTA)
//   - scale 画面: Day 9 /diagnosis と同じ Brand v2 (lavender + sunYellow バー + 立体 CTA)
//   - message / error: 最低限の Brand v2 化
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
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";
import {
  FRIEND_QUESTIONS_V2_PAGE_1,
  FRIEND_QUESTIONS_V2_PAGE_2,
  FRIEND_QUESTIONS_V2_PAGE_3,
  renderQuestionText,
  type FriendQuestionV2,
} from "@/lib/friend-questions-v2";
import { LikertScale } from "@/components/diagnosis/LikertScale";
import { DiagnosisHero } from "@/components/diagnosis/DiagnosisHero";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";
import {
  StickyCtaFooter,
  ctaPrimary,
  ctaSecondary,
} from "@/components/StickyCtaFooter";

// 自己診断ページ (diagnosis) と同じ質問下の主要 CTA スタイル。
const soraPrimary =
  "sora-cta rounded-full px-10 py-4 min-w-[180px] font-bold text-center block transition-all duration-150 hover:translate-y-px active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";
import type { SixteenTypeId } from "@/lib/sixteen-types";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { AnswerValue } from "@/lib/types";

// =========================================================================
// 状態管理
// =========================================================================
// Phase 1.5-α Day 12-Polish-B: name overlay 追加
//   現行フロー (2026-07-20 おまけ choice 廃止): scale (30問) → message → 送信
//   name はモーダル overlay として表示し、入力後すぐ submit() を呼ぶ。
// submitting フェーズ (回答作成中の待機ページ) は廃止。送信中はメッセージ画面のまま
// ボタンを「送信中...」表示にし、成功後はそのまま結果ページへ遷移する。
type Phase = "scale" | "message" | "error";

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

// 1人で完結する友達診断 (2026-07-18): 30 問 = 10 問 × 3 ページ。
const SCALE_PAGES: FriendQuestionV2[][] = [
  FRIEND_QUESTIONS_V2_PAGE_1,
  FRIEND_QUESTIONS_V2_PAGE_2,
  FRIEND_QUESTIONS_V2_PAGE_3,
];

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
  const [scaleAnswers, setScaleAnswers] = useState<Record<number, AnswerValue>>(
    {},
  );
  const [perceiverName, setPerceiverName] = useState<string>("友達");
  // ③ 本人へのメッセージ (任意・最大200字)
  const [message, setMessage] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 送信中フラグ (待機ページの代わり: メッセージ画面のボタンをローディング表示にする)。
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 招待コードが実在しない (friend-info が 404)。30問答えた後の送信で初めて失敗
  // させないため、判明した時点で回答フェーズに入れず無効リンク画面を出す。
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const trackedLanding = useRef(false);

  // ===== 初期化: invite_code から owner 情報取得 =====
  useEffect(() => {
    if (!trackedLanding.current) {
      trackedLanding.current = true;
      track("friend_landing_viewed", { inviteCode });
      // intro 廃止に伴い、評価開始 = マウント時 (質問直行) に発火へ移設。
      track("friend_answer_started", { inviteCode });
    }
    fetch(`/api/friend-info?code=${encodeURIComponent(inviteCode)}`)
      .then((res) => {
        if (res.status === 404) {
          setInviteInvalid(true);
          return null;
        }
        // 404 以外の失敗 (一時的なネットワーク/サーバエラー) は従来どおり寛容に進める
        // (owner 名が「友達」表示になるだけで回答は可能)。
        return res.ok ? res.json() : null;
      })
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

  // 「次へ」等でステップ (ページ / フェーズ) が変わったら、必ず最上部へ。
  //   setState と同フレームで window.scrollTo すると、まだ差し替わっていない旧ページ上で
  //   スクロールが始まり、直後の DOM 差し替え (特にモバイル + スクロール連動ヘッダー) で
  //   アニメーションが中断され、中途半端な位置に残ることがある。新画面の描画後 (rAF) に
  //   実行することで、確実に上まで戻す。
  useEffect(() => {
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    const id = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior });
    });
    return () => cancelAnimationFrame(id);
  }, [phase, pageIdx]);

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

  // 最上部スクロールはステップ変化を監視する useEffect に集約 (旧ページ上での
  // 早すぎる scrollTo を避けるため、ここでは状態更新のみ)。
  const handleScaleNext = () => {
    if (!isCurrentScalePageComplete) return;
    if (pageIdx < SCALE_PAGES.length - 1) {
      setPageIdx((p) => p + 1);
    } else {
      // おまけ choice 3 問は 2026-07-20 に廃止。30問完了後はメッセージ入力へ直行。
      setPhase("message");
      track("friend_answer_scale_completed", { inviteCode });
    }
  };

  const handleScalePrev = () => {
    if (pageIdx > 0) {
      setPageIdx((p) => p - 1);
    }
  };


  const submit = async () => {
    if (isSubmitting) return; // 二重送信ガード
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/friend-answer/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          scaleAnswers,
          perceiverName,
          message,
          // consent 画面を廃止したため、常に false (有料レポートへの名前付き掲載はしない)。
          pdfConsent: false,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.friendPerceptionId) {
        setSubmitError(data?.error ?? `HTTP ${res.status}`);
        setIsSubmitting(false);
        setPhase("error");
        return;
      }
      track("friend_answer_completed", {
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
      // 待機ページは廃止。送信中表示のまま結果ページへ直接遷移する
      // (遷移するので isSubmitting は false に戻さない = 二重送信も防ぐ)。
      router.push(`/evaluate/sent/${data.friendPerceptionId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
      setIsSubmitting(false);
      setPhase("error");
    }
  };

  // ===== 画面分岐 (intro 廃止: 初期 phase="scale" で質問直行) =====
  // 無効な招待リンクは回答フェーズより優先して表示 (どのフェーズでも上書き)。
  if (inviteInvalid) {
    return <InvalidInviteScreen />;
  }

  if (phase === "scale") {
    return (
      <ScaleScreen
        page={pageIdx}
        totalPages={SCALE_PAGES.length}
        questions={currentScalePage}
        subjectLabel={subjectLabel}
        scaleAnswers={scaleAnswers}
        perceiverName={perceiverName}
        onPerceiverNameChange={setPerceiverName}
        onAnswer={handleScaleAnswer}
        onNext={handleScaleNext}
        onPrev={handleScalePrev}
        isPageComplete={isCurrentScalePageComplete}
      />
    );
  }


  if (phase === "message") {
    // 名前は先頭で取得済み。ここは質問の最後の自由記入 (任意メッセージ) + 送信。
    return (
      <MessageScreen
        message={message}
        onMessageChange={setMessage}
        onSubmit={submit}
        submitting={isSubmitting}
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
  perceiverName,
  onPerceiverNameChange,
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
  perceiverName: string;
  onPerceiverNameChange: (v: string) => void;
  onAnswer: (qId: number, v: AnswerValue) => void;
  onNext: () => void;
  onPrev: () => void;
  isPageComplete: boolean;
}) {
  const isLastPage = page === totalPages - 1;
  const inviteeName = subjectLabel.replace(/さん$/, "");
  // 名前は自己診断のニックネームと同様、最初のページ先頭で必須入力。
  // 初期値 "友達" (state 初期値) は未入力と同等扱い。
  const nameTrimmed = perceiverName.trim();
  const isPlaceholderName = nameTrimmed === "" || nameTrimmed === "友達";
  const hasName = !isPlaceholderName;

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
    // 自己診断ページ (diagnosis) と同じ構成: 共通ヘッダー + 白背景 + 区切り線質問 +
    // 質問下インライン CTA + 共通フッター。
    <>
      {/* サイト共通ヘッダー (16P 風スクロール連動) */}
      <ScrollHideHeader>
        <TopHeader />
      </ScrollHideHeader>
      <div className="flex flex-col flex-1 min-h-screen pb-12 bg-white">
        {/* 自己診断の page 0 と同様、最上部にヒーロー (見出しは友達診断向けに差し替え)。
            単一ページのため進捗バーは出さない (diagnosis の page 0 と同じ)。 */}
        <DiagnosisHero
          title="友達診断テスト"
          imageSrc="/mascot/friend-hero.png"
        />

        <main className="flex flex-col flex-1 w-full pt-6 pb-4">
          {/* 名前入力: 自己診断のニックネームと同様、最初のページ先頭に白カードで置く。 */}
          {page === 0 && (
            <div className="mb-8 mx-auto w-full max-w-[1080px] px-4 md:px-8">
              <div className="rounded-2xl border border-[#2E2E5C]/10 bg-white p-6 shadow-[0_2px_10px_rgba(42,58,92,0.08)]">
                <div className="mx-auto max-w-md">
                  <label
                    htmlFor="perceiver-name"
                    className="mb-4 block text-center font-bold leading-relaxed text-[#2E2E5C]"
                    style={{ fontSize: "clamp(20px, 2.4vw, 26px)" }}
                  >
                    ニックネームを教えて
                  </label>
                  <input
                    id="perceiver-name"
                    type="text"
                    value={isPlaceholderName ? "" : perceiverName}
                    onChange={(e) => onPerceiverNameChange(e.target.value)}
                    maxLength={20}
                    placeholder=""
                    autoComplete="off"
                    className="w-full rounded-xl border border-[#2E2E5C]/25 bg-white px-4 py-3.5 text-center text-lg font-bold text-[#2E2E5C] transition-colors focus:border-[#5B5BEF] focus:outline-none focus:ring-2 focus:ring-[#5B5BEF]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 質問: 自己診断の QuestionCard と同じ「区切り線 + 中央見出し + 大きめ○」。
              friend は質問文が動的 (renderQuestionText) のため同デザインをインライン展開。 */}
          {questions.map((q) => {
            const answered = scaleAnswers[q.id] !== undefined;
            return (
              <div
                key={q.id}
                ref={(el) => {
                  questionRefs.current[q.id] = el;
                }}
                tabIndex={-1}
                aria-label={`質問 ${q.id}`}
                className={`mx-auto w-full max-w-[1080px] border-b border-[#2E2E5C]/10 px-4 py-8 outline-none transition-opacity duration-300 sm:py-10 md:px-8 ${
                  answered ? "opacity-50 hover:opacity-100 focus-within:opacity-100" : ""
                }`}
              >
                <p className="mx-auto mb-7 max-w-3xl text-center text-[17px] font-bold leading-relaxed text-[#2E2E5C] sm:text-[20px]">
                  {renderQuestionText(q.text, inviteeName)}
                </p>
                <LikertScale
                  value={scaleAnswers[q.id]}
                  onChange={(v) => answerAndAdvance(q.id, v)}
                  size="lg"
                />
              </div>
            );
          })}

          {/* 質問の下の CTA (自己診断と同じインライン配置)。全問回答 + (page 0 は
              お名前入力) で活性化。 */}
          <div className="mx-auto mt-10 flex w-full max-w-[1080px] flex-col items-center gap-3 px-4 md:px-8">
            <button
              type="button"
              onClick={onNext}
              disabled={!isPageComplete || (page === 0 && !hasName)}
              className={soraPrimary}
            >
              {isLastPage ? "さいごへ →" : "次へ"}
            </button>
            {page > 0 && (
              <button type="button" onClick={onPrev} className={ctaSecondary}>
                戻る
              </button>
            )}
            {page === 0 && isPageComplete && !hasName && (
              <p className="text-center text-xs font-bold text-[#E86AA6]">
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
// 無効な招待リンク画面 (friend-info が 404 のとき)
// 回答させてから失敗させない。再試行しても解消しないため、リトライは出さず
// 自己診断への導線だけ置く。
// =========================================================================
function InvalidInviteScreen() {
  return (
    <>
      <ScrollHideHeader>
        <TopHeader />
      </ScrollHideHeader>
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-10 pb-32">
        <p className="mb-4 text-base font-black text-[#2E2E5C]">
          この招待リンクは無効です
        </p>
        <p className="mb-6 max-w-sm text-center text-xs font-bold leading-relaxed text-[#2E2E5C]/70">
          リンクが正しくコピーされていないか、招待した人のデータが見つかりませんでした。
          送ってくれた友達に、もう一度リンクを送ってもらってください。
        </p>
        <StickyCtaFooter>
          <a href="/diagnosis" className={ctaPrimary}>
            自分の診断をやってみる
          </a>
        </StickyCtaFooter>
      </div>
      <TopFooter />
    </>
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
// 質問の最後の自由記入 (任意メッセージ) + 送信。名前は先頭で取得済み。
// 他画面と同じ共通ヘッダー / 白背景 / 共通フッターに揃える。
// =========================================================================
const MESSAGE_MAX = 200;

function MessageScreen({
  message,
  onMessageChange,
  onSubmit,
  submitting,
}: {
  message: string;
  onMessageChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <>
      <ScrollHideHeader>
        <TopHeader />
      </ScrollHideHeader>
      {/* min-h-screen / flex-1 を外し、内容の高さに合わせてフッターを近づける
          (CTA とフッターの間の余白を詰める)。 */}
      <div className="flex flex-col bg-white pb-8">
        <DiagnosisHero
          title="友達診断テスト"
          imageSrc="/mascot/friend-hero.png"
        />
        <main className="flex w-full flex-col items-center px-4 pt-6 pb-4 md:px-8">
          <div className="mx-auto w-full max-w-xl">
            {/* 見出し・ラベル・プレースホルダの重複を解消: 見出しに「本人へひとこと(任意)」を
                集約し、ラベルと文字数カウンタは廃止。プレースホルダは補足のみ。 */}
            <h2 className="mb-6 text-center text-[22px] font-black leading-relaxed text-[#2E2E5C] sm:text-[24px]">
              最後に、本人へひとこと（任意）
            </h2>

            <div className="rounded-2xl border border-[#2E2E5C]/10 bg-white p-6 shadow-[0_2px_10px_rgba(42,58,92,0.08)]">
              <textarea
                id="perceiver-message"
                aria-label="本人へのひとことメッセージ (任意)"
                value={message}
                onChange={(e) =>
                  onMessageChange(e.target.value.slice(0, MESSAGE_MAX))
                }
                maxLength={MESSAGE_MAX}
                rows={4}
                placeholder="伝えたいことがあれば自由にどうぞ"
                className="w-full resize-none rounded-xl border border-[#2E2E5C]/25 bg-white px-4 py-3 text-[15px] font-bold text-[#2E2E5C] transition-colors focus:border-[#5B5BEF] focus:outline-none focus:ring-2 focus:ring-[#5B5BEF]"
              />
            </div>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                aria-busy={submitting}
                className={soraPrimary}
              >
                {submitting ? "送信中..." : "結果を見る →"}
              </button>
            </div>
          </div>
        </main>
      </div>
      <TopFooter />
    </>
  );
}
