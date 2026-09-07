"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId, type UIMessage } from "ai";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import { useCheckoutCancelledProduct } from "@/components/checkout/CheckoutCancelledNotice";
import LineAliceLinkCard from "@/components/result/LineAliceLinkCard";
import { PaywallOverlay } from "@/components/result/PaywallModal";
import { HOSHIYOMI_COPY } from "@/i18n/hoshiyomi";
import type { ResultLocale } from "@/i18n/result";
import type { HoshiyomiConversationSummary } from "@/lib/hoshiyomi/store";
import { track } from "@/lib/track";

// 両言語とも現行の完全版で30回答を解放する。旧完全版は購入世代の回数を維持する。
const CHAT_ACCESS_PRODUCTS = ["full_access", "premium_bundle"] as const;

type ActiveConversation = {
  id: string;
  messages: UIMessage[];
  starter?: string;
};

type Props = {
  selectedConversation: HoshiyomiConversationSummary | null;
  initialRemaining: number;
  totalCredits: number;
  persistenceReady: boolean;
  hasChatAccess?: boolean;
  canUpgradeToPremium?: boolean;
  ownerToken?: string;
  previewMode?: boolean;
  locale?: ResultLocale;
};

export function HoshiyomiClient({
  selectedConversation,
  initialRemaining,
  totalCredits,
  persistenceReady,
  hasChatAccess = true,
  canUpgradeToPremium = false,
  ownerToken,
  previewMode = false,
  locale = "ja",
}: Props) {
  const cancelledProduct = useCheckoutCancelledProduct();
  const [remaining, setRemaining] = useState(initialRemaining);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [lineExitOpen, setLineExitOpen] = useState(false);
  const [active, setActive] = useState<ActiveConversation | null>(() =>
    selectedConversation
      ? { id: selectedConversation.id, messages: selectedConversation.messages }
      : null,
  );
  const pageViewTrackedRef = useRef(false);

  useEffect(() => {
    if (previewMode || pageViewTrackedRef.current) return;
    pageViewTrackedRef.current = true;
    track("hoshiyomi_page_viewed", {
      metadata: {
        access_state: hasChatAccess ? "unlocked" : "locked",
        surface: selectedConversation ? "conversation" : "home",
      },
    });
  }, [hasChatAccess, previewMode, selectedConversation]);

  useEffect(() => {
    if (
      previewMode ||
      (cancelledProduct !== "full_access" &&
        cancelledProduct !== "premium_bundle")
    ) {
      return;
    }
    const timer = window.setTimeout(() => setPaywallOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [cancelledProduct, hasChatAccess, previewMode]);

  const startConversation = (text: string) => {
    const prompt = text.trim();
    if (!prompt || !persistenceReady) return;
    if (!hasChatAccess) {
      track("hoshiyomi_paywall_opened", {
        metadata: { source: "first_send" },
      });
      setPaywallOpen(true);
      return;
    }
    if (remaining <= 0) {
      if (canUpgradeToPremium) {
        track("hoshiyomi_paywall_opened", {
          metadata: { source: "trial_exhausted" },
        });
        setPaywallOpen(true);
      }
      return;
    }
    if (previewMode) {
      setRemaining((current) => Math.max(0, current - 1));
    }
    setActive({ id: generateId(), messages: [], starter: prompt });
  };

  const openNew = () => {
    setActive(null);
    window.history.replaceState(
      null,
      "",
      previewMode
        ? "/dev/hoshiyomi-preview"
        : `${locale === "ko" ? "/ko" : ""}/hoshiyomi`,
    );
  };

  const handlePaywallExitAttempt = () => {
    if (lineExitOpen) return;
    if (locale === "ja" && !previewMode) {
      setLineExitOpen(true);
      return;
    }
    setPaywallOpen(false);
  };

  const closeLineExitFlow = () => {
    setLineExitOpen(false);
    setPaywallOpen(false);
  };

  if (active) {
    return (
      <main className="min-h-[calc(100dvh-56px)] bg-[#F7F7FC] text-[#2E2E5C]">
        {previewMode ? (
          <PreviewChatPanel
            key={active.id}
            conversation={active}
            remaining={remaining}
            totalCredits={totalCredits}
            locale={locale}
            onRemainingChange={(delta) =>
              setRemaining((current) =>
                Math.max(0, Math.min(totalCredits, current + delta)),
              )
            }
            onBack={openNew}
          />
        ) : (
          <RealChatPanel
            key={active.id}
            conversation={active}
            remaining={remaining}
            totalCredits={totalCredits}
            locale={locale}
            onRemainingChange={(delta) =>
              setRemaining((current) =>
                Math.max(0, Math.min(totalCredits, current + delta)),
              )
            }
            onBack={openNew}
          />
        )}
      </main>
    );
  }

  return (
    <>
      {locale === "ko" ? <KoTopHeader /> : <TopHeader />}
      <main className="bg-gradient-to-br from-[#F3F0FF] via-white to-[#FFF8E8] text-[#2E2E5C]">
        <HoshiyomiHome
          remaining={remaining}
          totalCredits={totalCredits}
          persistenceReady={persistenceReady}
          hasChatAccess={hasChatAccess}
          canUpgradeToPremium={canUpgradeToPremium}
          ownerToken={ownerToken}
          previewMode={previewMode}
          locale={locale}
          onStart={startConversation}
        />
      </main>
      {locale === "ko" ? <KoTopFooter /> : <TopFooter />}
      {paywallOpen ? (
        <PaywallOverlay
          ownerToken={ownerToken}
          returnTo="hoshiyomi"
          ctaSource="hoshiyomi_first_send"
          products={
            canUpgradeToPremium
              ? (["premium_bundle"] as const)
              : CHAT_ACCESS_PRODUCTS
          }
          defaultProduct={
            canUpgradeToPremium ? "premium_bundle" : "full_access"
          }
          heading={
            locale === "ja"
              ? canUpgradeToPremium
                ? "Aliceとの続きを解放する"
                : "Aliceを試す・本格相談を選ぶ"
              : undefined
          }
          previewMode={previewMode}
          locale={locale}
          // PC ではカードが画像つき2カラムになるようヒーローと同じ Alice 画像を渡す
          // (SP はカード側の hidden md:flex で画像非表示のため影響なし)。
          imageSrc="/mascot/hoshiyomi-alice-writing-transparent.png"
          imageAlt={locale === "ko" ? "별자리 상담사" : "AI占い師 Alice"}
          scrollLocked={lineExitOpen}
          onClose={handlePaywallExitAttempt}
        />
      ) : null}
      {lineExitOpen ? (
        <HoshiyomiLineExitModal
          ownerToken={ownerToken}
          onClose={closeLineExitFlow}
        />
      ) : null}
    </>
  );
}

function HoshiyomiHome({
  remaining,
  totalCredits,
  persistenceReady,
  hasChatAccess,
  canUpgradeToPremium,
  ownerToken,
  previewMode,
  locale,
  onStart,
}: {
  remaining: number;
  totalCredits: number;
  persistenceReady: boolean;
  hasChatAccess: boolean;
  canUpgradeToPremium: boolean;
  ownerToken?: string;
  previewMode: boolean;
  locale: ResultLocale;
  onStart: (text: string) => void;
}) {
  const copy = HOSHIYOMI_COPY[locale];
  const [input, setInput] = useState("");
  const [faqOpen, setFaqOpen] = useState(false);
  const faqButtonRef = useRef<HTMLButtonElement>(null);
  const canCompose =
    persistenceReady &&
    (!hasChatAccess || remaining > 0 || canUpgradeToPremium);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    onStart(input);
  };

  return (
    <>
      <section className="relative overflow-hidden px-5 pb-8 pt-8 md:px-8 md:pb-8 md:pt-12">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#CFC9FF]/30 blur-3xl" />
        <div className="relative mx-auto max-w-[1040px] md:grid md:grid-cols-2 md:items-start md:gap-x-10 lg:gap-x-14">
          <h1 className="text-[32px] font-black leading-[1.25] md:col-start-1 md:row-start-1 md:text-[48px]">
            {copy.title}
          </h1>

          {/* 画像: SPはタイトル直下 (SP順 = タイトル→画像→サブタイトル→入力)。
              PC(md+)は右カラム(col2)へ回し、左のテキスト3行ぶんの高さに対して縦中央寄せにする。 */}
          <div className="mt-6 w-full md:col-start-2 md:row-start-1 md:row-span-3 md:mt-0 md:self-center">
            <Image
              src="/mascot/hoshiyomi-alice-writing-transparent.png"
              alt={copy.heroAlt}
              width={1638}
              height={960}
              priority
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1100px) calc(50vw - 40px), 500px"
              className="h-auto w-full object-contain"
            />
          </div>

          <p className="mt-4 max-w-[600px] text-[15px] font-medium leading-[1.9] text-[#2E2E5C]/65 md:col-start-1 md:row-start-2 md:mt-5 md:text-[17px]">
            {copy.description}
          </p>

          <div className="max-w-[760px] md:col-start-1 md:row-start-3">
            <form onSubmit={submit} className="mt-7">
              <div className="flex items-center gap-2 rounded-2xl border border-[#5B5BEF]/20 bg-white p-2 shadow-[0_12px_34px_rgba(46,46,92,0.10)] focus-within:border-[#5B5BEF]/50">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={1200}
                  disabled={!canCompose}
                  placeholder={
                    canUpgradeToPremium && remaining === 0
                      ? locale === "ko"
                        ? copy.exhaustedPlaceholder
                        : "Aliceとの続きを相談する"
                      : hasChatAccess && remaining === 0
                      ? copy.exhaustedPlaceholder
                      : copy.inputPlaceholder
                  }
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[16px] font-medium outline-none placeholder:text-[#2E2E5C]/30 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  aria-label={copy.startAria}
                  disabled={!input.trim() || !canCompose}
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[#5B5BEF] text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ArrowIcon />
                </button>
              </div>
            </form>

            {hasChatAccess ? (
              <HomeUsageMeter
                remaining={remaining}
                total={totalCredits}
                locale={locale}
                faqButtonRef={faqButtonRef}
                onOpenFaq={() => setFaqOpen(true)}
              />
            ) : (
              <p className="mt-4 text-[12px] font-bold leading-relaxed text-[#2E2E5C]/55 md:text-[13px]">
                {copy.purchaseHint}{" "}
                <FaqTextButton
                  locale={locale}
                  buttonRef={faqButtonRef}
                  onClick={() => setFaqOpen(true)}
                />
              </p>
            )}
            {!persistenceReady && (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800">
                {copy.persistencePending}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1040px] px-5 pb-10 pt-4 md:px-8 md:pb-14 md:pt-6">
        {/* LINE連携 (Alice Plus)。ja限定 */}
        {locale === "ja" && !previewMode ? (
          <LineAliceLinkCard
            ownerToken={ownerToken}
            trackingSource="hoshiyomi_home"
          />
        ) : null}

        <p className="mt-10 text-center text-[11px] font-medium leading-relaxed text-[#2E2E5C]/40">
          {copy.entertainmentNotice}
        </p>
      </section>
      {faqOpen ? (
        <HoshiyomiFaqModal
          locale={locale}
          onClose={() => {
            setFaqOpen(false);
            window.requestAnimationFrame(() => faqButtonRef.current?.focus());
          }}
        />
      ) : null}
    </>
  );
}

function HoshiyomiFaqModal({
  locale,
  onClose,
}: {
  locale: ResultLocale;
  onClose: () => void;
}) {
  const copy = HOSHIYOMI_COPY[locale];
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hoshiyomi-faq-title"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#2E2E5C]/55 px-3 py-4 backdrop-blur-[2px] md:px-6 md:py-8"
      onClick={onClose}
    >
      <section
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[860px] overflow-y-auto overscroll-contain rounded-[24px] bg-white px-5 pb-6 pt-7 shadow-[0_24px_80px_rgba(30,30,65,0.28)] md:max-h-[calc(100dvh-4rem)] md:rounded-[28px] md:px-10 md:pb-10 md:pt-9"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.closeAria}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#2E2E5C]/10 bg-white text-[#2E2E5C]/55 transition hover:bg-[#F5F5FA] hover:text-[#2E2E5C] md:right-5 md:top-5"
        >
          <CloseIcon />
        </button>

        <h2
          id="hoshiyomi-faq-title"
          className="pr-12 text-[28px] font-black leading-tight text-[#2E2E5C] md:text-[36px]"
        >
          {copy.faqTitle}
        </h2>

        <div className="mt-5 border-t border-[#2E2E5C]/10 md:mt-6">
          {copy.faqs.map((faq, index) => (
            <details
              key={faq.question}
              open={index === 0}
              className="group border-b border-[#2E2E5C]/10"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left text-[15px] font-black leading-relaxed text-[#2E2E5C] outline-none transition hover:text-[#5B5BEF] focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/35 md:py-6 md:text-[17px] [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <span
                  aria-hidden="true"
                  className="relative h-5 w-5 flex-none text-[#5B5BEF]"
                >
                  <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
                  <span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-opacity group-open:opacity-0" />
                </span>
              </summary>
              <p className="pb-5 pr-3 text-[14px] font-medium leading-[1.9] text-[#2E2E5C]/72 md:pb-6 md:pr-10 md:text-[16px]">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] font-bold text-[#2E2E5C]/40">
          {copy.contactPrefix}
          <Link href="mailto:support@watashi-torisetsu.com" className="text-[#5B5BEF] underline underline-offset-2">
            {copy.contactLabel}
          </Link>
          {copy.contactSuffix}
        </p>
      </section>
    </div>,
    document.body,
  );
}

function HoshiyomiLineExitModal({
  ownerToken,
  onClose,
}: {
  ownerToken?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="LINEでもAliceと話す"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#2E2E5C]/35 px-3 py-5 backdrop-blur-[2px] md:py-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1120px] px-3 pb-6 pt-10 md:px-6 md:pb-10"
        onClick={(event) => event.stopPropagation()}
      >
        <LineAliceLinkCard
          ownerToken={ownerToken}
          trackingSource="hoshiyomi_paywall_exit"
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}

function RealChatPanel({
  conversation,
  remaining,
  totalCredits,
  locale,
  onRemainingChange,
  onBack,
}: {
  conversation: ActiveConversation;
  remaining: number;
  totalCredits: number;
  locale: ResultLocale;
  onRemainingChange: (delta: number) => void;
  onBack: () => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/hoshiyomi/chat",
        prepareSendMessagesRequest({ id, messages }) {
          return { body: { id, message: messages.at(-1), locale } };
        },
      }),
    [locale],
  );
  const rolledBackRef = useRef(false);
  const {
    messages,
    sendMessage,
    status,
    error,
    clearError,
  } = useChat({
    id: conversation.id,
    messages: conversation.messages,
    transport,
    onError: () => {
      track("hoshiyomi_response_failed");
      if (!rolledBackRef.current) {
        rolledBackRef.current = true;
        onRemainingChange(1);
      }
    },
    onFinish: ({ isAbort, isDisconnect, isError }) => {
      if (isAbort || isDisconnect || isError) {
        if (!rolledBackRef.current) track("hoshiyomi_response_failed");
        return;
      }
      track("hoshiyomi_response_completed");
      // 会話本文と残回数はuseChat/local stateに反映済み。URLだけを同期し、
      // 動的ページのRSC再取得を毎メッセージ発生させない。
      window.history.replaceState(
        null,
        "",
        `${locale === "ko" ? "/ko" : ""}/hoshiyomi?chat=${conversation.id}`,
      );
    },
  });
  const [input, setInput] = useState("");
  const initialSentRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isBusy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    const value = text.trim();
    if (!value || isBusy || remaining === 0) return;
    rolledBackRef.current = false;
    clearError();
    onRemainingChange(-1);
    track("hoshiyomi_message_sent", {
      metadata: {
        conversation_state: messages.some((message) => message.role === "user")
          ? "continuing"
          : "first_message",
      },
    });
    void sendMessage({ text: value });
    setInput("");
  };

  useEffect(() => {
    if (!conversation.starter || initialSentRef.current) return;
    initialSentRef.current = true;
    send(conversation.starter);
  });

  useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: status === "streaming" ? "auto" : "smooth",
    });
  }, [messages, status]);

  return (
    <ChatShell
      remaining={remaining}
      total={totalCredits}
      locale={locale}
      onBack={onBack}
      messages={messages}
      viewportRef={viewportRef}
      input={input}
      setInput={setInput}
      onSend={send}
      isBusy={isBusy}
      error={error ? HOSHIYOMI_COPY[locale].responseError : null}
    />
  );
}

function PreviewChatPanel({
  conversation,
  remaining,
  totalCredits,
  locale,
  onRemainingChange,
  onBack,
}: {
  conversation: ActiveConversation;
  remaining: number;
  totalCredits: number;
  locale: ResultLocale;
  onRemainingChange: (delta: number) => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<UIMessage[]>(() =>
    conversation.starter
      ? [
          ...conversation.messages,
          {
            id: generateId(),
            role: "user",
            parts: [{ type: "text", text: conversation.starter }],
          },
          {
            id: generateId(),
            role: "assistant",
            parts: [
              {
                type: "text",
                text: HOSHIYOMI_COPY[locale].previewResponse,
              },
            ],
          },
        ]
      : conversation.messages,
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || busy || remaining === 0) return;
    onRemainingChange(-1);
    setInput("");
    setBusy(true);
    setMessages((current) => [
      ...current,
      { id: generateId(), role: "user", parts: [{ type: "text", text: value }] },
    ]);
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: generateId(),
          role: "assistant",
          parts: [
            {
              type: "text",
              text: HOSHIYOMI_COPY[locale].previewResponse,
            },
          ],
        },
      ]);
      setBusy(false);
    }, 700);
  };

  return (
    <ChatShell
      remaining={remaining}
      total={totalCredits}
      locale={locale}
      onBack={onBack}
      messages={messages}
      viewportRef={viewportRef}
      input={input}
      setInput={setInput}
      onSend={send}
      isBusy={busy}
      error={null}
    />
  );
}

function ChatShell({
  remaining,
  total,
  locale,
  onBack,
  messages,
  viewportRef,
  input,
  setInput,
  onSend,
  isBusy,
  error,
}: {
  remaining: number;
  total: number;
  locale: ResultLocale;
  onBack: () => void;
  messages: UIMessage[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  input: string;
  setInput: (value: string) => void;
  onSend: (value: string) => void;
  isBusy: boolean;
  error: string | null;
}) {
  const copy = HOSHIYOMI_COPY[locale];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSend(input);
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend(input);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-56px)] max-w-[920px] flex-col bg-white shadow-[0_0_40px_rgba(46,46,92,0.06)]">
      <header className="flex items-center gap-3 border-b border-[#2E2E5C]/[0.07] bg-white px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label={copy.backAria}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[#2E2E5C]/55 transition hover:bg-[#2E2E5C]/5"
        >
          <BackIcon />
        </button>
        <div className="relative h-12 w-12 flex-none overflow-hidden rounded-full bg-[#F0EDFF] ring-2 ring-white shadow-sm">
          <Image src="/mascot/hoshiyomi-alice-avatar-transparent.png" alt="" fill sizes="48px" className="object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-black md:text-[18px]">{copy.guideName}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-[#2E2E5C]/42">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> {copy.guideStatus}
          </p>
        </div>
        <div className="hidden w-32 md:block">
          <UsageMeter remaining={remaining} total={total} locale={locale} compact />
        </div>
      </header>

      <div ref={viewportRef} className="flex-1 overflow-y-auto bg-[#FAFAFE] px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[720px] space-y-5">
          {messages.map((message) => {
            const text = message.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("");
            if (!text) return null;
            return message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[86%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-[#5B5BEF] px-4 py-3 text-[14px] font-medium leading-[1.75] text-white md:max-w-[76%] md:text-[15px]">
                  {text}
                </div>
              </div>
            ) : (
              <AssistantMessage key={message.id}>{text}</AssistantMessage>
            );
          })}

          {isBusy && messages.at(-1)?.role === "user" && (
            <div className="flex items-end gap-2.5">
              <GuideAvatar />
              <div className="flex items-center gap-1 rounded-[20px] rounded-bl-md bg-white px-4 py-4 shadow-sm ring-1 ring-[#2E2E5C]/[0.05]">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5B5BEF]/45"
                    style={{ animationDelay: `${index * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">{error}</p>}
        </div>
      </div>

      <div className="border-t border-[#2E2E5C]/[0.07] bg-white px-4 pb-3 pt-3 md:px-6">
        <div className="mx-auto max-w-[720px]">
          <div className="mb-2 md:hidden">
            <UsageMeter remaining={remaining} total={total} locale={locale} compact />
          </div>
          <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-[#2E2E5C]/12 bg-[#FAFAFE] p-2 focus-within:border-[#5B5BEF]/45">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={keyDown}
              rows={1}
              maxLength={1200}
              disabled={isBusy || remaining === 0}
              placeholder={remaining > 0 ? copy.composerPlaceholder : copy.exhaustedPlaceholder}
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-[#2E2E5C]/30 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              aria-label={copy.sendAria}
              disabled={!input.trim() || isBusy || remaining === 0}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#5B5BEF] text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowIcon />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] font-medium text-[#2E2E5C]/32">
            {copy.chatNotice}
          </p>
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2.5">
      <GuideAvatar />
      <div className="max-w-[86%] whitespace-pre-wrap rounded-[22px] rounded-bl-md bg-white px-4 py-3 text-[14px] font-medium leading-[1.8] text-[#2E2E5C]/80 shadow-sm ring-1 ring-[#2E2E5C]/[0.05] md:max-w-[76%] md:px-5 md:py-4 md:text-[15px]">
        {children}
      </div>
    </div>
  );
}

function GuideAvatar() {
  return (
    <div className="relative h-9 w-9 flex-none overflow-hidden rounded-full bg-[#F0EDFF]">
      <Image src="/mascot/hoshiyomi-alice-avatar-transparent.png" alt="" fill sizes="36px" className="object-contain" />
    </div>
  );
}

function HomeUsageMeter({
  remaining,
  total,
  locale,
  faqButtonRef,
  onOpenFaq,
}: {
  remaining: number;
  total: number;
  locale: ResultLocale;
  faqButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenFaq: () => void;
}) {
  const copy = HOSHIYOMI_COPY[locale];
  const safeRemaining = Math.max(0, Math.min(total, remaining));
  const used = Math.max(0, total - safeRemaining);
  const percent = total > 0 ? (used / total) * 100 : 0;

  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-[#2E2E5C]/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#5B5BEF] to-[#9B73D5] transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-[12px] font-bold leading-relaxed text-[#2E2E5C]/55 md:text-[13px]">
        <span className="font-black text-[#2E2E5C]/80">
          {copy.sentMessages(used, total)}
        </span>
        {" "}
        <FaqTextButton locale={locale} buttonRef={faqButtonRef} onClick={onOpenFaq} />
      </p>
    </div>
  );
}

function FaqTextButton({
  locale,
  buttonRef,
  onClick,
}: {
  locale: ResultLocale;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className="font-black text-[#5B5BEF] underline decoration-[#5B5BEF]/40 decoration-1 underline-offset-4 transition-colors hover:text-[#4545D8] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B5BEF]"
    >
      {HOSHIYOMI_COPY[locale].faqButton}
    </button>
  );
}

function UsageMeter({
  remaining,
  total,
  locale,
  compact = false,
}: {
  remaining: number;
  total: number;
  locale: ResultLocale;
  compact?: boolean;
}) {
  const safeRemaining = Math.max(0, Math.min(total, remaining));
  const percent = total > 0 ? (safeRemaining / total) * 100 : 0;
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#2E2E5C]/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#5B5BEF] to-[#9B73D5] transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className={`mt-1.5 font-bold text-[#2E2E5C]/45 ${compact ? "text-[10px]" : "text-[11px]"}`}>
        {HOSHIYOMI_COPY[locale].remainingMessages(safeRemaining, total)}
      </p>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
