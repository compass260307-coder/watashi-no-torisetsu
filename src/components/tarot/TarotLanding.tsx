import Image from "next/image";
import Link from "next/link";
import {
  TAROT_MODE_IDS,
  tarotModes,
  type TarotLocale,
  type TarotMode,
} from "./tarot-data";

type TarotFaq = { question: string; answer: string };

const TAROT_FAQS = [
  {
    question: "タロット占いは、どんなときに使うものですか？",
    answer:
      "迷っているときや、自分の気持ちがわからなくなったときにおすすめです。未来を決めつけるのではなく、今の自分が大切にしたいことを見つけるヒントとしてお楽しみください。",
  },
  {
    question: "どの占いを選べばいいですか？",
    answer:
      "今日の過ごし方を知りたいときは「今日の1枚」、これまでの流れを整理したいときは「3枚引き」、具体的な迷いがあるときは「YES / NO」がおすすめです。",
  },
  {
    question: "同じことを何度占ってもいいですか？",
    answer:
      "何度でも引けますが、望む答えが出るまで続けるより、最初に出たカードを一度受け止めてみるのがおすすめです。少し時間を置くと、違う気づきが見えてくることもあります。",
  },
  {
    question: "結果が悪く感じたら、どうすればいいですか？",
    answer:
      "カードは悪い未来を確定するものではありません。注意したいことや、今から変えられることを教えてくれるメッセージとして読み替えてみてください。",
  },
  {
    question: "占い結果についてAliceに相談できますか？",
    answer:
      "はい。結果画面の「この結果についてAliceと話す」からAliceとの対話へ進み、気になったカードや今の気持ちをさらに深く整理できます。",
  },
] as const satisfies readonly TarotFaq[];

const KO_TAROT_FAQS = [
  {
    question: "타로는 언제 이용하면 좋나요?",
    answer:
      "망설이거나 내 마음을 잘 모르겠을 때 추천해요. 미래를 단정하는 것이 아니라, 지금 내가 소중히 하고 싶은 것을 찾는 힌트로 즐겨 주세요.",
  },
  {
    question: "어떤 리딩을 선택하면 좋나요?",
    answer:
      "오늘을 어떻게 보내면 좋을지 알고 싶다면 ‘오늘의 한 장’, 지금까지의 흐름을 정리하고 싶다면 ‘세 장 뽑기’, 구체적으로 망설이는 일이 있다면 ‘YES / NO’를 추천해요.",
  },
  {
    question: "같은 질문으로 여러 번 뽑아도 되나요?",
    answer:
      "몇 번이든 뽑을 수 있지만, 원하는 답이 나올 때까지 반복하기보다는 처음 나온 카드를 한 번 받아들여 보는 것을 추천해요. 조금 시간을 두면 다른 깨달음이 보일 수도 있어요.",
  },
  {
    question: "결과가 좋지 않게 느껴지면 어떻게 하나요?",
    answer:
      "카드는 나쁜 미래를 확정하지 않아요. 주의할 점이나 지금부터 바꿀 수 있는 것을 알려 주는 메시지로 바꾸어 읽어 보세요.",
  },
  {
    question: "타로 결과를 Alice와 상담할 수 있나요?",
    answer:
      "네. 결과 화면의 ‘이 결과를 Alice와 이야기하기’에서 Alice와의 대화로 이동해, 마음에 걸린 카드와 지금의 기분을 더 깊이 정리할 수 있어요.",
  },
] as const satisfies readonly TarotFaq[];

const LANDING_COPY = {
  ja: {
    title: "Aliceとタロット占い",
    lead: "タロットで見つけるのは、決められた未来ではなく、今のあなたが大切にしたい気持ち。占い師Aliceと一緒に、カードを手がかりに、あなたらしい選び方を見つけましょう。",
    heroAlt: "机でタロットカードを占う天使Alice",
    choose: "今日は、何をカードに聞く？",
    disclaimer: "タロットは未来を断定するものではありません。今の気持ちを整理し、次の選択を考えるためのヒントとしてお楽しみください。",
    faqTitle: "よくある質問",
    draw: "カードを引く",
    openSuffix: "を開く",
    faqs: TAROT_FAQS,
  },
  ko: {
    title: "Alice와 타로",
    lead: "타로에서 찾는 것은 정해진 미래가 아니라, 지금 내가 소중히 하고 싶은 마음이에요. 타로 리더 Alice와 함께 카드를 단서 삼아 나다운 선택을 찾아보세요.",
    heroAlt: "책상에서 타로 카드를 읽는 천사 Alice",
    choose: "오늘은 카드에 무엇을 물어볼까요?",
    disclaimer: "타로는 미래를 단정하지 않아요. 지금의 마음을 정리하고 다음 선택을 생각하는 힌트로 즐겨 주세요.",
    faqTitle: "자주 묻는 질문",
    draw: "카드 뽑기",
    openSuffix: " 열기",
    faqs: KO_TAROT_FAQS,
  },
} as const;

export default function TarotLanding({
  locale = "ja",
}: {
  locale?: TarotLocale;
}) {
  const copy = LANDING_COPY[locale];
  return (
    <main className="overflow-hidden bg-white text-[#2E2E5C]">
      <section className="relative border-b border-[#2E2E5C]/5 bg-white px-5 pb-4 pt-12 md:px-8 md:py-16">
        <div className="relative mx-auto grid max-w-[1040px] items-center gap-4 md:grid-cols-[1fr_0.9fr] md:gap-8">
          <div className="contents md:order-2 md:block">
            <h1 className="order-1 text-[32px] font-black leading-[1.25] md:text-[48px]">
              {copy.title}
            </h1>
            <p className="order-3 max-w-[600px] text-[15px] font-medium leading-[1.9] text-[#2E2E5C]/65 md:mt-5 md:text-[17px]">
              {copy.lead}
            </p>
          </div>

          <div className="relative order-2 mx-auto w-full max-w-[500px] md:order-1">
            <Image
              src="/mascot/tarot-alice-desk-hero-v2.webp"
              alt={copy.heroAlt}
              width={1638}
              height={960}
              priority
              sizes="(min-width: 768px) 500px, 94vw"
              className="h-auto w-full object-contain"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1040px] px-5 py-12 md:px-8 md:py-20">
        <div className="mb-8 text-center md:mb-10">
          <p className="text-[11px] font-black tracking-[0.16em] text-[#8A78CF]">CHOOSE A READING</p>
          <h2 className="mt-2 text-[27px] font-black md:text-[36px]">{copy.choose}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {TAROT_MODE_IDS.map((mode) => (
            <ModeCard key={mode} mode={mode} locale={locale} />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-[640px] text-center text-[12px] font-medium leading-relaxed text-[#2E2E5C]/40">
          {copy.disclaimer}
        </p>
      </section>

      <section className="border-t border-[#2E2E5C]/5 bg-white px-5 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1040px]">
          <h2 className="mb-3 text-[24px] font-black text-[#2E2E5C] md:text-[28px]">
            {copy.faqTitle}
          </h2>

          <div className="divide-y divide-[#E9E9F2] border-y border-[#E9E9F2]">
            {copy.faqs.map((faq) => (
              <details key={faq.question} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[16px] font-bold text-[#2E2E5C] md:text-[17px] [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{faq.question}</span>
                  <span
                    aria-hidden="true"
                    className="flex-shrink-0 text-[22px] font-black leading-none text-[#5B5BEF] transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[#2E2E5C]/70 md:text-[16px]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function ModeCard({ mode, locale }: { mode: TarotMode; locale: TarotLocale }) {
  const content = tarotModes(locale)[mode];
  const copy = LANDING_COPY[locale];
  const accents = {
    one: {
      number: "01",
      label: "TODAY",
      color: "text-[#6A58B5]",
      border: "border-[#DDD5F7]",
      gradient: "from-white via-white to-[#F3EFFF]",
      soft: "bg-[#EEE9FF]",
      solid: "bg-[#6A58B5]",
    },
    three: {
      number: "02",
      label: "STORY",
      color: "text-[#3474A8]",
      border: "border-[#CEE5F6]",
      gradient: "from-white via-white to-[#ECF7FF]",
      soft: "bg-[#E5F3FE]",
      solid: "bg-[#3474A8]",
    },
    "yes-no": {
      number: "03",
      label: "CHOICE",
      color: "text-[#A26A18]",
      border: "border-[#F0DDBA]",
      gradient: "from-white via-white to-[#FFF5E4]",
      soft: "bg-[#FFF0D5]",
      solid: "bg-[#A26A18]",
    },
  } as const;
  const accent = accents[mode];

  return (
    <Link
      href={`${locale === "ko" ? "/ko" : ""}/tarot/${mode}`}
      aria-label={`${content.title}${copy.openSuffix}`}
      className={`group relative min-h-[228px] overflow-hidden rounded-[28px] border bg-gradient-to-br p-6 shadow-[0_12px_32px_rgba(46,46,92,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_46px_rgba(46,46,92,0.13)] ${accent.border} ${accent.gradient}`}
    >
      <span aria-hidden="true" className={`absolute inset-x-7 top-0 h-[3px] rounded-b-full opacity-70 ${accent.solid}`} />
      <span aria-hidden="true" className={`absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-55 blur-3xl ${accent.soft}`} />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-[150px] w-[112px] -translate-y-1/2 transition-transform duration-300 group-hover:-translate-y-[54%] group-hover:rotate-2"
      >
        <span
          className={`absolute left-2 top-5 h-[116px] w-[74px] -rotate-[10deg] rounded-[14px] border-2 bg-white/55 ${accent.border}`}
        />
        <span
          className={`absolute right-1 top-2 flex h-[126px] w-[82px] rotate-[7deg] flex-col items-center justify-between rounded-[14px] border-2 bg-white p-2 shadow-[0_10px_20px_rgba(46,46,92,0.09)] ${accent.border}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${accent.solid}`} />
          <span className={`flex h-12 w-12 items-center justify-center rounded-full ${accent.soft} ${accent.color}`}>
            <ModeIcon mode={mode} />
          </span>
          <span className={`h-1.5 w-1.5 rounded-full ${accent.solid}`} />
        </span>
      </div>

      <div className="relative z-10 flex min-h-[180px] max-w-[72%] flex-col">
        <div className="flex items-center gap-2.5">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.1em] ${accent.soft} ${accent.color}`}>
            {accent.number}
          </span>
          <span className={`text-[10px] font-black tracking-[0.18em] ${accent.color}`}>{accent.label}</span>
        </div>

        <h3 className="mt-5 text-[23px] font-black tracking-[-0.02em]">{content.title}</h3>
        <p className="mt-2 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/52">{content.description}</p>

        <span className={`mt-auto flex items-center gap-2 pt-5 text-[13px] font-black ${accent.color}`}>
          {copy.draw}
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] transition-transform duration-300 group-hover:translate-x-1 ${accent.soft}`}
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

function ModeIcon({ mode }: { mode: TarotMode }) {
  if (mode === "three") {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5.5" width="11" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.5h10.5a2 2 0 0 1 2 2V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m9 10 .7 1.5 1.6.7-1.6.7L9 14.5l-.7-1.6-1.6-.7 1.6-.7L9 10Z" fill="currentColor" />
      </svg>
    );
  }
  if (mode === "yes-no") {
    return (
      <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 8h14m0 0-3-3m3 3-3 3M20 16H6m0 0 3-3m-3 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m12 7 .8 2.1L15 10l-2.2.9L12 13l-.8-2.1L9 10l2.2-.9L12 7Z" fill="currentColor" />
    </svg>
  );
}
