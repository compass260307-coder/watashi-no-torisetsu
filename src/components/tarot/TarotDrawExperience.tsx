"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./TarotDrawExperience.module.css";
import {
  tarotModes,
  type TarotLocale,
  type TarotMode,
} from "./tarot-data";

type Phase = "ready" | "shuffling" | "cutting" | "selecting" | "revealed";
type CardName = "moon" | "star" | "sun";

const CARD_BACK = "/tarot/card-back.webp";
const CARD_ART: Record<CardName, string> = {
  moon: "/tarot/the-moon.webp",
  star: "/tarot/the-star.webp",
  sun: "/tarot/the-sun.webp",
};
const CARD_INFO: Record<CardName, { title: string; keyword: string }> = {
  moon: { title: "XVIII 月", keyword: "曖昧さの中の本音" },
  star: { title: "XVII 星", keyword: "希望を信じ直す" },
  sun: { title: "XIX 太陽", keyword: "明るい前進" },
};
const KO_CARD_INFO: typeof CARD_INFO = {
  moon: { title: "XVIII 달", keyword: "모호함 속의 진심" },
  star: { title: "XVII 별", keyword: "희망을 다시 믿기" },
  sun: { title: "XIX 태양", keyword: "밝은 전진" },
};
const HIDDEN_CARDS: CardName[] = ["moon", "sun", "star", "moon", "sun"];

const SINGLE_READINGS: Record<
  CardName,
  { summary: string; details: readonly { title: string; text: string }[] }
> = {
  moon: {
    summary: "月は、まだ言葉になっていない気持ちを急いで決めなくていいと伝えています。今日は答えよりも、自分が何に揺れているのかを丁寧に見つける日です。",
    details: [
      { title: "カードが示すこと", text: "曖昧さの奥にある小さな違和感が、本音へ戻る入口になります。" },
      { title: "今日の注意", text: "不安から結論を出したり、相手の気持ちを決めつけたりしないこと。" },
      { title: "今日の行動", text: "気になることをひとつ書き出し、事実と想像を分けてみて。" },
    ],
  },
  star: {
    summary: "星は、希望を取り戻しながら自分の感覚を信じ直すカードです。今日は、すぐに答えを出すより、心が少し明るくなる方向を選ぶことが流れを整えます。",
    details: [
      { title: "カードが示すこと", text: "焦りを手放したときに、本当に望んでいる方向が見えてきます。" },
      { title: "今日の注意", text: "周りの正解に合わせるために、自分の小さな違和感を無視しないこと。" },
      { title: "今日の行動", text: "気になっていたことを、結果を求めず10分だけ始めてみて。" },
    ],
  },
  sun: {
    summary: "太陽は、迷いの中に十分な光が差していることを伝えています。今日は遠慮して小さく収まるより、うれしいと思える方向へ素直に動くほど流れが開きます。",
    details: [
      { title: "カードが示すこと", text: "率直さと行動力が、停滞していた状況を明るく動かします。" },
      { title: "今日の注意", text: "勢いだけで約束を増やさず、できる範囲を確かめること。" },
      { title: "今日の行動", text: "先延ばしにしていた連絡を、短い一言から送ってみて。" },
    ],
  },
};

const KO_SINGLE_READINGS: typeof SINGLE_READINGS = {
  moon: {
    summary: "달은 아직 말이 되지 않은 마음을 서둘러 결정하지 않아도 된다고 전해요. 오늘은 답을 내리기보다 내가 무엇 때문에 흔들리는지 차분히 살펴보는 날이에요.",
    details: [
      { title: "카드가 보여 주는 것", text: "모호함 속에 숨은 작은 위화감이 진심으로 돌아가는 입구가 돼요." },
      { title: "오늘의 주의점", text: "불안한 마음으로 결론을 내리거나 상대의 마음을 단정하지 마세요." },
      { title: "오늘의 행동", text: "마음에 걸리는 일을 하나 적고 사실과 상상을 나누어 보세요." },
    ],
  },
  star: {
    summary: "별은 희망을 되찾으며 내 감각을 다시 믿는 카드예요. 오늘은 바로 답을 내기보다 마음이 조금 밝아지는 방향을 선택할수록 흐름이 정돈돼요.",
    details: [
      { title: "카드가 보여 주는 것", text: "조급함을 내려놓을 때 내가 진정으로 원하는 방향이 보여요." },
      { title: "오늘의 주의점", text: "주변의 정답에 맞추려고 내 안의 작은 위화감을 무시하지 마세요." },
      { title: "오늘의 행동", text: "마음에 두었던 일을 결과를 바라지 말고 딱 10분만 시작해 보세요." },
    ],
  },
  sun: {
    summary: "태양은 망설임 속에도 충분한 빛이 비치고 있다고 전해요. 오늘은 나를 작게 줄이기보다 기쁘다고 느끼는 방향으로 솔직하게 움직일수록 흐름이 열려요.",
    details: [
      { title: "카드가 보여 주는 것", text: "솔직함과 행동력이 멈춰 있던 상황을 밝게 움직여요." },
      { title: "오늘의 주의점", text: "기세만으로 약속을 늘리지 말고 내가 할 수 있는 범위를 확인하세요." },
      { title: "오늘의 행동", text: "미루고 있던 연락을 짧은 한마디부터 보내 보세요." },
    ],
  },
};

type ThreeReading = {
  summary: string;
  details: readonly { title: string; text: string }[];
};

const THREE_READING: ThreeReading = {
  summary: "月から星、そして太陽へ。迷いの中で感覚を研ぎ澄ませてきた時間が、希望を経て、はっきりした前進へ向かう並びです。",
  details: [
    { title: "3枚のつながり", text: "不安を消そうとするより、曖昧さの中で見つけた本音を信じることが転換点になります。" },
    { title: "これから起こる変化", text: "自分で納得して選んだ方向ほど、周囲との関係や状況が明るく開けていきます。" },
    { title: "今できること", text: "結論を急がず、いちばん避けていた選択肢を一度だけ言葉にしてみて。" },
  ],
};

const KO_THREE_READING: ThreeReading = {
  summary: "달에서 별을 지나 태양으로. 망설임 속에서 감각을 가다듬어 온 시간이 희망을 거쳐 분명한 전진으로 이어지는 카드 배열이에요.",
  details: [
    { title: "세 장의 연결", text: "불안을 없애려 하기보다 모호함 속에서 찾은 진심을 믿는 것이 전환점이 돼요." },
    { title: "앞으로 생길 변화", text: "내가 납득하고 고른 방향일수록 주변 관계와 상황이 밝게 열려요." },
    { title: "지금 할 수 있는 것", text: "결론을 서두르지 말고 가장 피하고 있던 선택지를 한 번만 말로 꺼내 보세요." },
  ],
};

const YES_NO_READINGS: Record<CardName, { answer: string; condition: string; summary: string }> = {
  moon: {
    answer: "WAIT",
    condition: "今は答えを急がない",
    summary: "月は、まだ見えていない条件があることを示しています。今はYESかNOを決めるより、不安の正体を確認してから選び直すのがよさそうです。",
  },
  star: {
    answer: "YES",
    condition: "小さく試しながら進む",
    summary: "星は、望んでいる方向へ進むことを静かに後押ししています。大きく賭けるのではなく、小さな一歩から確かめるなら答えはYESです。",
  },
  sun: {
    answer: "YES",
    condition: "条件を整えて進む",
    summary: "太陽は、前へ進む力と状況が明らかになる流れを示します。答えはYES。ただし、曖昧なまま進めず条件を言葉にすることが必要です。",
  },
};

const KO_YES_NO_READINGS: typeof YES_NO_READINGS = {
  moon: {
    answer: "WAIT",
    condition: "지금은 답을 서두르지 않기",
    summary: "달은 아직 보이지 않는 조건이 있다고 알려 줘요. 지금은 YES나 NO를 정하기보다 불안의 정체를 확인한 뒤 다시 선택하는 편이 좋아요.",
  },
  star: {
    answer: "YES",
    condition: "작게 시험하며 나아가기",
    summary: "별은 내가 원하는 방향으로 나아가도록 조용히 등을 밀어 줘요. 크게 걸기보다 작은 한 걸음부터 확인한다면 답은 YES예요.",
  },
  sun: {
    answer: "YES",
    condition: "조건을 정리하고 나아가기",
    summary: "태양은 앞으로 나아갈 힘과 상황이 분명해지는 흐름을 보여 줘요. 답은 YES. 다만 모호한 채로 움직이지 말고 조건을 말로 정리해야 해요.",
  },
};

const DRAW_COPY = {
  ja: {
    back: "タロット占いの選択へ戻る",
    questionLabel: "占いたいこと",
    questionPlaceholder: "迷っていることを書く",
    shuffle: "カードを混ぜる",
    shuffling: "Aliceがカードを混ぜています",
    choosePile: "直感でカードの山をひとつ選んでください",
    askAlice: "Aliceに読み解いてもらう",
    chooseOne: "カードを1枚選んでください",
    chooseThree: (count: number) => `カードを3枚選んでください　${count}/3`,
    talk: "この結果についてAliceと話す",
    retry: "もう一度占う",
    cutTitle: "デッキを3つの山に分けました",
    cutBody: "ひとつ選んで、カードを切ってください。",
    pileAria: (index: number) => `${index + 1}番目のカードの山を選ぶ`,
    selectOne: "心が引かれる1枚を選んでください。",
    selectThree: "心が引かれる3枚を選んでください。",
    cardAria: (index: number, selected: boolean) => `${index + 1}枚目のカード${selected ? "、選択済み" : ""}`,
    cardBackAlt: "伏せられたタロットカード",
    past: "過去",
    present: "現在",
    future: "これから",
    today: "今日のカード",
    cardAlt: (title: string) => `${title}のタロットカード`,
    upright: "正位置",
    readingTitle: "Aliceの読み解き",
    answerTitle: "カードからの答え",
    checkTitle: "確認したいこと",
    nextTitle: "次の一歩",
    moonCheck: "判断に必要な情報がすべて揃っているかを確かめて。",
    otherCheck: "自分が譲れない条件を、動く前にひとつ言葉にして。",
    moonNext: "今日は決めず、気になる点をひとつ質問してみて。",
    otherNext: "失敗しても戻れる大きさで、最初の一歩を試してみて。",
  },
  ko: {
    back: "타로 선택 화면으로 돌아가기",
    questionLabel: "카드에 묻고 싶은 것",
    questionPlaceholder: "망설이고 있는 일을 적어 주세요",
    shuffle: "카드 섞기",
    shuffling: "Alice가 카드를 섞고 있어요",
    choosePile: "직감을 따라 카드 더미 하나를 골라 주세요",
    askAlice: "Alice에게 해석 받기",
    chooseOne: "카드 한 장을 골라 주세요",
    chooseThree: (count: number) => `카드 세 장을 골라 주세요　${count}/3`,
    talk: "이 결과를 Alice와 이야기하기",
    retry: "다시 뽑기",
    cutTitle: "덱을 세 개의 더미로 나누었어요",
    cutBody: "하나를 골라 카드를 컷해 주세요.",
    pileAria: (index: number) => `${index + 1}번째 카드 더미 선택`,
    selectOne: "마음이 끌리는 한 장을 골라 주세요.",
    selectThree: "마음이 끌리는 세 장을 골라 주세요.",
    cardAria: (index: number, selected: boolean) => `${index + 1}번째 카드${selected ? ", 선택됨" : ""}`,
    cardBackAlt: "뒷면으로 놓인 타로 카드",
    past: "과거",
    present: "현재",
    future: "앞으로",
    today: "오늘의 카드",
    cardAlt: (title: string) => `${title} 타로 카드`,
    upright: "정방향",
    readingTitle: "Alice의 해석",
    answerTitle: "카드의 답",
    checkTitle: "확인할 점",
    nextTitle: "다음 한 걸음",
    moonCheck: "판단에 필요한 정보가 모두 갖춰졌는지 확인해 보세요.",
    otherCheck: "내가 양보할 수 없는 조건을 움직이기 전에 하나만 말로 정리해 보세요.",
    moonNext: "오늘은 결정하지 말고 마음에 걸리는 점을 하나 질문해 보세요.",
    otherNext: "실패해도 돌아올 수 있을 만큼 작게 첫걸음을 내디뎌 보세요.",
  },
} as const;

const SELECTABLE_CARDS = [
  { rotate: -9, top: 12 },
  { rotate: -4, top: 4 },
  { rotate: 0, top: 0 },
  { rotate: 4, top: 4 },
  { rotate: 9, top: 12 },
] as const;

export default function TarotDrawExperience({
  mode,
  locale = "ja",
}: {
  mode: TarotMode;
  locale?: TarotLocale;
}) {
  const config = tarotModes(locale)[mode];
  const copy = DRAW_COPY[locale];
  const [phase, setPhase] = useState<Phase>("ready");
  const [question, setQuestion] = useState("");
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const shuffleTimer = useRef<number | null>(null);
  const needsQuestion = mode === "yes-no";
  const canStart = !needsQuestion || question.trim().length > 0;
  const selectionComplete = selectedCards.length === config.selectionCount;
  const singleCard = HIDDEN_CARDS[selectedCards[0] ?? 2];

  useEffect(() => {
    return () => {
      if (shuffleTimer.current !== null) window.clearTimeout(shuffleTimer.current);
    };
  }, []);

  function startShuffle() {
    if (!canStart || phase !== "ready") return;
    setSelectedCards([]);
    setPhase("shuffling");
    shuffleTimer.current = window.setTimeout(() => setPhase("cutting"), 1_350);
  }

  function toggleCard(index: number) {
    if (phase !== "selecting") return;
    setSelectedCards((current) => {
      if (current.includes(index)) return current.filter((value) => value !== index);
      if (current.length >= config.selectionCount) return current;
      return [...current, index];
    });
  }

  function reset() {
    setSelectedCards([]);
    setPhase("ready");
    if (needsQuestion) setQuestion("");
  }

  return (
    <main className="min-h-[calc(100dvh-56px)] bg-white px-4 py-8 text-[#2E2E5C] md:px-8 md:py-12">
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-center justify-between">
          <Link
            href={`${locale === "ko" ? "/ko" : ""}/tarot`}
            aria-label={copy.back}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#2E2E5C]/8 bg-white text-[#2E2E5C] shadow-sm transition hover:bg-[#F0EDFF]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="text-center">
            <p className="text-[10px] font-black tracking-[0.16em] text-[#8A78CF]">ALICE TAROT</p>
            <h1 className="mt-1 text-[23px] font-black md:text-[28px]">{config.title}</h1>
          </div>
          <div aria-hidden="true" className="h-11 w-11" />
        </div>

        <p className="mx-auto mt-4 max-w-[480px] text-center text-[13px] font-bold leading-relaxed text-[#2E2E5C]/50 md:text-[14px]">
          {config.lead}
        </p>

        <div className="mx-auto mt-7 flex max-w-[650px] items-center gap-3">
          <div className={`${styles.aliceFloat} relative h-16 w-16 flex-none overflow-hidden rounded-full bg-[#F0EDFF] ring-2 ring-white shadow-sm`}>
            <Image
              src="/mascot/hoshiyomi-alice-avatar-transparent.png"
              alt="Alice"
              fill
              sizes="64px"
              className="object-contain"
            />
          </div>
          <div aria-live="polite" className="flex-1 rounded-[22px] rounded-bl-md border border-[#2E2E5C]/8 bg-white px-4 py-3.5 shadow-sm md:px-5">
            <p className="text-[10px] font-black tracking-[0.08em] text-[#6A58B5]">Alice</p>
            <p className="mt-1 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/70 md:text-[14px]">
              {guideMessage(phase, locale)}
            </p>
          </div>
        </div>

        {needsQuestion && phase === "ready" ? (
          <div className="mx-auto mt-6 max-w-[650px]">
            <label htmlFor="tarot-question" className="text-[13px] font-black">
              {copy.questionLabel}
            </label>
            <textarea
              id="tarot-question"
              maxLength={200}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={copy.questionPlaceholder}
              className="mt-2 min-h-28 w-full resize-none rounded-[18px] border border-[#2E2E5C]/10 bg-white px-4 py-3 text-[14px] font-medium leading-relaxed outline-none placeholder:text-[#2E2E5C]/25 focus:border-[#7D6BD0]/45 focus:ring-4 focus:ring-[#7D6BD0]/8"
            />
            <p className="mt-1 text-right text-[10px] font-bold text-[#2E2E5C]/30">{question.length}/200</p>
          </div>
        ) : null}

        {phase === "revealed" ? (
          <ResultStage mode={mode} card={singleCard} question={question.trim()} locale={locale} />
        ) : (
          <RitualStage
            phase={phase}
            selectionCount={config.selectionCount}
            selectedCards={selectedCards}
            onCut={() => setPhase("selecting")}
            onToggle={toggleCard}
            locale={locale}
          />
        )}

        <div className="mx-auto mt-6 max-w-[650px]">
          {phase === "ready" ? (
            <PrimaryAction disabled={!canStart} onClick={startShuffle}>
              {copy.shuffle}
            </PrimaryAction>
          ) : phase === "shuffling" ? (
            <PrimaryAction disabled onClick={() => undefined}>
              {copy.shuffling}
            </PrimaryAction>
          ) : phase === "cutting" ? (
            <p className="text-center text-[12px] font-bold text-[#2E2E5C]/45">{copy.choosePile}</p>
          ) : phase === "selecting" ? (
            <PrimaryAction disabled={!selectionComplete} onClick={() => setPhase("revealed")}>
              {selectionComplete
                ? copy.askAlice
                : config.selectionCount === 1
                  ? copy.chooseOne
                  : copy.chooseThree(selectedCards.length)}
            </PrimaryAction>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href={locale === "ko" ? "/ko/hoshiyomi" : "/hoshiyomi"}
                className="flex min-h-13 items-center justify-center rounded-2xl bg-[#5B5BEF] px-5 py-3 text-center text-[14px] font-black text-white shadow-[0_10px_22px_rgba(91,91,239,0.22)] transition hover:bg-[#4D4DD7]"
              >
                {copy.talk}
              </Link>
              <button
                type="button"
                onClick={reset}
                className="min-h-13 rounded-2xl border border-[#2E2E5C]/10 bg-white px-5 py-3 text-[14px] font-black text-[#6A58B5] transition hover:bg-[#F0EDFF]"
              >
                {copy.retry}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function RitualStage({
  phase,
  selectionCount,
  selectedCards,
  onCut,
  onToggle,
  locale,
}: {
  phase: Phase;
  selectionCount: number;
  selectedCards: number[];
  onCut: () => void;
  onToggle: (index: number) => void;
  locale: TarotLocale;
}) {
  const copy = DRAW_COPY[locale];
  return (
    <section className="relative mx-auto mt-7 flex min-h-[350px] max-w-[650px] items-center justify-center overflow-hidden rounded-[28px] border border-[#6D91D8]/35 bg-[#071B45] px-3 py-8 shadow-[0_18px_45px_rgba(7,27,69,0.22)] md:min-h-[390px] md:px-6">
      <Image
        src="/tarot/reading-cloth.webp"
        alt=""
        fill
        sizes="650px"
        className="pointer-events-none object-cover opacity-[0.16]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(69,114,205,0.26),transparent_58%)]" />

      {phase === "cutting" ? (
        <div className="relative z-10 w-full text-center">
          <p className="text-[17px] font-black text-white">{copy.cutTitle}</p>
          <p className="mt-2 text-[12px] font-bold text-[#BFD0FF]">{copy.cutBody}</p>
          <div className="mt-9 flex items-center justify-center gap-6 md:gap-10">
            {[0, 1, 2].map((index) => (
              <button
                key={index}
                type="button"
                aria-label={copy.pileAria(index)}
                onClick={onCut}
                className="group relative h-[112px] w-[74px] transition hover:-translate-y-2 active:scale-95"
              >
                <span className="absolute left-2 top-0 h-[98px] w-[65px] rotate-[4deg] rounded-lg border border-[#8FC9FF]/70 bg-[#173C7E]" />
                <span className="absolute left-1 top-1 h-[98px] w-[65px] rotate-[2deg] rounded-lg border border-[#8FC9FF]/70 bg-[#2458B8]" />
                <Image src={CARD_BACK} alt="" width={1024} height={1536} className="relative h-[98px] w-[65px] rounded-lg border border-[#8FC9FF]/70 object-cover shadow-lg" />
              </button>
            ))}
          </div>
        </div>
      ) : phase === "selecting" ? (
        <div className="relative z-10 w-full text-center">
          <p className="text-[15px] font-black text-white">
            {selectionCount === 1 ? copy.selectOne : copy.selectThree}
          </p>
          <div className="mt-10 flex min-h-[145px] items-center justify-center gap-0 sm:gap-2">
            {SELECTABLE_CARDS.map((card, index) => {
              const selected = selectedCards.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  aria-label={copy.cardAria(index, selected)}
                  aria-pressed={selected}
                  onClick={() => onToggle(index)}
                  className="relative -mx-0.5 h-[132px] w-[76px] transition duration-200 hover:-translate-y-2 active:scale-95 sm:mx-0"
                  style={{ transform: `translateY(${selected ? -14 : card.top}px) rotate(${card.rotate}deg)` }}
                >
                  <Image
                    src={CARD_BACK}
                    alt={copy.cardBackAlt}
                    width={1024}
                    height={1536}
                    className={`h-[116px] w-[76px] rounded-[9px] border object-cover ${selected ? "border-white shadow-[0_12px_28px_rgba(143,201,255,0.58)]" : "border-[#8FC9FF]/65 shadow-lg"}`}
                  />
                  {selected ? (
                    <span className="absolute -bottom-0.5 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#5B5BEF] text-sm font-black text-white">✓</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`${phase === "shuffling" ? styles.shuffleDeck : ""} relative z-10 flex h-[270px] w-[190px] items-center justify-center`}>
          <div aria-hidden="true" className="absolute h-[258px] w-[184px] rounded-[20px] border border-[#8FC9FF]/35 bg-[#173C7E]/40" />
          <div aria-hidden="true" className="absolute h-[222px] w-[148px] translate-x-3 -translate-y-2 rotate-[5deg] rounded-[14px] bg-[#173C7E]" />
          <div aria-hidden="true" className="absolute h-[222px] w-[148px] translate-x-1.5 -translate-y-1 rotate-[2deg] rounded-[14px] bg-[#2458B8]" />
          <Image
            src={CARD_BACK}
            alt={copy.cardBackAlt}
            width={1024}
            height={1536}
            priority
            className="relative h-[222px] w-[148px] rounded-[14px] border border-[#8FC9FF]/70 object-cover shadow-[0_16px_34px_rgba(0,0,0,0.38)]"
          />
        </div>
      )}
    </section>
  );
}

function ResultStage({
  mode,
  card,
  question,
  locale,
}: {
  mode: TarotMode;
  card: CardName;
  question: string;
  locale: TarotLocale;
}) {
  const copy = DRAW_COPY[locale];
  return (
    <section className={`${styles.reveal} mx-auto mt-7 max-w-[760px] rounded-[28px] border border-[#2E2E5C]/8 bg-white p-5 shadow-[0_16px_45px_rgba(46,46,92,0.08)] md:p-8`}>
      {mode === "three" ? (
        <div className="grid grid-cols-3 gap-3 md:gap-5">
          <ArtCard card="moon" label={copy.past} locale={locale} />
          <ArtCard card="star" label={copy.present} locale={locale} />
          <ArtCard card="sun" label={copy.future} locale={locale} />
        </div>
      ) : mode === "yes-no" ? (
        <YesNoResult card={card} question={question} locale={locale} />
      ) : (
        <div className="mx-auto max-w-[220px]">
          <ArtCard card={card} label={copy.today} locale={locale} large />
        </div>
      )}

      <AliceReading mode={mode} card={card} locale={locale} />
    </section>
  );
}

function ArtCard({
  card,
  label,
  locale,
  large = false,
}: {
  card: CardName;
  label: string;
  locale: TarotLocale;
  large?: boolean;
}) {
  const copy = DRAW_COPY[locale];
  const info = (locale === "ko" ? KO_CARD_INFO : CARD_INFO)[card];
  return (
    <div className="text-center">
      <p className="mb-2 text-[10px] font-black tracking-[0.1em] text-[#2E2E5C]/40 md:text-[11px]">{label}</p>
      <Image
        src={CARD_ART[card]}
        alt={copy.cardAlt(info.title)}
        width={1024}
        height={1536}
        sizes={large ? "220px" : "(min-width: 768px) 165px, 28vw"}
        className={`mx-auto h-auto rounded-[10px] border border-[#2E2E5C]/10 object-cover shadow-[0_10px_24px_rgba(46,46,92,0.12)] ${large ? "w-[190px] md:w-[220px]" : "w-full max-w-[165px]"}`}
      />
      <p className={`${large ? "mt-4 text-[18px]" : "mt-3 text-[13px] md:text-[15px]"} font-black`}>{info.title}</p>
      <p className="mt-1 text-[10px] font-bold text-[#2E2E5C]/38">{copy.upright}</p>
    </div>
  );
}

function YesNoResult({ card, question, locale }: { card: CardName; question: string; locale: TarotLocale }) {
  const copy = DRAW_COPY[locale];
  const reading = (locale === "ko" ? KO_YES_NO_READINGS : YES_NO_READINGS)[card];
  const info = (locale === "ko" ? KO_CARD_INFO : CARD_INFO)[card];
  return (
    <div>
      <p className="mx-auto mb-5 max-w-[520px] text-center text-[12px] font-bold leading-relaxed text-[#2E2E5C]/45">「{question}」</p>
      <div className="mx-auto flex max-w-[430px] items-center justify-center gap-6 rounded-[22px] bg-[#F8F7FD] p-4 md:gap-9 md:p-5">
        <Image src={CARD_ART[card]} alt={copy.cardAlt(info.title)} width={1024} height={1536} className="h-auto w-[105px] rounded-[9px] shadow-md md:w-[125px]" />
        <div className="text-center">
          <p className="text-[31px] font-black tracking-[0.08em] text-[#6A58B5] md:text-[38px]">{reading.answer}</p>
          <p className="mt-2 max-w-[155px] text-[13px] font-black leading-relaxed">{reading.condition}</p>
          <p className="mt-3 text-[10px] font-bold text-[#2E2E5C]/38">{info.title} · {copy.upright}</p>
        </div>
      </div>
    </div>
  );
}

function AliceReading({ mode, card, locale }: { mode: TarotMode; card: CardName; locale: TarotLocale }) {
  const copy = DRAW_COPY[locale];
  const singleReadings = locale === "ko" ? KO_SINGLE_READINGS : SINGLE_READINGS;
  const threeReading = locale === "ko" ? KO_THREE_READING : THREE_READING;
  const yesNoReadings = locale === "ko" ? KO_YES_NO_READINGS : YES_NO_READINGS;
  const reading = mode === "three" ? threeReading : singleReadings[card];
  const summary = mode === "yes-no" ? yesNoReadings[card].summary : reading.summary;
  const details =
    mode === "yes-no"
      ? [
          { title: copy.answerTitle, text: summary },
          { title: copy.checkTitle, text: card === "moon" ? copy.moonCheck : copy.otherCheck },
          { title: copy.nextTitle, text: card === "moon" ? copy.moonNext : copy.otherNext },
        ]
      : reading.details;

  return (
    <div className="mt-7 rounded-[24px] border border-[#7D6BD0]/12 bg-[#FBFAFF] p-5 md:mt-9 md:p-7">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 overflow-hidden rounded-full bg-[#F0EDFF]">
          <Image src="/mascot/hoshiyomi-alice-avatar-transparent.png" alt="" fill sizes="44px" className="object-contain" />
        </div>
        <div>
          <p className="text-[10px] font-black tracking-[0.1em] text-[#8A78CF]">ALICE READING</p>
          <p className="text-[14px] font-black">{copy.readingTitle}</p>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-line text-[14px] font-bold leading-[1.9] text-[#2E2E5C]/72 md:text-[15px]">{summary}</p>
      <div className="mt-5 divide-y divide-[#2E2E5C]/8 border-t border-[#2E2E5C]/8">
        {details.map((detail) => (
          <div key={detail.title} className="py-4">
            <p className="text-[11px] font-black text-[#6A58B5]">{detail.title}</p>
            <p className="mt-1.5 text-[13px] font-medium leading-[1.8] text-[#2E2E5C]/65">{detail.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrimaryAction({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-13 w-full rounded-2xl bg-[#5B5BEF] px-5 py-3 text-[14px] font-black text-white shadow-[0_10px_22px_rgba(91,91,239,0.22)] transition hover:bg-[#4D4DD7] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#C9C9DD] disabled:shadow-none"
    >
      {children}
    </button>
  );
}

function guideMessage(phase: Phase, locale: TarotLocale) {
  if (locale === "ko") {
    if (phase === "shuffling") return "지금의 당신을 떠올리며 카드를 섞고 있어요.";
    if (phase === "cutting") return "카드를 세 개의 더미로 나누었어요. 직감으로 하나를 골라 덱을 컷해 주세요.";
    if (phase === "selecting") return "너무 많이 생각하지 않아도 괜찮아요. 처음 마음이 간 카드를 골라 주세요.";
    if (phase === "revealed") return "나온 카드를 지금의 당신과 겹쳐 읽어 보았어요.";
    return "오늘은 Alice가 당신을 위해 카드를 정성껏 읽어 드릴게요.";
  }
  if (phase === "shuffling") return "あなたの今を思い浮かべながら、カードを混ぜているよ。";
  if (phase === "cutting") return "カードを3つの山に分けたよ。直感でひとつ選んで、デッキを切って。";
  if (phase === "selecting") return "考えすぎなくて大丈夫。最初に気になったカードを選んで。";
  if (phase === "revealed") return "出たカードを、あなたの今と重ねて読んでみたよ。";
  return "今日はAliceが、あなたのために丁寧にカードを読むね。";
}
