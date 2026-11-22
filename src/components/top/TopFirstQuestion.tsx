"use client";

// トップページに置く「1問目」。ボタンを押して診断ページへ移る1段階をなくし、
// 着いた画面でそのまま答え始められるようにする。答えは診断ページへ引き継ぐ。
import { LikertScale } from "@/components/diagnosis/LikertScale";
import {
  FIRST_ANSWER_VEIL_IN_MS,
  saveFirstAnswerHandoff,
  startFirstAnswerVeil,
} from "@/lib/first-answer-handoff";
import { phraseWrapJa } from "@/lib/ja-phrase";
import { track } from "@/lib/track";
import type { AnswerValue } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface FirstQuestionProps {
  questionSet: string;
  questionId: number;
  questionText: string;
  totalQuestions: number;
}

// この時間 (画面が見えている状態で) 押されなければ、1問目を小窓で出す。
const SHOW_QUESTION_AFTER_MS = 5000;
// 出た直後の押し間違い (ボタンを押そうとして○や背景に触れる) を防ぐ時間。演出が落ち着くまで。
const TAP_GUARD_MS = 1200;
// 出す何ミリ秒前から、見えない状態で用意しておくか。
const PREPARE_BEFORE_MS = 900;
const ALICE_SRC = "/mascot/top-question-alice-talk.webp";

// 今までと同じ画面とボタンはそのままに、しばらく押されなければ1問目を小窓 (モーダル) で出す。
// すぐ押す人には今までどおり、迷っている人には「答えるだけ」の入口を出す。
export function TopQuestionModal(question: FirstQuestionProps) {
  // idle: まだ何も置かない / ready: 見えない状態で用意済み / open: 表示中 / closed: 閉じた
  const [phase, setPhase] = useState<"idle" | "ready" | "open" | "closed">("idle");
  const [guarded, setGuarded] = useState(true);
  const open = phase === "open";
  const close = () => setPhase("closed");

  useEffect(() => {
    let visibleMs = 0;
    let last = document.visibilityState === "visible" ? performance.now() : null;
    // 裏に回っている間は数えない (戻ってきた瞬間に出ないように)。
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible") {
        if (last !== null) visibleMs += now - last;
        last = now;
      } else {
        last = null;
      }
      // 出す少し前に、見えない状態で組み立てておく (Alice の絵も先に読み込んで展開しておく)。
      // 出す瞬間の仕事を「印を付けるだけ」にして、最初のコマが引っかからないようにする。
      if (visibleMs >= SHOW_QUESTION_AFTER_MS - PREPARE_BEFORE_MS) {
        setPhase((p) => (p === "idle" ? "ready" : p));
      }
      if (visibleMs < SHOW_QUESTION_AFTER_MS) return;
      // メニューや言語切替など、ほかの小窓を開いている間は割り込まない (閉じたら出す)。
      if (document.querySelector("dialog[open], [aria-modal='true']")) return;
      window.clearInterval(timer);
      setPhase((p) => (p === "ready" || p === "idle" ? "open" : p));
      window.setTimeout(() => setGuarded(false), TAP_GUARD_MS);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  // 開いている間は背景をスクロールさせず、Esc で閉じられるようにする。
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("closed");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (phase !== "ready") return;
    const img = new Image();
    img.src = ALICE_SRC;
    img.decode?.().catch(() => {});
  }, [phase]);

  if (phase === "idle" || phase === "closed") return null;
  // ヒーローの重なり順に閉じ込められないよう、body 直下に出す (ヘッダーの上にも幕がかかる)。
  return createPortal(
    <div
      role={open ? "dialog" : undefined}
      aria-modal={open ? true : undefined}
      aria-hidden={open ? undefined : true}
      aria-label="診断の1問目"
      className={`top-question-backdrop fixed inset-0 z-[1000] flex items-center justify-center bg-[#2E2E5C]/45 px-5 ${
        open ? "top-question-open" : "top-question-prep"
      }`}
      style={guarded ? { pointerEvents: "none" } : undefined}
      onClick={close}
    >
      <div className="top-question-stage relative w-full max-w-[560px] md:max-w-[640px]" onClick={(e) => e.stopPropagation()}>
        <div className="top-question-in relative z-10">
          <TopFirstQuestion
            {...question}
            shownAfterMs={SHOW_QUESTION_AFTER_MS}
          />
        </div>
        {/* カードが出きったあと、カードの裏から Alice がそっと顔を出し、下のカードを指さして話しかける。
            カードより奥 (z-0) に置くので、体の下側はカードに隠れ、ふちの向こうから出てくるように見える。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ALICE_SRC}
          alt=""
          aria-hidden="true"
          width={515}
          height={520}
          className="top-question-peek pointer-events-none absolute bottom-[calc(100%-4px)] left-[7%] z-0 h-auto w-[88px]"
        />
        {/* Alice のせりふ。顔を出したあとに、口もとから吹き出しがぽんと出る。 */}
        <p className="top-question-bubble pointer-events-none absolute bottom-[calc(100%+22px)] left-[calc(7%+92px)] z-0 rounded-2xl bg-white px-3.5 py-2 text-[13px] font-bold leading-snug text-[#2E2E5C] shadow-[0_4px_14px_rgba(46,46,92,0.18)]">
          まずは1問だけ、答えてみて！
          <span
            aria-hidden="true"
            className="absolute -left-[7px] bottom-[9px] h-0 w-0 border-y-[6px] border-r-[9px] border-y-transparent border-r-white"
          />
        </p>
        <button
          type="button"
          aria-label="閉じる"
          onClick={close}
          className="absolute right-1.5 top-1.5 z-20 flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-[#B4B4C8] hover:bg-[#2E2E5C]/5"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function TopFirstQuestion({
  questionSet,
  questionId,
  questionText,
  shownAfterMs,
  lead,
}: FirstQuestionProps & { shownAfterMs?: number; lead?: string }) {
  const router = useRouter();
  const [value, setValue] = useState<AnswerValue | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);

  // 答えた直後に待たせないよう、診断ページを先に読み込んでおく。
  useEffect(() => {
    router.prefetch("/diagnosis");
  }, [router]);

  const handleAnswer = (answer: AnswerValue) => {
    if (value !== undefined) return; // 二度押しで二重に進まない
    setValue(answer);
    saveFirstAnswerHandoff({ questionSet, questionId, answer });
    track("top_cta_clicked", {
      metadata: { locale: "ja", page: "top", destination: "diagnosis", kind: "first_question", shownAfterMs },
    });
    // 選んだ○に印が付くのを一瞬見せてから、カードを画面に残したまま診断ページへつなぐ。
    window.setTimeout(() => {
      const veiled = cardRef.current ? startFirstAnswerVeil(cardRef.current) : false;
      window.setTimeout(() => router.push("/diagnosis"), veiled ? FIRST_ANSWER_VEIL_IN_MS : 0);
    }, 200);
  };

  return (
    <div ref={cardRef} className="top-first-question mx-auto w-full max-w-[560px] rounded-3xl md:max-w-[640px] bg-white px-6 pb-8 pt-8 text-center shadow-[0_10px_30px_rgba(46,46,92,0.18)]">
      {lead && (
        <p className="top-question-lead mb-3 text-[13px] font-bold tracking-wide text-[#5B5BEF]">
          {lead}
        </p>
      )}
      <p className="top-question-text phrase-jp mb-6 text-[17px] font-bold leading-relaxed text-[#2E2E5C] sm:text-[20px]">
        {phraseWrapJa(questionText)}
      </p>
      {/* size="lg": PC では診断ページの質問と同じ大きさの○にする (つなぎ目で大きさが変わらないように)。 */}
      <LikertScale value={value} onChange={handleAnswer} size="lg" />
      <Link
        href="/diagnosis"
        prefetch={false}
        className="sr-only"
        onClick={() =>
          track("top_cta_clicked", {
            metadata: { locale: "ja", page: "top", destination: "diagnosis" },
          })
        }
      >
        無料で診断をはじめる
      </Link>
    </div>
  );
}
