"use client";

import { LINE_UPGRADE_OFFER_MESSAGE, LINE_UPGRADE_PRICE_MESSAGE } from "@/lib/line-upgrade-dialogue";
import { LINE_RESULT_UPGRADE_LIST_PRICE_JPY, LINE_RESULT_UPGRADE_COUPON_JPY, RESULT_UPGRADE_PRICE_JPY, KO_RESULT_UPGRADE_PRICE_KRW } from "@/lib/access-products";
import { localePath } from "@/i18n/config";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FullAccessCta } from "@/components/result/FullAccessCta";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { ResultUpgradeSpendPause } from "./ResultUpgradeSpendPause";
import { watchResultUpgrade, type ResultUpgradeSpendPauseStatus } from "@/lib/result-upgrade-polling";
import {
  LEGACY_RESULT_UPGRADE_ANSWER_COUNT,
  LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH,
  RESULT_UPGRADE_QUESTIONS,
  WEB_RESULT_UPGRADE_QUESTIONS_V2,
} from "@/lib/result-upgrade";
import {
  WEB_RESULT_UPGRADE_INTRO_V2,
  WEB_RESULT_UPGRADE_AFTER_GIFT_MESSAGE_V2,
  WEB_RESULT_UPGRADE_GIFT_LOADING_MESSAGE_V2,
  WEB_RESULT_UPGRADE_QUESTION_MESSAGES_V2,
  fallbackResultUpgradeReaction,
  sanitizeResultUpgradeReaction,
} from "@/lib/result-upgrade-reaction";
import { RESULT_UPGRADE_COPY, type ResultUpgradeLocale } from "@/i18n/result-upgrade";
import { RESULT_UPGRADE_SESSION_COPY } from "@/i18n/result-upgrade-session";
import { ResultUpgradeSessionCheck } from "./ResultUpgradeSessionCheck";
import { CouponTicket, ResultUpgradeOfferCard, ResultUpgradeTreasure } from "./ResultUpgradeTreasure";
import { clearResultUpgradeDraft, loadResultUpgradeDraft, saveResultUpgradeDraft } from "@/lib/result-upgrade-draft";

type Props = {
  locale?: ResultUpgradeLocale;
  ownerToken: string;
  existingAnswers?: string[];
  initialState?: string | null;
  premiumPaid: boolean;
  preview?: boolean;
  modal?: boolean;
  salesChannel?: "web" | "line";
};

type Screen = "questions" | "saving" | "purchase" | "generating" | "failed" | "blocked";

// Aliceが入力中を出す長さ。毎回1〜2秒のあいだでばらつかせて、人が打っている感じを出す。
function aliceTypingMs(): number {
  return 1000 + Math.random() * 1000;
}
// 吹き出しが届いてから、次の入力中が出るまでの小さな間。
const ALICE_BETWEEN_MESSAGES_MS = 450;
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const UPGRADE_PREPARATION_DELAY_MS = 15_000;
// 7問の会話では、照らし合わせの待ちのあとに「プレゼントがあるよ」の読み込みを見せてから宝箱を開く。
const GIFT_LOADING_DELAY_MS = 3_200;
// 表紙が出そろってから（開いて2.8秒後）、Aliceが入力中を挟んであいさつ・1問目を送る。
const GREETING_START_MS = 2800;
const GREETING_DONE = 4;
// Aliceの反応を待つ上限。超えたら定型文に切り替えて会話を止めない。
const ALICE_REACTION_TIMEOUT_MS = 7_000;
const ALICE_AVATAR_SRC = "/mascot/hoshiyomi-alice-avatar-transparent.png";
const ALICE_COVER_SRC = "/mascot/result-upgrade-cover-alice-v1.webp";
const GIFT_OPENED_KEY = "result-upgrade-gift-opened-v1:";

// クーポンを受け取ったかどうかは、同じ結果を開き直しても受け取り済みに戻すため端末に残す。
// 保存できない環境では毎回プレゼントから表示する（購入には影響しない）。
function readGiftOpened(ownerToken: string): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(GIFT_OPENED_KEY + ownerToken) === "1";
  } catch {
    return false;
  }
}

const COARSE_POINTER_QUERY = "(pointer: coarse)";

function subscribeCoarsePointer(onChange: () => void): () => void {
  const query = window.matchMedia(COARSE_POINTER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readCoarsePointer(): boolean {
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

function saveGiftOpened(ownerToken: string): void {
  try { localStorage.setItem(GIFT_OPENED_KEY + ownerToken, "1"); } catch { /* optional storage */ }
}


export function ResultUpgradeChat({
  ownerToken,
  locale = "ja",
  existingAnswers = [],
  initialState,
  premiumPaid,
  preview = false,
  modal = false,
  salesChannel = "web",
}: Props) {
  const lineFlow = locale === "ja" && salesChannel === "line";
  const maxAnswerLength = lineFlow ? LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH : 500;
  const channelQuery = lineFlow ? "?channel=line" : "";
  const router = useRouter();
  const copy = RESULT_UPGRADE_COPY[locale];
  const sessionCopy = RESULT_UPGRADE_SESSION_COPY[locale];
  const [sessionVerified, setSessionVerified] = useState(preview);
  // 日本語Webは7問＋Aliceの反応つき。LINE・韓国語と、従来の5問を保存済みの人は従来の会話のまま。
  const webV2 = locale === "ja" && !lineFlow &&
    existingAnswers.length !== LEGACY_RESULT_UPGRADE_ANSWER_COUNT;
  const ALICE_QUESTION_MESSAGES: readonly string[] = webV2
    ? WEB_RESULT_UPGRADE_QUESTION_MESSAGES_V2
    : copy.questionMessages;
  const questionCount = webV2
    ? WEB_RESULT_UPGRADE_QUESTIONS_V2.length
    : RESULT_UPGRADE_QUESTIONS.length;
  const localePrefix = localePath(locale, "/") === "/" ? "" : localePath(locale, "/");
  const hasSavedAnswers = existingAnswers.length === questionCount;
  const [answers, setAnswers] = useState<string[]>(existingAnswers);
  // 回答番号ごとのAliceの反応。再読み込みで復元した回答には無く、その場合は質問だけを表示する。
  const [reactions, setReactions] = useState<Record<number, string>>({});
  // その場で送った回答の送信時刻（LINEの吹き出し横の時刻）。再読み込みで復元した回答には出さない。
  const [answeredAt, setAnsweredAt] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState("");
  const [index, setIndex] = useState(hasSavedAnswers ? questionCount : 0);
  const [screen, setScreen] = useState<Screen>(() => {
    if (!hasSavedAnswers) return "questions";
    if (!premiumPaid) return "purchase";
    return initialState === "failed" ? "failed" : "generating";
  });
  const [aliceTyping, setAliceTyping] = useState(false);
  // 初めて開いたときのあいさつの進み具合。0: 表紙だけ → 1: 入力中 → 2: あいさつ → 3: 入力中 → 4: 1問目。
  // 途中から再開した人や回答済みの人は待たせず、最初から全部出す。
  const [greetingStep, setGreetingStep] = useState(() =>
    existingAnswers.length === 0 ? 0 : GREETING_DONE,
  );
  // 購入画面は本人確認のあと（プレビューは保存しない）にだけ出るため、サーバー描画とは食い違わない。
  const [giftOpened, setGiftOpened] = useState(() => !preview && readGiftOpened(ownerToken));
  const [treasureOpen, setTreasureOpen] = useState(false);
  // 宝箱を開けずに「あとで開ける」で閉じたら、チャットに開き直すボタンを出す。
  const [treasureDismissed, setTreasureDismissed] = useState(false);
  const treasureAutoShownRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [spendPause, setSpendPause] = useState<ResultUpgradeSpendPauseStatus | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const answerSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const draftRestoredRef = useRef(false);
  // 下端を見ている間は、吹き出しが増えてもキーボードで画面が縮んでも最新の吹き出しに合わせ続ける。
  const stickToBottomRef = useRef(true);
  const userScrollingRef = useRef(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const coarsePointer = useSyncExternalStore(subscribeCoarsePointer, readCoarsePointer, () => false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const input = answerInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }, [draft, sessionVerified, screen]);

  function scrollToLatest(behavior: ScrollBehavior) {
    const conversation = conversationRef.current;
    if (!conversation) return;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    conversation.scrollTo({ top: conversation.scrollHeight, behavior });
  }

  function markUserScroll() {
    userScrollingRef.current = true;
  }

  function handleConversationScroll() {
    const conversation = conversationRef.current;
    if (!conversation) return;
    const distance = conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight;
    if (distance < 96) {
      stickToBottomRef.current = true;
      userScrollingRef.current = false;
    } else if (userScrollingRef.current) {
      // 自動スクロールの途中ではなく、本人が上へ戻って読み返しているときだけ追従をやめる。
      stickToBottomRef.current = false;
    }
    const nextShowJump = !stickToBottomRef.current && distance > 240;
    setShowJumpToLatest((current) => (current === nextShowJump ? current : nextShowJump));
  }

  useEffect(() => {
    const conversation = conversationRef.current;
    const content = contentRef.current;
    if (!conversation || !content) return;
    conversation.scrollTo({ top: conversation.scrollHeight, behavior: "instant" });
    if (typeof ResizeObserver === "undefined") return;
    let lastHeight = conversation.clientHeight;
    const observer = new ResizeObserver(() => {
      const shrank = conversation.clientHeight < lastHeight;
      lastHeight = conversation.clientHeight;
      if (!stickToBottomRef.current) return;
      // キーボードで縮んだときは即座に、吹き出しが増えたときはなめらかに下へ送る。
      conversation.scrollTo({ top: conversation.scrollHeight, behavior: shrank ? "instant" : "smooth" });
    });
    observer.observe(conversation);
    observer.observe(content);
    return () => observer.disconnect();
  }, [sessionVerified]);

  // 7問を答え終えて購入画面に来たら、宝箱の演出を一度だけ自動で開く。閉じたあとはチャットから開ける。
  const awaitingTreasure = screen === "purchase" && webV2 && !giftOpened;
  useEffect(() => {
    if (!awaitingTreasure) return;
    const timer = window.setTimeout(() => {
      if (treasureAutoShownRef.current) return;
      treasureAutoShownRef.current = true;
      setTreasureOpen(true);
    }, GIFT_LOADING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingTreasure]);

  useEffect(() => {
    if (!preview && sessionVerified && screen === "questions") {
      saveResultUpgradeDraft(ownerToken, answers, draft, questionCount);
    }
  }, [answers, draft, ownerToken, preview, questionCount, screen, sessionVerified]);

  const watchGeneration = !preview && sessionVerified && premiumPaid &&
    (screen === "generating" || screen === "failed" || screen === "blocked");
  useEffect(() => {
    if (!watchGeneration) return;
    return watchResultUpgrade({
      channel: lineFlow ? "line" : "web",
      force: retryKey > 0,
      checkBeforeKick: true,
      onBlocked: (status) => { setSpendPause(status); setScreen("blocked"); },
      onReady: () => router.replace(
        lineFlow ? "/line/result-upgrade/reading" : ownerToken
          ? `${localePrefix}/me/${encodeURIComponent(ownerToken)}?upgraded=1`
          : `${localePrefix}/result-upgrade/reading`,
      ),
      onFailed: () => setScreen("failed"),
    });
  }, [watchGeneration, retryKey, router, ownerToken, localePrefix, lineFlow]);

  const greetingActive = sessionVerified && screen === "questions" && greetingStep < GREETING_DONE;
  useEffect(() => {
    if (!greetingActive) return;
    // 下書きから回答を復元した人は、あいさつを待たせない。
    if (answers.length > 0) {
      const skip = window.setTimeout(() => setGreetingStep(GREETING_DONE), 0);
      return () => window.clearTimeout(skip);
    }
    // 1: 入力中 → 2: あいさつ → 3: 入力中 → 4: 1問目。入力中の長さは毎回ランダム。
    const introAt = GREETING_START_MS + aliceTypingMs();
    const secondTypingAt = introAt + ALICE_BETWEEN_MESSAGES_MS;
    const firstQuestionAt = secondTypingAt + aliceTypingMs();
    const timers = [GREETING_START_MS, introAt, secondTypingAt, firstQuestionAt]
      .map((at, i) => window.setTimeout(() => setGreetingStep(i + 1), at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // あいさつは開いたときに一度だけ流す。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetingActive]);

  async function fetchReaction(nextAnswers: string[]): Promise<string> {
    const questionIndex = nextAnswers.length - 1;
    const fallback = fallbackResultUpgradeReaction(questionIndex, nextAnswers[questionIndex]);
    try {
      const response = await fetch(
        preview ? "/api/dev/result-upgrade-reaction" : "/api/result-upgrade/reaction",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preview ? { answers: nextAnswers } : { answers: nextAnswers, ownerToken }),
          signal: AbortSignal.timeout(ALICE_REACTION_TIMEOUT_MS),
        },
      );
      if (!response.ok) return fallback;
      const data = await response.json().catch(() => null);
      return sanitizeResultUpgradeReaction(data?.reaction) ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function submitAnswer() {
    const answer = draft.trim();
    if (!answer || answer.length > maxAnswerLength || answerSubmittingRef.current) return;
    answerSubmittingRef.current = true;
    stickToBottomRef.current = true;
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    setAnsweredAt((previous) => ({ ...previous, [nextAnswers.length - 1]: formatChatTime(new Date(), locale) }));
    setDraft("");
    setError(null);
    setAliceTyping(true);

    // 反応 → 次の質問を、それぞれ入力中を挟んで1通ずつ届ける。
    const [reaction] = await Promise.all([
      webV2 ? fetchReaction(nextAnswers) : Promise.resolve(null),
      wait(aliceTypingMs()),
    ]);
    if (!isMountedRef.current) return;
    if (reaction) {
      setReactions((previous) => ({ ...previous, [nextAnswers.length - 1]: reaction }));
      setAliceTyping(false);
      await wait(ALICE_BETWEEN_MESSAGES_MS);
      if (!isMountedRef.current) return;
      setAliceTyping(true);
      await wait(aliceTypingMs());
      if (!isMountedRef.current) return;
    }
    setAliceTyping(false);

    if (nextAnswers.length < questionCount) {
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
      const response = await fetch(`/api/result-upgrade/answers${channelQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers, locale, ownerToken }),
      });
      if (!isMountedRef.current) return;
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 401 || data?.error === "result owner mismatch") {
          setSessionVerified(false);
        }
        if (response.status === 409 && data?.error === "already generated") {
          clearResultUpgradeDraft(ownerToken);
          router.replace(lineFlow ? "/line/result-upgrade/reading" : `${localePrefix}/me/${encodeURIComponent(ownerToken)}?upgraded=1`);
          return;
        }
        throw new Error(response.status === 403 ? sessionCopy.forbidden
          : response.status === 429 ? sessionCopy.rateLimited
          : response.status === 400 ? sessionCopy.invalidAnswers
          : sessionCopy.unavailable);
      }
      clearResultUpgradeDraft(ownerToken);
      await minimumPreparationDelay;
      if (!isMountedRef.current) return;
      setScreen(premiumPaid ? "generating" : "purchase");
    } catch (failure) {
      if (!isMountedRef.current) return;
      setError(failure instanceof Error && [sessionCopy.forbidden, sessionCopy.rateLimited,
        sessionCopy.invalidAnswers, sessionCopy.unavailable].some(message => message === failure.message)
        ? failure.message : copy.saveError);
      setScreen("questions");
      setAnswers(nextAnswers.slice(0, -1));
      setIndex(nextAnswers.length - 1);
      setDraft(answer);
    } finally {
      answerSubmittingRef.current = false;
    }
  }

  // 購入ボタン。購入カードと、宝箱の演出の最後の両方から使う（どちらも同じ結果アップグレードの決済へ進む）。
  function renderPurchaseButton() {
    if (preview && locale === "ko") {
      return (
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center rounded-full bg-[#A87322] px-6 py-4 text-[16px] font-black text-white opacity-60"
        >
          {copy.cta}
        </button>
      );
    }
    if (preview) {
      return (
        <form action="/api/dev/result-upgrade-checkout" method="post">
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-full bg-[#A87322] px-6 py-4 text-[16px] font-black text-white shadow-[0_4px_0_#7F5518] transition hover:translate-y-0.5 hover:shadow-[0_2px_0_#7F5518]"
          >
            {copy.cta}
          </button>
        </form>
      );
    }
    return (
      <FullAccessCta
        ownerToken={ownerToken}
        locale={locale}
        product="premium_bundle"
        salesChannel={salesChannel}
        returnTo="me"
        source="result_upgrade_after_answers"
        accentColor="#A87322"
        shadowColor="#7F5518"
      >
        {copy.cta}
      </FullAccessCta>
    );
  }

  if (!sessionVerified) {
    return <ResultUpgradeSessionCheck salesChannel={salesChannel} ownerToken={ownerToken} locale={locale} onVerified={() => {
      if (!draftRestoredRef.current) {
        draftRestoredRef.current = true;
        if (!hasSavedAnswers) {
          const saved = loadResultUpgradeDraft(ownerToken, questionCount);
          if (saved) {
            setAnswers(saved.answers);
            setIndex(saved.answers.length);
            setDraft(saved.draft);
          }
        } else {
          clearResultUpgradeDraft(ownerToken);
        }
      }
      setSessionVerified(true);
      setError(null);
    }} />;
  }

  // 会話をLINEのような吹き出しの並びとして組み立てる。続けて話す吹き出しはアイコンと名前を最初の1つだけに出す。
  const accent = lineFlow ? "#06C755" : "#5B5BEF";
  const accentDeep = lineFlow ? "#04A846" : "#4343D6";
  const hideConversation = lineFlow && screen === "purchase";
  const greetingTyping = greetingActive && (greetingStep === 1 || greetingStep === 3);
  const aliceIsTyping = aliceTyping || greetingTyping;
  const items: ChatItem[] = [];
  const alice = (key: string, body: React.ReactNode, question?: number) =>
    items.push({ key, kind: "alice", body, question });
  const card = (key: string, body: React.ReactNode) => items.push({ key, kind: "card", body });

  if (!hideConversation && greetingStep >= 2) alice("intro", webV2 ? WEB_RESULT_UPGRADE_INTRO_V2 : copy.intro);
  // 7問の会話では、答えたあとも1問目を残して会話の流れを読めるようにする。
  if (greetingStep >= GREETING_DONE && ((webV2 && !hideConversation) || (answers.length === 0 && screen === "questions"))) {
    alice("q0", ALICE_QUESTION_MESSAGES[0], 1);
  }
  if (!hideConversation) {
    answers.forEach((answer, answerIndex) => {
      items.push({ key: `a${answerIndex}`, kind: "user", body: answer, time: answeredAt[answerIndex] });
      const hasNextQuestion = answerIndex + 1 < questionCount && answerIndex + 1 <= index;
      if (reactions[answerIndex]) {
        alice(`r${answerIndex}`, reactions[answerIndex]);
      }
      if (hasNextQuestion) alice(`q${answerIndex + 1}`, ALICE_QUESTION_MESSAGES[answerIndex + 1], answerIndex + 2);
    });
  }

  if (aliceIsTyping) items.push({ key: "typing", kind: "alice", body: <TypingDots locale={locale} />, compact: true });
  if (screen === "saving") {
    alice("saving", copy.preparing);
    card("saving-card", <StarWeavingCard locale={locale} mode="preparing" starCount={questionCount} />);
  }

  if (screen === "purchase" && webV2) {
    if (giftOpened) {
      card("coupon", <CouponTicket couponJpy={LINE_RESULT_UPGRADE_COUPON_JPY} variant="chat" />);
    } else if (!treasureDismissed) {
      alice("gift-loading", WEB_RESULT_UPGRADE_GIFT_LOADING_MESSAGE_V2);
      card("gift-loading-card", <GiftLoadingCard />);
    } else {
      card("gift-reopen", (
        <button
          type="button"
          onClick={() => setTreasureOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-[#EFD79B] bg-[linear-gradient(180deg,#FFF8E4_0%,#FFFFFF_100%)] px-5 py-4 text-[15px] font-black text-[#7A4F0E] shadow-[0_8px_22px_rgba(154,106,36,0.14)] transition active:translate-y-0.5"
        >
          <span aria-hidden="true" className="text-[22px]">🎁</span>
          プレゼントの宝箱を開ける
        </button>
      ));
    }
    if (giftOpened) alice("after-gift", WEB_RESULT_UPGRADE_AFTER_GIFT_MESSAGE_V2);
  }
  if (screen === "purchase" && locale === "ja" && !lineFlow && !webV2) {
    alice("offer", LINE_UPGRADE_OFFER_MESSAGE);
    alice("price", LINE_UPGRADE_PRICE_MESSAGE);
  }
  // 韓国語も日本語版と同じく、購入カードの前に Alice が案内する。
  // 韓国の結果アップグレードには通常価格・クーポンが無いため、割引の案内は入れない。
  if (screen === "purchase" && locale === "ko" && !lineFlow) {
    alice("ko-offer", "다섯 가지 이야기를 들려줘서 고마워요🌷 이제 나만의 캐릭터와 보고서를 만들 수 있어요.");
    alice("ko-price", `결과 업그레이드는 ₩${KO_RESULT_UPGRADE_PRICE_KRW.toLocaleString("ko-KR")}, 한 번만 결제하면 돼요. 30일 환불 보장이 있으니, 만족스럽지 않으면 알려 주세요!`);
  }
  // 7問の会話では、クーポンを受け取ってから、フェルトの購入カード（値札と特典スライド）を出す。
  if (screen === "purchase" && webV2 && giftOpened) {
    card("offer-card", (
      <ResultUpgradeOfferCard
        couponJpy={LINE_RESULT_UPGRADE_COUPON_JPY}
        listPriceJpy={LINE_RESULT_UPGRADE_LIST_PRICE_JPY}
        priceJpy={RESULT_UPGRADE_PRICE_JPY}
        savedLabel={copy.saved}
        note={copy.oneTime}
        purchaseCta={renderPurchaseButton()}
      />
    ));
  }
  if (screen === "purchase" && !webV2) {
    card("purchase-card", (
      <div className="rounded-[24px] border border-[#EFD79B] bg-white p-5 shadow-[0_8px_25px_rgba(154,106,36,0.10)] md:p-7">
        <p className="text-[12px] font-black tracking-[0.12em] text-[#9A6A24]">{copy.saved}</p>
        <h2 className="mt-2 text-[23px] font-black leading-[1.45] text-[#2E2E5C] md:text-[28px]">
          {copy.purchaseTitle}
        </h2>
        <p className="mt-3 text-[14px] leading-[1.8] text-[#66657B]">
          {copy.purchaseBody}
        </p>
        {locale === "ja" && <div className="mt-4 space-y-1 text-sm text-[#66657B]">
          <p>通常価格 <s>¥{LINE_RESULT_UPGRADE_LIST_PRICE_JPY.toLocaleString("ja-JP")}</s></p>
          <p>クーポン適用 −¥{LINE_RESULT_UPGRADE_COUPON_JPY}</p>
          <p className="text-xl font-black text-[#2E2E5C]">お支払い ¥{RESULT_UPGRADE_PRICE_JPY}（税込・買い切り）</p>
        </div>}
        {locale === "ko" && <div className="mt-4 space-y-1 text-sm text-[#66657B]">
          <p className="text-xl font-black text-[#2E2E5C]">결제 금액 ₩{KO_RESULT_UPGRADE_PRICE_KRW.toLocaleString("ko-KR")} (세금 포함 · 1회 결제)</p>
          <p>30일 환불 보장</p>
        </div>}
        <div className="mt-6">
          {renderPurchaseButton()}
        </div>
        <p className="mt-3 text-center text-[11px] font-bold text-[#8A8AA3]">
          {copy.oneTime}
        </p>
      </div>
    ));
  }

  if (screen === "generating") {
    alice("generating", copy.generating);
    card("generating-card", <StarWeavingCard locale={locale} mode="generating" starCount={questionCount} />);
  }
  if (screen === "blocked") {
    alice("blocked", (
      <ResultUpgradeSpendPause locale={locale} {...spendPause} onResume={() => {
        setSpendPause(null);
        setScreen("generating");
        setRetryKey((value) => value + 1);
      }} />
    ));
  }
  if (screen === "failed") {
    alice("failed", (
      <>
        {copy.failed}
        <button
          type="button"
          onClick={() => {
            setRetryKey((value) => value + 1);
            setScreen("generating");
          }}
          className="mt-3 block rounded-full bg-[#5B5BEF] px-5 py-2.5 text-[13px] font-black text-white"
        >
          {copy.retry}
        </button>
      </>
    ));
  }

  const showComposer = screen === "questions" && index < questionCount;
  const showProgress = screen === "questions" || screen === "saving";
  const allAnswered = answers.length === questionCount;
  const currentQuestion = screen === "questions" && !aliceIsTyping ? answers.length + 1 : null;
  const trimmedLength = draft.trim().length;
  const canSend = !aliceIsTyping && greetingStep >= GREETING_DONE && trimmedLength > 0 && draft.length <= maxAnswerLength;
  const subtitle = aliceIsTyping
    ? `${copy.typing}...`
    : lineFlow && screen === "purchase" ? "アップグレード内容の確認" : copy.conversationSubtitle;
  const questionLabel = (number: number) =>
    locale === "ko" ? `질문 ${number}/${questionCount}` : `質問 ${number}/${questionCount}`;

  return (
    <div
      className={modal
        ? "flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#FBF8F3]"
        : "mx-auto flex h-[min(720px,calc(100svh-7rem))] min-h-[520px] w-full max-w-[720px] flex-col overflow-hidden rounded-[28px] border border-[#EDE6DA] bg-[#FBF8F3] shadow-[0_18px_55px_rgba(46,46,92,0.12)]"}
    >
      <header className="relative z-10 shrink-0 bg-white/90 shadow-[0_1px_0_#EFE9DF] backdrop-blur-xl">
        <div className={`flex h-[60px] items-center gap-3 pr-3 ${modal ? "pl-12" : "pl-4"}`}>
          <div className="relative shrink-0">
            <SmoothImage
              src={ALICE_AVATAR_SRC}
              alt="Alice"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full bg-[linear-gradient(160deg,#FFF3DC,#F3EEFF)] object-contain ring-2 ring-white shadow-[0_2px_8px_rgba(46,46,92,0.12)]"
            />
            <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-white bg-[#22C55E]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-black leading-tight tracking-[0.01em] text-[#2E2E5C]">Alice</p>
            <p
              className={`mt-0.5 truncate text-[11px] font-bold leading-tight transition-colors ${aliceIsTyping ? "" : "text-[#8A8AA3]"}`}
              style={aliceIsTyping ? { color: accent } : undefined}
              aria-live="polite"
            >
              {subtitle}
            </p>
          </div>
          {showProgress && (
            allAnswered ? (
              <span
                className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[12px] font-black text-white animate-chat-in"
                style={{ background: accent }}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {locale === "ko" ? "완료" : "完了"}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-[#F4F1EA] px-3 py-1 text-[12px] font-black tabular-nums" style={{ color: accent }}>
                {Math.min(answers.length + 1, questionCount)}
                <span className="text-[#B5B0A4]"> / {questionCount}</span>
              </span>
            )
          )}
        </div>
        {showProgress && (
          <div className="flex gap-1 px-4 pb-2.5" aria-hidden="true">
            {Array.from({ length: questionCount }, (_, step) => (
              // 答えた問題のバーが満タンになり終わってから、次の問題のバーにうっすら色を付ける（同時に動かさない）。
              <span
                key={step}
                className="h-[5px] flex-1 overflow-hidden rounded-full transition-colors duration-300"
                style={{
                  background: step === answers.length && screen === "questions" ? `${accent}2E` : "#EEEAE2",
                  transitionDelay: step === answers.length ? "650ms" : "0ms",
                }}
              >
                <span
                  className="block h-full rounded-full transition-[width] duration-[600ms] ease-out"
                  style={{
                    width: step < answers.length ? "100%" : "0%",
                    background: `linear-gradient(90deg, ${accent}, ${accentDeep})`,
                  }}
                />
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={conversationRef}
          data-upgrade-conversation
          onScroll={handleConversationScroll}
          onWheel={markUserScroll}
          onTouchStart={markUserScroll}
          className="h-full overflow-y-auto overscroll-contain px-3 pb-5 pt-5 md:px-6"
          style={{
            backgroundImage: "radial-gradient(rgba(154,106,36,0.075) 1px, transparent 1.3px)",
            backgroundSize: "20px 20px",
          }}
        >
          <div ref={contentRef}>
            {!hideConversation && <ChatWelcome locale={locale} questionCount={questionCount} answeredCount={answers.length} />}
            {items.map((item, itemIndex) => {
              const previous = items[itemIndex - 1];
              const groupStart = !previous || previous.kind !== item.kind;
              const gap = itemIndex === 0 ? "" : groupStart ? "mt-4" : "mt-1.5";
              if (item.kind === "card") {
                return <div key={item.key} className={`${gap} animate-chat-in`}>{item.body}</div>;
              }
              if (item.kind === "user") {
                return (
                  <div key={item.key} className={`flex items-end justify-end gap-1.5 ${gap} animate-chat-in`}>
                    <span className="mb-0.5 flex shrink-0 flex-col items-end text-[10px] font-bold leading-[1.35] text-[#A29C8F]">
                      <span>{locale === "ko" ? "읽음" : "既読"}</span>
                      {item.time && <span className="tabular-nums">{item.time}</span>}
                    </span>
                    <div
                      className={`relative max-w-[74%] whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[15px] font-medium leading-[1.7] text-white shadow-[0_2px_6px_rgba(67,67,214,0.18)] ${groupStart ? "rounded-tr-[4px]" : ""}`}
                      style={{ background: `linear-gradient(180deg, ${accent} 0%, ${accentDeep} 100%)` }}
                    >
                      {groupStart && <BubbleTail side="right" color={accent} />}
                      {item.body}
                    </div>
                  </div>
                );
              }
              const isCurrent = item.question !== undefined && item.question === currentQuestion;
              return (
                <div key={item.key} className={`flex items-start gap-2 ${gap} animate-chat-in`}>
                  {groupStart ? (
                    <SmoothImage
                      src={ALICE_AVATAR_SRC}
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 shrink-0 rounded-full bg-[linear-gradient(160deg,#FFF3DC,#F3EEFF)] object-contain ring-2 ring-white shadow-[0_1px_4px_rgba(46,46,92,0.12)]"
                    />
                  ) : (
                    <span aria-hidden="true" className="w-9 shrink-0" />
                  )}
                  <div className="min-w-0 max-w-[80%]">
                    {groupStart && <p className="mb-1 ml-1.5 text-[11px] font-bold leading-none text-[#8E887C]">Alice</p>}
                    <div
                      className={`relative whitespace-pre-wrap break-words rounded-[20px] bg-white text-[15px] font-medium leading-[1.7] text-[#2E2E5C] transition-shadow duration-500 ${
                        item.compact ? "px-4 py-3.5" : "px-4 py-2.5"
                      } ${groupStart ? "rounded-tl-[4px]" : ""}`}
                      style={{
                        boxShadow: isCurrent
                          ? `0 0 0 1.5px ${accent}55, 0 6px 18px ${accent}1F`
                          : "0 1px 2px rgba(46,46,92,0.07), 0 2px 10px rgba(120,92,60,0.05)",
                      }}
                    >
                      {groupStart && <BubbleTail side="left" color="#FFFFFF" />}
                      {item.question !== undefined && (
                        <span
                          className="mb-1.5 flex w-fit items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-black leading-none tracking-[0.04em] transition-colors duration-500"
                          style={isCurrent
                            ? { background: accent, color: "#FFFFFF" }
                            : { background: "#F4F1EA", color: "#9A927F" }}
                        >
                          {item.question <= answers.length && (
                            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                          )}
                          {questionLabel(item.question)}
                        </span>
                      )}
                      {item.body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showJumpToLatest && (
          <button
            type="button"
            onClick={() => scrollToLatest("smooth")}
            aria-label={locale === "ko" ? "최신 메시지로 이동" : "最新のメッセージへ"}
            className="absolute bottom-3 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white/95 text-[#2E2E5C] shadow-[0_6px_18px_rgba(46,46,92,0.18)] backdrop-blur animate-chat-in"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {showComposer && (
        <div
          className="relative z-10 shrink-0 bg-white/95 px-3 pt-2.5 shadow-[0_-1px_0_#EFE9DF] backdrop-blur-xl"
          style={{ paddingBottom: modal ? "max(0.625rem, env(safe-area-inset-bottom))" : "0.625rem" }}
        >
          {error && (
            <p role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-bold text-red-600">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 items-end rounded-[22px] border border-[#ECE6DB] bg-[#F7F4EE] px-4 transition duration-200 focus-within:border-[#C9C6EE] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(91,91,239,0.08)]">
              <textarea
                ref={answerInputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onFocus={() => {
                  // キーボードが出ても最新の質問が見えるように、下端へ合わせる。
                  stickToBottomRef.current = true;
                  window.setTimeout(() => scrollToLatest("instant"), 320);
                }}
                onKeyDown={(event) => {
                  // パソコンはEnterで送信、スマホはLINEと同じくEnterで改行して送信ボタンで送る。
                  if (
                    event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing &&
                    !coarsePointer
                  ) {
                    event.preventDefault();
                    void submitAnswer();
                  }
                }}
                maxLength={maxAnswerLength}
                rows={1}
                enterKeyHint={coarsePointer ? "enter" : "send"}
                aria-label={ALICE_QUESTION_MESSAGES[Math.min(index, ALICE_QUESTION_MESSAGES.length - 1)]}
                placeholder={copy.placeholder}
                className="block max-h-[120px] min-h-[42px] w-full resize-none overflow-y-auto bg-transparent py-[9px] text-[16px] leading-6 text-[#2E2E5C] outline-none placeholder:text-[#B5B0A4]"
              />
            </div>
            <button
              type="button"
              // 送信ボタンを押しても入力欄からフォーカスを外さず、キーボードを出したまま続けて答えられるようにする。
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void submitAnswer()}
              disabled={!canSend}
              aria-label={copy.submit}
              className={`mb-px flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white transition duration-200 ease-out active:scale-90 disabled:bg-[#E4DFD6] ${canSend ? "scale-100" : "scale-[0.92]"}`}
              style={canSend ? {
                background: `linear-gradient(180deg, ${accent} 0%, ${accentDeep} 100%)`,
                boxShadow: `0 6px 14px ${accent}55`,
              } : undefined}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] translate-x-px" fill="currentColor" aria-hidden="true">
                <path d="M3.4 20.4 21 12 3.4 3.6l.02 6.53L15 12 3.42 13.87z" />
              </svg>
            </button>
          </div>
          {(locale !== "ja" || draft.length > maxAnswerLength * 0.8) && (
            <div className="flex items-center justify-between px-2 pt-1 text-[11px] font-bold leading-4 text-[#A29C8F]">
              <span>{locale !== "ja" ? copy.answerHint : ""}</span>
              {draft.length > maxAnswerLength * 0.8 && (
                <span className={`tabular-nums ${draft.length > maxAnswerLength * 0.95 ? "text-[#E25563]" : ""}`}>
                  {draft.length}/{maxAnswerLength}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {screen === "purchase" && webV2 && treasureOpen && (
        <ResultUpgradeTreasure
          couponJpy={LINE_RESULT_UPGRADE_COUPON_JPY}
          listPriceJpy={LINE_RESULT_UPGRADE_LIST_PRICE_JPY}
          priceJpy={RESULT_UPGRADE_PRICE_JPY}
          purchaseCta={renderPurchaseButton()}
          onCouponReceived={() => {
            setGiftOpened(true);
            if (!preview) saveGiftOpened(ownerToken);
          }}
          onClose={() => setTreasureOpen(false)}
          onDismiss={() => {
            setTreasureOpen(false);
            setTreasureDismissed(true);
          }}
        />
      )}
    </div>
  );
}

type ChatItem = {
  key: string;
  kind: "alice" | "user" | "card";
  body: React.ReactNode;
  compact?: boolean;
  /** 質問の吹き出しなら何問目か（1始まり）。札を付けて今どこかを示す。 */
  question?: number;
  /** 自分の回答を送った時刻。 */
  time?: string;
};

function formatChatTime(date: Date, locale: ResultUpgradeLocale): string {
  return date.toLocaleTimeString(locale === "ko" ? "ko-KR" : "ja-JP", { hour: "2-digit", minute: "2-digit" });
}

// 吹き出しのしっぽ（LINEと同じく、続けて話すときは最初の吹き出しにだけ付ける）。
function BubbleTail({ side, color }: { side: "left" | "right"; color: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 14"
      className={`absolute top-0 h-[14px] w-[10px] ${side === "left" ? "-left-[7px]" : "-right-[7px] -scale-x-100"}`}
    >
      <path d="M10 0H2.5C.6 0-.4 2.2.9 3.6L10 14z" fill={color} />
    </svg>
  );
}

// 会話の表紙。夜の書斎でこちらを向いたAliceの絵に、7つの星を重ねる。
// 星は答えるたびに1つずつ灯り、表紙そのものが進み具合になる。
// 表紙で舞い上がる金の粉（位置・大きさ・速さを少しずつずらす）。
const COVER_DUST = [
  { left: "12%", bottom: "30%", size: 3, delay: "0s", duration: "6.5s" },
  { left: "26%", bottom: "18%", size: 2, delay: "1.8s", duration: "7.5s" },
  { left: "44%", bottom: "26%", size: 2.5, delay: "3.2s", duration: "6s" },
  { left: "63%", bottom: "20%", size: 2, delay: "0.9s", duration: "8s" },
  { left: "78%", bottom: "32%", size: 3, delay: "2.6s", duration: "7s" },
  { left: "90%", bottom: "16%", size: 2, delay: "4.1s", duration: "6.8s" },
];

function ChatWelcome({
  locale,
  questionCount,
  answeredCount,
}: {
  locale: ResultUpgradeLocale;
  questionCount: number;
  answeredCount: number;
}) {
  const ko = locale === "ko";
  return (
    // タロットカードをめくるように、裏面からクルリンと回って表になる。
    <div className="relative mx-auto mb-6 max-w-[360px] [perspective:1400px]">
    <div className="relative animate-cover-twirl [transform-style:preserve-3d]">
    <figure
      // 裏向きのあいだは表を消し、真横を向く瞬間に表と裏を入れ替える（ブラウザの裏面非表示だけに頼らない）。
      className="animate-cover-face-front relative overflow-hidden rounded-[28px] bg-[#16163A] shadow-[0_2px_4px_rgba(22,22,58,0.12),0_24px_48px_-16px_rgba(22,22,58,0.55)]"
    >
      <div className="relative aspect-[4/4.45]">
        {/* 絵の下3分の1（テーブルクロス）に文字を載せるため、下寄せで切り取る */}
        <SmoothImage
          src={ALICE_COVER_SRC}
          alt={ko ? "이쪽을 보며 웃고 있는 Alice" : "こちらを見てほほえむAlice"}
          fill
          sizes="360px"
          priority
          className="object-cover object-[50%_80%] animate-cover-light-on"
        />
        {/* 四隅を落として奥行きを出し、下は文字が読める夜色に沈める */}
        <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_32%,transparent_55%,rgba(12,12,36,0.55)_100%)]" />
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,transparent_52%,rgba(16,16,46,0.55)_70%,rgba(12,12,36,0.92)_100%)]" />
        {/* ランプの暖かい光 */}
        <span aria-hidden="true" className="absolute right-[2%] top-[34%] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,196,110,0.35),transparent_65%)] mix-blend-screen animate-pulse [animation-duration:4s]" />
        {/* 舞い上がる金の粉 */}
        {COVER_DUST.map((dust, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute rounded-full bg-[#FFE3A6] animate-cover-dust"
            style={{
              left: dust.left,
              bottom: dust.bottom,
              width: dust.size,
              height: dust.size,
              animationDelay: dust.delay,
              animationDuration: dust.duration,
              boxShadow: "0 0 6px rgba(255,214,130,0.9)",
            }}
          />
        ))}
        {/* 開いた瞬間に一度だけ走る光 */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -inset-y-10 left-0 w-1/3 rotate-[18deg] bg-[linear-gradient(90deg,transparent,rgba(255,240,205,0.28),transparent)] animate-cover-shine" />
        </span>
        {/* 絵本の表紙のような金の細い内枠 */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-[7px] rounded-[22px] border border-[#F3D68E]/35" />

        <figcaption className="absolute inset-x-0 bottom-0 px-6 pb-5">
          {ko ? (
            <>
              <p className="text-[13px] font-black tracking-[0.08em] text-[#F6D58C] animate-cover-rise [animation-delay:1500ms]">Alice의</p>
              <p className="mt-1 text-[30px] font-black leading-[1.15] tracking-[0.01em] text-white [text-shadow:0_2px_14px_rgba(10,10,35,0.7)] animate-cover-rise [animation-delay:1800ms]">일곱 가지 질문</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-black tracking-[0.12em] text-[#F6D58C] animate-cover-rise [animation-delay:1500ms]">Aliceからの</p>
              <p className="mt-1 text-[32px] font-black leading-[1.15] tracking-[0.02em] text-white [text-shadow:0_2px_14px_rgba(10,10,35,0.7)] animate-cover-rise [animation-delay:1800ms]">
                <span className="text-[#FFE3A6]">{questionCount}</span>つの質問
              </p>
            </>
          )}
          <div className="mt-4 flex items-center" aria-hidden="true">
            {Array.from({ length: questionCount }, (_, step) => {
              const lit = step < answeredCount;
              return (
                <span key={step} className="flex flex-1 items-center last:flex-none">
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-[18px] w-[18px] shrink-0 transition-all duration-700 ${lit ? "animate-cover-star-lit" : "animate-cover-star-pop"}`}
                    style={lit
                      ? { filter: "drop-shadow(0 0 6px rgba(255,212,120,0.9))" }
                      : { animationDelay: `${2150 + step * 150}ms` }}
                  >
                    <path
                      d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6-4.5-4.2 6.1-.7z"
                      fill={lit ? "#FFD47A" : "none"}
                      stroke={lit ? "#FFE7A8" : "rgba(255,255,255,0.45)"}
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {step < questionCount - 1 && (
                    <span
                      className="mx-1 h-px flex-1 transition-colors duration-700 animate-cover-rise"
                      style={{
                        background: step < answeredCount - 1 ? "rgba(255,212,122,0.7)" : "rgba(255,255,255,0.18)",
                        animationDelay: `${2230 + step * 150}ms`,
                      }}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </figcaption>
      </div>
    </figure>
    {/* カードの裏面 */}
    <div
      aria-hidden="true"
      className="animate-cover-face-back absolute inset-0 overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_50%_45%,#3A3780_0%,#1E1D4A_55%,#141333_100%)] shadow-[0_24px_48px_-16px_rgba(22,22,58,0.55)]"
      style={{ transform: "rotateY(180deg)" }}
    >
      <span className="absolute inset-[7px] rounded-[22px] border border-[#F3D68E]/45" />
      <span className="absolute inset-[13px] rounded-[18px] border border-dashed border-[#F3D68E]/25" />
      <svg viewBox="0 0 120 120" className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2">
        <circle cx="60" cy="60" r="44" fill="none" stroke="#F3D68E" strokeOpacity=".45" strokeWidth="1" />
        <circle cx="60" cy="60" r="36" fill="none" stroke="#F3D68E" strokeOpacity=".25" strokeWidth="1" strokeDasharray="2 4" />
        <path d="M60 14 66 52 104 60 66 68 60 106 54 68 16 60 54 52z" fill="#FFD47A" />
        <path d="M60 34 63 57 86 60 63 63 60 86 57 63 34 60 57 57z" fill="#FFF0C8" transform="rotate(45 60 60)" />
        <circle cx="60" cy="60" r="4" fill="#1E1D4A" />
      </svg>
      {[[18, 16], [82, 12], [12, 84], [86, 88], [50, 8], [50, 92]].map(([x, y]) => (
        <span key={`${x}-${y}`} className="absolute text-[10px] leading-none text-[#F3D68E]/70" style={{ left: `${x}%`, top: `${y}%` }}>✦</span>
      ))}
    </div>
    </div>
    </div>
  );
}

// LINEの「入力中」と同じく、吹き出しの中で3つの点が順に跳ねる。
function TypingDots({ locale }: { locale: ResultUpgradeLocale }) {
  const copy = RESULT_UPGRADE_COPY[locale];
  return (
    <span className="flex h-3 items-center gap-1.5" role="status" aria-label={copy.typingAria}>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-2 w-2 animate-bounce rounded-full bg-[#C9C2B4]"
          style={{ animationDelay: `${dot * 140}ms` }}
        />
      ))}
    </span>
  );
}

// 星座の点の位置（最大7つ）。ゆるいジグザグで横に並べる。
const CONSTELLATION_Y = [58, 26, 50, 18, 46, 24, 52];

function constellationPoints(count: number): Array<[number, number]> {
  const safeCount = Math.max(2, Math.min(count, CONSTELLATION_Y.length));
  return Array.from({ length: safeCount }, (_, i) => [
    18 + (i * 244) / (safeCount - 1),
    CONSTELLATION_Y[i],
  ]);
}

const PREPARING_STEPS: Record<ResultUpgradeLocale, string[]> = {
  ja: ["回答を読みこむ", "診断結果と照らし合わせる", "あなた専用の結果を準備する"],
  ko: ["답변 읽기", "진단 결과와 맞춰 보기", "나만의 결과 준비하기"],
};
// 各段階に入るタイミング（準備時間に対する割合）。
const PREPARING_STEP_AT = [0, 0.3, 0.62];

// 結果の準備中・生成中に出す夜空のカード。答えた星が金の線でつながり、その上を光が流れる。
// 準備中は待ち時間が決まっている（UPGRADE_PREPARATION_DELAY_MS）ので、段階と進み具合を見せる。
// 生成中はかかる時間が読めないため、段階は出さずに流れる光だけで「作っている」ことを伝える。
function StarWeavingCard({
  locale,
  mode,
  starCount,
}: {
  locale: ResultUpgradeLocale;
  mode: "preparing" | "generating";
  starCount: number;
}) {
  const copy = RESULT_UPGRADE_COPY[locale];
  const preparing = mode === "preparing";
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!preparing) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(timer);
  }, [preparing]);

  const points = constellationPoints(starCount);
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const progress = elapsed / UPGRADE_PREPARATION_DELAY_MS;
  const activeStep = PREPARING_STEP_AT.reduce((current, at, i) => (progress >= at ? i : current), 0);
  const title = preparing
    ? copy.preparingStatus
    : locale === "ko" ? "캐릭터와 리포트를 만드는 중" : "キャラクターと鑑定書を作成中";

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative ml-11 max-w-[300px] overflow-hidden rounded-[22px] bg-[linear-gradient(160deg,#2C2A64_0%,#1B1A42_100%)] px-4 pb-4 pt-3.5 text-white shadow-[0_14px_30px_-12px_rgba(27,26,66,0.55)]"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,206,120,0.28),transparent_65%)]" />
      <p className="relative flex items-center gap-2 text-[12px] font-black tracking-[0.02em] text-[#FFE3A6]">
        <span aria-hidden="true" className="inline-block animate-spin-slow text-[13px] leading-none">✦</span>
        {title}
      </p>

      <svg viewBox="0 0 280 76" className="relative mt-2 w-full overflow-visible" aria-hidden="true">
        <path d={path} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        <path
          d={path}
          pathLength={1}
          fill="none"
          stroke="#FFD47A"
          strokeOpacity=".75"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="1"
          className={preparing ? "animate-weave-draw" : ""}
          style={preparing ? { animationDuration: `${UPGRADE_PREPARATION_DELAY_MS * 0.85}ms` } : undefined}
        />
        {points.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="7" fill="rgba(255,212,122,0.18)" className="animate-cover-twinkle" style={{ animationDelay: `${i * 260}ms` }} />
            <path d="M0 -5.2 1.5 -1.5 5.2 0 1.5 1.5 0 5.2 -1.5 1.5 -5.2 0 -1.5 -1.5z" fill="#FFE3A6" />
          </g>
        ))}
        <circle r="3" fill="#FFF5D6" style={{ filter: "drop-shadow(0 0 4px #FFD47A)" }}>
          <animateMotion dur={preparing ? "2.6s" : "2.2s"} repeatCount="indefinite" path={path} />
        </circle>
      </svg>

      {preparing && (
        <ol className="relative mt-2.5 space-y-1.5">
          {PREPARING_STEPS[locale].map((step, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            return (
              <li
                key={step}
                className={`flex items-center gap-2 text-[12px] font-bold transition-colors duration-500 ${
                  done ? "text-white/60" : active ? "text-white" : "text-white/30"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-500 ${
                    done ? "border-[#FFD47A] bg-[#FFD47A] text-[#1B1A42]" : active ? "border-[#FFD47A]" : "border-white/25"
                  }`}
                >
                  {done ? (
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : active ? (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD47A]" />
                  ) : null}
                </span>
                {step}
              </li>
            );
          })}
        </ol>
      )}

      <div className="relative mt-3.5 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        {preparing ? (
          <span
            className="block h-full rounded-full bg-[linear-gradient(90deg,#E9B65C,#FFE3A6)] animate-weave-fill"
            style={{ animationDuration: `${UPGRADE_PREPARATION_DELAY_MS}ms` }}
          />
        ) : (
          <span className="block h-full w-2/5 rounded-full bg-[linear-gradient(90deg,transparent,#FFE3A6,transparent)] animate-weave-sweep" />
        )}
      </div>
    </div>
  );
}

// 宝箱が出るまでの読み込み中のカード（日本語Webの7問の会話）。宝箱が揺れて、金のバーが満ちたら開く演出へ進む。
function GiftLoadingCard() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative ml-11 flex max-w-[300px] items-center gap-3 overflow-hidden rounded-[22px] border border-[#F0D9A4] bg-[linear-gradient(160deg,#FFF9EA_0%,#FFEFC9_100%)] py-3 pl-3 pr-4 shadow-[0_12px_26px_-14px_rgba(154,106,36,0.5)]"
    >
      <div className="relative h-[76px] w-[76px] shrink-0">
        <span aria-hidden="true" className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(255,214,120,0.75),transparent_70%)] animate-pulse" />
        <SmoothImage
          src="/result-upgrade/treasure-closed.webp"
          alt=""
          width={76}
          height={79}
          className="relative h-full w-full object-contain animate-chest-wiggle"
        />
        <span aria-hidden="true" className="absolute -right-0.5 top-0 text-[11px] leading-none text-[#E2A93B] animate-cover-twinkle">✦</span>
        <span aria-hidden="true" className="absolute -left-0.5 bottom-3 text-[9px] leading-none text-[#E2A93B] animate-cover-twinkle [animation-delay:700ms]">✦</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black leading-snug text-[#7A4F0E]">プレゼントを用意しているよ</p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#F3DFAF]" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-[linear-gradient(90deg,#D9963A,#F7C766)] animate-weave-fill"
            style={{ animationDuration: `${GIFT_LOADING_DELAY_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
