"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { DiagnosisHero } from "@/components/diagnosis/DiagnosisHero";
import { LikertScale } from "@/components/diagnosis/LikertScale";
import { EN_FRIEND_QUESTIONS, enFriendQuestion } from "@/i18n/en/friend";
import { track } from "@/lib/track";
import type { AnswerValue } from "@/lib/types";

type Phase = "questions" | "message" | "error";
const PAGE_SIZE = 10;

export default function EnFriendDiagnosisPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = use(params);
  const router = useRouter();
  const [subjectName, setSubjectName] = useState("your friend");
  const [yourName, setYourName] = useState("");
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<Phase>("questions");
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const landed = useRef(false);

  useEffect(() => {
    fetch(`/api/friend-info?code=${encodeURIComponent(inviteCode)}`)
      .then(async (response) => {
        if (response.status === 404) {
          setInvalid(true);
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (data?.displayName) setSubjectName(data.displayName);
        if (data) {
          landed.current = true;
          track("friend_landing_viewed", {
            inviteCode,
            metadata: { locale: "en" },
          });
        }
      })
      .catch(() => {});
  }, [inviteCode]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page, phase]);

  const pageQuestions = EN_FRIEND_QUESTIONS.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );
  const pageComplete = pageQuestions.every(
    (_, index) => answers[page * PAGE_SIZE + index + 1] !== undefined,
  );

  function answer(questionId: number, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    if (!started.current) {
      started.current = true;
      track("friend_answer_started", {
        inviteCode,
        metadata: { locale: "en", questionId },
      });
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/friend-answer/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          scaleAnswers: answers,
          perceiverName: yourName.trim(),
          message: message.trim(),
          pdfConsent: false,
          locale: "en",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.friendPerceptionId)
        throw new Error(data?.error ?? "We couldn't save your answers.");
      if (!landed.current) {
        landed.current = true;
        track("friend_landing_viewed", {
          inviteCode,
          metadata: { locale: "en" },
        });
      }
      track("friend_answer_completed", {
        inviteCode,
        metadata: { locale: "en", perceivedTypeId: data.perception?.typeId },
      });
      router.push(`/en/evaluate/sent/${data.friendPerceptionId}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
      setPhase("error");
    }
  }

  if (invalid) {
    return (
      <Shell>
        <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <p className="text-4xl">🔗</p>
          <h1 className="mt-5 text-3xl font-black text-[#2E2E5C]">
            This invitation is no longer available
          </h1>
          <p className="mt-4 leading-relaxed text-[#68687D]">
            Ask your friend for a new link, or discover your own personality
            first.
          </p>
          <a
            href="/en/diagnosis"
            className="mt-8 rounded-full bg-[#5B5BEF] px-8 py-4 font-bold text-white"
          >
            Take my personality test
          </a>
        </main>
      </Shell>
    );
  }

  if (phase === "message") {
    return (
      <Shell>
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#5B5BEF]">
            One last thing
          </p>
          <h1 className="mt-3 text-3xl font-black text-[#2E2E5C] sm:text-4xl">
            Leave {subjectName} a note
          </h1>
          <p className="mt-4 leading-relaxed text-[#68687D]">
            This is optional. Your note will be shown privately with your
            answers.
          </p>
          <label
            htmlFor="friend-message"
            className="mt-8 block font-bold text-[#2E2E5C]"
          >
            Message{" "}
            <span className="font-normal text-[#77778D]">(optional)</span>
          </label>
          <textarea
            id="friend-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={200}
            rows={6}
            className="mt-3 w-full rounded-2xl border border-[#2E2E5C]/20 p-4 text-[#2E2E5C] outline-none focus:border-[#5B5BEF] focus:ring-2 focus:ring-[#5B5BEF]/20"
            placeholder="Something you appreciate about them…"
          />
          <p className="mt-2 text-right text-xs text-[#77778D]">
            {message.length}/200
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-full bg-[#5B5BEF] px-8 py-4 font-bold text-white disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send my answers"}
            </button>
            <button
              type="button"
              onClick={() => setPhase("questions")}
              disabled={submitting}
              className="rounded-full border border-[#2E2E5C]/20 px-8 py-4 font-bold text-[#2E2E5C]"
            >
              Back
            </button>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-[#77778D]">
            Your responses are used to compare how you see this person with how
            they see themselves. They are not a clinical assessment.
          </p>
        </main>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <p className="text-4xl">😵‍💫</p>
          <h1 className="mt-5 text-3xl font-black text-[#2E2E5C]">
            Your answers weren’t sent
          </h1>
          <p className="mt-4 text-[#68687D]">{error}</p>
          <button
            type="button"
            onClick={() => {
              setPhase("message");
              void submit();
            }}
            className="mt-8 rounded-full bg-[#5B5BEF] px-8 py-4 font-bold text-white"
          >
            Try again
          </button>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <DiagnosisHero
        title={`How do you see ${subjectName}?`}
        subtitle="Answer 30 quick questions. There are no right or wrong answers—choose what feels closest."
        imageSrc="/mascot/friend-hero.png"
        imageAlt="Two friends chatting"
      />
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pb-16 pt-8 md:px-8">
        <div className="mb-8">
          <div className="flex justify-between text-sm font-bold text-[#68687D]">
            <span>Part {page + 1} of 3</span>
            <span>{Object.keys(answers).length}/30 answered</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECECF7]">
            <div
              className="h-full rounded-full bg-[#F4C84A] transition-all"
              style={{ width: `${((page + 1) / 3) * 100}%` }}
            />
          </div>
        </div>
        {page === 0 ? (
          <div className="mb-8 rounded-2xl border border-[#2E2E5C]/10 p-6 shadow-sm">
            <label
              htmlFor="friend-name"
              className="block text-center text-xl font-extrabold text-[#2E2E5C]"
            >
              What should we call you?
            </label>
            <p className="mt-2 text-center text-sm text-[#77778D]">
              This name will appear next to your answers.
            </p>
            <input
              id="friend-name"
              value={yourName}
              onChange={(event) => setYourName(event.target.value)}
              maxLength={20}
              autoComplete="nickname"
              className="mx-auto mt-5 block w-full max-w-md rounded-xl border border-[#2E2E5C]/20 px-4 py-3 text-center text-lg font-bold outline-none focus:border-[#5B5BEF] focus:ring-2 focus:ring-[#5B5BEF]/20"
            />
          </div>
        ) : null}
        {pageQuestions.map((question, index) => {
          const id = page * PAGE_SIZE + index + 1;
          return (
            <section
              key={id}
              className={`border-b border-[#2E2E5C]/10 py-9 transition-opacity ${answers[id] ? "opacity-60 hover:opacity-100 focus-within:opacity-100" : ""}`}
            >
              <p className="mx-auto mb-7 max-w-3xl text-center text-lg font-bold leading-relaxed text-[#2E2E5C] sm:text-xl">
                {enFriendQuestion(id - 1, subjectName)}
              </p>
              <LikertScale
                value={answers[id]}
                onChange={(value) => answer(id, value)}
                leftLabel="Strongly agree"
                rightLabel="Strongly disagree"
                optionLabels={{
                  7: "Strongly agree",
                  6: "Agree",
                  5: "Slightly agree",
                  4: "Neutral",
                  3: "Slightly disagree",
                  2: "Disagree",
                  1: "Strongly disagree",
                }}
                size="lg"
              />
            </section>
          );
        })}
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={!pageComplete || (page === 0 && !yourName.trim())}
            onClick={() =>
              page < 2 ? setPage((value) => value + 1) : setPhase("message")
            }
            className="rounded-full bg-[#5B5BEF] px-10 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {page < 2 ? "Continue" : "Finish questions"}
          </button>
          {page > 0 ? (
            <button
              type="button"
              onClick={() => setPage((value) => value - 1)}
              className="px-6 py-3 font-bold text-[#5B5BEF]"
            >
              Back
            </button>
          ) : null}
          {page === 0 && pageComplete && !yourName.trim() ? (
            <p className="text-sm font-bold text-[#C84F86]">
              Please enter your name to continue.
            </p>
          ) : null}
        </div>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <EnSiteHeader />
      {children}
      <EnSiteFooter />
    </div>
  );
}
