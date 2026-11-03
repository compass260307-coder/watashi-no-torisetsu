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
      "네. 결과 화면의 ‘이 결과로 Alice와 대화하기’에서 Alice와의 대화로 이동해, 마음에 걸린 카드와 지금의 기분을 더 깊이 정리할 수 있어요.",
  },
] as const satisfies readonly TarotFaq[];

const EN_TAROT_FAQS = [
  { question: "When should I use a tarot reading?", answer: "Use it when you feel undecided or want to hear your own intuition more clearly. The cards are prompts for reflection, not a fixed prediction." },
  { question: "Which reading should I choose?", answer: "Choose Card of the Day for today's focus, Three-Card Reading for a developing situation, and YES / NO for a specific decision." },
  { question: "Can I draw more than once?", answer: "Yes. Still, it is usually more useful to sit with the first draw before trying again for a different answer." },
  { question: "What if a result feels negative?", answer: "No card guarantees a bad future. Read it as a signal about what deserves care and what you can still change." },
  { question: "Can I discuss my result with Alice?", answer: "Yes. Use the Talk with Alice button after your reading to explore the card and your situation in more depth." },
] as const satisfies readonly TarotFaq[];
const ID_TAROT_FAQS = [
  { question: "Kapan sebaiknya saya memakai pembacaan tarot?", answer: "Gunakan saat kamu ragu atau ingin mendengar intuisimu lebih jelas. Kartu adalah bahan refleksi, bukan ramalan yang pasti." },
  { question: "Pembacaan mana yang harus dipilih?", answer: "Pilih Kartu Hari Ini untuk fokus hari ini, Tiga Kartu untuk situasi yang berkembang, dan YA / TIDAK untuk keputusan tertentu." },
  { question: "Bisakah saya menarik kartu lebih dari sekali?", answer: "Bisa. Namun biasanya lebih bermanfaat untuk merenungkan tarikan pertama sebelum mencoba mencari jawaban lain." },
  { question: "Bagaimana jika hasilnya terasa negatif?", answer: "Tidak ada kartu yang menjamin masa depan buruk. Bacalah sebagai tanda tentang hal yang perlu dijaga dan masih bisa kamu ubah." },
  { question: "Bisakah saya membahas hasil dengan Alice?", answer: "Bisa. Gunakan tombol Bicara dengan Alice setelah pembacaan untuk mendalami kartu dan situasimu." },
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
  en: {
    title: "Tarot with Alice",
    lead: "Tarot is not here to lock in your future. With Alice, use the cards to notice what matters now and choose your next step in your own way.",
    heroAlt: "Alice reading tarot cards at a table",
    choose: "What would you like to ask today?",
    disclaimer: "Tarot does not determine the future. Use it as a reflective prompt for understanding your feelings and choices.",
    faqTitle: "Frequently asked questions",
    draw: "Draw cards",
    openSuffix: " reading",
    faqs: EN_TAROT_FAQS,
  },
  id: {
    title: "Tarot bersama Alice",
    lead: "Tarot tidak mengunci masa depanmu. Bersama Alice, gunakan kartu untuk melihat hal yang penting sekarang dan memilih langkah berikutnya dengan caramu sendiri.",
    heroAlt: "Alice membaca kartu tarot di meja",
    choose: "Apa yang ingin kamu tanyakan hari ini?",
    disclaimer: "Tarot tidak menentukan masa depan. Gunakan sebagai bahan refleksi untuk memahami perasaan dan pilihanmu.",
    faqTitle: "Pertanyaan yang sering diajukan",
    draw: "Tarik kartu",
    openSuffix: "",
    faqs: ID_TAROT_FAQS,
  },
} as const;

export default function TarotLanding({
  locale = "ja",
  previewMode = false,
}: {
  locale?: TarotLocale;
  previewMode?: boolean;
}) {
  const copy = LANDING_COPY[locale];
  return (
    <main className="overflow-hidden bg-white text-[#2E2E5C]">
      {locale === "ja" ? (
        <section aria-label="Aliceのタロットの部屋" className="relative isolate h-[calc(100svh-56px)] min-h-[560px] overflow-hidden bg-[#102C30] text-[#FFF7E5] md:h-[850px] md:max-h-[calc(100svh-64px)]">
          <Image
            src="/mascot/tarot-alice-front-room-v1.webp"
            alt="正面を向くAliceと、目の前に広がるタロットテーブル"
            fill
            priority
            sizes="(min-width: 768px) 760px, 100vw"
            className="mx-auto max-w-[760px] origin-bottom object-cover object-center [@media(min-height:1100px)]:scale-[1.10]"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,27,31,0.55)_0%,transparent_30%,transparent_53%,rgba(6,25,29,0.3)_69%,rgba(6,25,29,0.9)_100%)]" />
          <div className="relative mx-auto flex h-full max-w-[640px] flex-col px-3 pb-[calc(84px+env(safe-area-inset-bottom))] pt-7 md:px-6 md:pb-5 md:pt-10">
            <div className="text-center">
              <h1 className="mt-2 text-[clamp(30px,8.5vw,48px)] font-black leading-[1.25] tracking-[0.02em] drop-shadow-md md:text-[52px]">{copy.title}</h1>
              <p className="mt-2 text-[13px] font-medium tracking-[0.06em] text-[#FFF7E5]/85">今日は、何をカードで占う？</p>
            </div>
            <div className="mt-auto pt-6">
              <div className="mx-auto grid w-full max-w-[600px] grid-cols-3 items-center justify-items-center gap-2 md:gap-4">
                {TAROT_MODE_IDS.map((mode, index) => (
                  <Link
                    key={mode}
                    href={previewMode ? `/tarot/dev-preview?mode=${mode}` : `/tarot/${mode}`}
                    aria-label={`${tarotModes(locale)[mode].title}を開く`}
                    className={`group relative flex aspect-square w-full flex-col items-center justify-center rounded-full border-[3px] border-[#FFF8E8]/90 px-1 text-center shadow-[inset_0_3px_14px_#ffffffb3,0_5px_0_#182b3255,0_10px_24px_#0004] transition hover:-translate-y-1 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F6D99C] ${[
                      "bg-[radial-gradient(circle_at_35%_20%,#fff7ff,#e4d5f5_65%,#cbb5e5)] text-[#665084]",
                      "bg-[radial-gradient(circle_at_35%_20%,#f4fff7,#cfeee3_65%,#a4d2c6)] text-[#386e66]",
                      "bg-[radial-gradient(circle_at_35%_20%,#fff9ef,#f8d8dc_65%,#e8b6c1)] text-[#96566e]",
                    ][index]}`}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-[5px] rounded-full border border-dashed border-current opacity-25" />
                    <span aria-hidden="true" className="absolute right-[17%] top-[17%] text-[11px] opacity-60">✧</span>
                    <span aria-hidden="true" className="mb-1.5 flex h-8 items-center justify-center md:mb-2 md:h-10">
                      <svg viewBox="0 0 40 40" className="h-8 w-8 md:h-10 md:w-10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        {index === 0 ? (
                          <>
                            <circle cx="20" cy="20" r="8" fill="currentColor" fillOpacity=".1" />
                            <path d="M20 5v3m0 24v3M5 20h3m24 0h3M9.5 9.5l2.1 2.1m16.8 16.8 2.1 2.1m0-21-2.1 2.1m-16.8 16.8-2.1 2.1" />
                            <path d="M17 19h.1m5.8 0h.1m-6 4c1.8 1.5 4.2 1.5 6 0" />
                          </>
                        ) : index === 1 ? (
                          <>
                            <rect x="7" y="11" width="15" height="23" rx="3" transform="rotate(-18 7 11)" fill="currentColor" fillOpacity=".08" />
                            <rect x="23" y="6" width="15" height="23" rx="3" transform="rotate(18 23 6)" fill="currentColor" fillOpacity=".08" />
                            <rect x="13" y="7" width="15" height="25" rx="3" fill="#e9f8ef" />
                            <path d="m20.5 13 1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6 1.6-4.4Z" />
                          </>
                        ) : (
                          <>
                            <path d="M20 32S6 24 6 15a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 9-14 17-14 17Z" fill="currentColor" fillOpacity=".1" />
                            <path d="M17 16a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4h.01" />
                          </>
                        )}
                      </svg>
                    </span>
                    <span className="text-[clamp(12px,3.5vw,18px)] font-black md:text-[19px]">{tarotModes(locale)[mode].title}</span>
                    <span className="mt-1 text-[9px] font-bold text-current opacity-75 md:text-[11px]">{["今日のヒント", "過去・現在・未来", "迷いをひもとく"][index]}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
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

      )}

      {locale !== "ja" && (
      <section className="mx-auto max-w-[1040px] px-5 py-12 md:px-8 md:py-20">
        <div className="mb-8 text-center md:mb-10">
          <p className="text-[11px] font-black tracking-[0.16em] text-[#8A78CF]">CHOOSE A READING</p>
          <h2 className="mt-2 text-[27px] font-black md:text-[36px]">{copy.choose}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {TAROT_MODE_IDS.map((mode) => (
            <ModeCard
              key={mode}
              mode={mode}
              locale={locale}
              previewMode={previewMode}
            />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-[640px] text-center text-[12px] font-medium leading-relaxed text-[#2E2E5C]/40">
          {copy.disclaimer}
        </p>
      </section>

      )}

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

function ModeCard({
  mode,
  locale,
  previewMode,
}: {
  mode: TarotMode;
  locale: TarotLocale;
  previewMode: boolean;
}) {
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
      href={
        previewMode
          ? `${locale === "ko" ? "/ko" : locale === "en" ? "/en" : locale === "id" ? "/id" : ""}/tarot/dev-preview?mode=${mode}`
          : `${locale === "ko" ? "/ko" : locale === "en" ? "/en" : locale === "id" ? "/id" : ""}/tarot/${mode}`
      }
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
