"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FullAccessCta } from "@/components/result/FullAccessCta";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { RESULT_UPGRADE_QUESTIONS } from "@/lib/result-upgrade";

type Props = {
  ownerToken: string;
  existingAnswers?: string[];
  initialState?: string | null;
  premiumPaid: boolean;
  preview?: boolean;
  modal?: boolean;
};

type Screen = "questions" | "saving" | "purchase" | "generating" | "failed";

const POLL_INTERVAL_MS = 2_000;
const ALICE_REPLY_DELAY_MS = 900;
const UPGRADE_PREPARATION_DELAY_MS = 15_000;
const ALICE_AVATAR_SRC = "/mascot/hoshiyomi-alice-avatar-transparent.png";
const ALICE_QUESTION_MESSAGES = [
  "まずは、暇な時間って何をすることが多い？",
  "ありがとう！じゃあ、最近つい時間を忘れちゃったことってある？",
  "なるほど！周りの人からは、どんな人って言われることが多い？",
  "じゃあ、次は…恋愛で大事にしていること、何かある？",
  "教えてくれてありがとう！最後に、あなたの将来の夢を聞かせて？",
] as const;

export function ResultUpgradeChat({
  ownerToken,
  existingAnswers = [],
  initialState,
  premiumPaid,
  preview = false,
  modal = false,
}: Props) {
  const router = useRouter();
  const hasSavedAnswers = existingAnswers.length === RESULT_UPGRADE_QUESTIONS.length;
  const [answers, setAnswers] = useState<string[]>(existingAnswers);
  const [draft, setDraft] = useState("");
  const [index, setIndex] = useState(hasSavedAnswers ? RESULT_UPGRADE_QUESTIONS.length : 0);
  const [screen, setScreen] = useState<Screen>(() => {
    if (!hasSavedAnswers) return "questions";
    if (!premiumPaid) return "purchase";
    return initialState === "failed" ? "failed" : "generating";
  });
  const [aliceTyping, setAliceTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const answerSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aliceTyping, answers, index, screen]);

  useEffect(() => {
    if (preview || screen !== "generating" || !premiumPaid) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function kick() {
      try {
        await fetch("/api/result-upgrade/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: retryKey > 0 }),
        });
      } catch {
        // status ポーリングで回復する。
      }
    }

    async function poll() {
      if (cancelled) return;
      try {
        const response = await fetch("/api/result-upgrade/status", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = (await response.json()) as { state?: string };
          if (data.state === "ready") {
            router.replace(
              ownerToken
                ? `/me/${encodeURIComponent(ownerToken)}?upgraded=1`
                : "/result-upgrade/reading",
            );
            return;
          }
          if (data.state === "failed") {
            setScreen("failed");
            return;
          }
        }
      } catch {
        // 一時的な通信失敗は次のポーリングで回復する。
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    void kick().then(poll);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ownerToken, premiumPaid, preview, retryKey, router, screen]);

  async function submitAnswer() {
    const answer = draft.trim();
    if (!answer || answer.length > 500 || answerSubmittingRef.current) return;
    answerSubmittingRef.current = true;
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    setDraft("");
    setError(null);
    setAliceTyping(true);

    await new Promise((resolve) => window.setTimeout(resolve, ALICE_REPLY_DELAY_MS));
    if (!isMountedRef.current) return;
    setAliceTyping(false);

    if (nextAnswers.length < RESULT_UPGRADE_QUESTIONS.length) {
      setIndex(nextAnswers.length);
      answerSubmittingRef.current = false;
      return;
    }

    setScreen("saving");
    const minimumPreparationDelay = new Promise((resolve) =>
      window.setTimeout(resolve, UPGRADE_PREPARATION_DELAY_MS),
    );

    if (preview) {
      await minimumPreparationDelay;
      if (!isMountedRef.current) return;
      setScreen(premiumPaid ? "generating" : "purchase");
      answerSubmittingRef.current = false;
      return;
    }

    try {
      const response = await fetch("/api/result-upgrade/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      if (!response.ok) throw new Error("save failed");
      await minimumPreparationDelay;
      if (!isMountedRef.current) return;
      setScreen(premiumPaid ? "generating" : "purchase");
    } catch {
      setError("回答を保存できませんでした。通信環境を確認して、もう一度お試しください。");
      setScreen("questions");
      setAnswers(nextAnswers.slice(0, -1));
      setIndex(nextAnswers.length - 1);
      setDraft(answer);
    } finally {
      answerSubmittingRef.current = false;
    }
  }

  return (
    <div
      className={`mx-auto flex w-full max-w-[720px] flex-col overflow-hidden rounded-[28px] border border-[#E5E3F4] bg-white shadow-[0_18px_55px_rgba(46,46,92,0.12)] ${
        modal ? "h-full min-h-0" : "min-h-[680px]"
      }`}
    >
      <div
        className={`flex items-center gap-3 bg-[#2E2E5C] px-5 py-4 text-white ${
          modal ? "pr-16" : ""
        }`}
      >
        <SmoothImage
          src={ALICE_AVATAR_SRC}
          alt="Alice"
          width={48}
          height={48}
          className="h-12 w-12 rounded-full border-2 border-white/30 bg-white object-contain"
        />
        <div>
          <p className="text-[16px] font-black">Alice</p>
          <p className="text-[12px] font-bold text-white/65">あなた専用の結果をつくる会話</p>
        </div>
        <span className="ml-auto text-[#F5D66B]" aria-hidden="true">✦</span>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#F5F4FB] px-4 py-6 md:px-7">
        <div className="space-y-5">
          <AliceBubble>
            ここからは、診断の選択肢だけでは見えなかったあなたを少し教えてください。短くても、じっくり話しても大丈夫です。
          </AliceBubble>
          {answers.map((answer, answerIndex) => (
            <div key={`${answerIndex}-${answer}`} className="space-y-5">
              <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-[5px] bg-[#5B5BEF] px-4 py-3 text-[14px] font-bold leading-[1.8] text-white shadow-sm">
                {answer}
              </div>
              {answerIndex + 1 < RESULT_UPGRADE_QUESTIONS.length &&
                answerIndex + 1 <= index && (
                  <AliceBubble>{ALICE_QUESTION_MESSAGES[answerIndex + 1]}</AliceBubble>
                )}
            </div>
          ))}
          {answers.length === 0 && screen === "questions" && (
            <AliceBubble>{ALICE_QUESTION_MESSAGES[0]}</AliceBubble>
          )}

          {aliceTyping && <AliceTypingBubble />}

          {screen === "saving" && <UpgradePreparationBubble />}

          {screen === "purchase" && (
            <div className="rounded-[24px] border border-[#EFD79B] bg-white p-5 shadow-[0_8px_25px_rgba(154,106,36,0.10)] md:p-7">
              <p className="text-[12px] font-black tracking-[0.12em] text-[#9A6A24]">回答の保存ができました</p>
              <h2 className="mt-2 text-[23px] font-black leading-[1.45] text-[#2E2E5C] md:text-[28px]">
                世界に一体だけのキャラクターと、あなた専用の鑑定書を作成します
              </h2>
              <p className="mt-3 text-[14px] leading-[1.8] text-[#66657B]">
                元の診断キャラクターを受け継ぎながら、今のあなたに似合う表情・服装・小物・背景へ。型名と結果の冒頭文も、あなた専用になります。
              </p>
              <div className="mt-6">
                {preview ? (
                  <form action="/api/dev/result-upgrade-checkout" method="post">
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center rounded-full bg-[#A87322] px-6 py-4 text-[16px] font-black text-white shadow-[0_4px_0_#7F5518] transition hover:translate-y-0.5 hover:shadow-[0_2px_0_#7F5518]"
                    >
                      結果をアップグレード
                    </button>
                  </form>
                ) : (
                  <FullAccessCta
                    ownerToken={ownerToken}
                    locale="ja"
                    product="premium_bundle"
                    returnTo="me"
                    source="result_upgrade_after_answers"
                    accentColor="#A87322"
                    shadowColor="#7F5518"
                  >
                    結果をアップグレード
                  </FullAccessCta>
                )}
              </div>
              {!preview && (
                <p className="mt-3 text-center text-[11px] font-bold text-[#8A8AA3]">
                  買い切り・追加料金なし
                </p>
              )}
            </div>
          )}

          {screen === "generating" && (
            <AliceBubble>
              ありがとう。あなたの答えと、これまでの診断結果を重ねながら、キャラクターと鑑定書を作っています。
              <LoadingDots />
            </AliceBubble>
          )}

          {screen === "failed" && (
            <AliceBubble>
              作成が途中で止まってしまいました。回答は保存されています。
              <button
                type="button"
                onClick={() => {
                  setRetryKey((value) => value + 1);
                  setScreen("generating");
                }}
                className="mt-3 block rounded-full bg-[#5B5BEF] px-5 py-2.5 text-[13px] font-black text-white"
              >
                もう一度作成する
              </button>
            </AliceBubble>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {screen === "questions" && index < RESULT_UPGRADE_QUESTIONS.length && (
        <div className="border-t border-[#ECEAF5] bg-white p-4 md:p-5">
          {error && <p className="mb-2 text-[12px] font-bold text-red-600">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitAnswer();
                }
              }}
              maxLength={500}
              rows={2}
              disabled={aliceTyping}
              placeholder="自由に話してみてください"
              className="min-h-[52px] flex-1 resize-none rounded-2xl border border-[#DAD7EB] bg-[#FAFAFD] px-4 py-3 text-[14px] leading-relaxed text-[#2E2E5C] outline-none transition focus:border-[#7774E8] focus:ring-2 focus:ring-[#7774E8]/15 disabled:cursor-wait disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void submitAnswer()}
              disabled={aliceTyping || !draft.trim()}
              aria-label="回答を送る"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#5B5BEF] text-xl font-black text-white shadow-[0_3px_0_#3D3DC4] transition active:translate-y-0.5 disabled:opacity-35"
            >
              ↑
            </button>
          </div>
          <p className="mt-2 px-1 text-[11px] font-bold text-[#9997AA]">一言でも、長く話してもOK</p>
        </div>
      )}
    </div>
  );
}

function AliceBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <SmoothImage
        src={ALICE_AVATAR_SRC}
        alt=""
        width={34}
        height={34}
        className="h-[34px] w-[34px] shrink-0 rounded-full border border-[#E5E3F4] bg-white object-contain"
      />
      <div className="max-w-[84%] rounded-2xl rounded-bl-[5px] bg-white px-4 py-3 text-[14px] font-bold leading-[1.8] text-[#2E2E5C] shadow-[0_2px_8px_rgba(46,46,92,0.06)]">
        {children}
      </div>
    </div>
  );
}

function AliceTypingBubble() {
  return (
    <AliceBubble>
      <span
        className="flex min-w-20 items-center gap-2 py-0.5 text-[12px] text-[#8A8AA3]"
        role="status"
        aria-label="Aliceが入力中"
      >
        <span>入力中</span>
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8A8AA3]"
              style={{ animationDelay: `${dot * 120}ms` }}
            />
          ))}
        </span>
      </span>
    </AliceBubble>
  );
}

function UpgradePreparationBubble() {
  return (
    <AliceBubble>
      <div role="status" aria-live="polite">
        <p>ありがとう。いま、あなたの回答をこれまでの診断結果と照らし合わせています。</p>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[#7774A6]">
          <span>あなた専用の結果をつくる準備中</span>
          <LoadingDots compact />
        </div>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <span className="block h-1.5 w-full animate-pulse rounded-full bg-[#E7E5F7]" />
          <span className="block h-1.5 w-[82%] animate-pulse rounded-full bg-[#ECEAF8] [animation-delay:180ms]" />
          <span className="block h-1.5 w-[64%] animate-pulse rounded-full bg-[#F0EEF9] [animation-delay:360ms]" />
        </div>
      </div>
    </AliceBubble>
  );
}

function LoadingDots({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${compact ? "" : "mt-2"} flex gap-1`} aria-label="作成中">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8A8AA3]"
          style={{ animationDelay: `${dot * 120}ms` }}
        />
      ))}
    </span>
  );
}
