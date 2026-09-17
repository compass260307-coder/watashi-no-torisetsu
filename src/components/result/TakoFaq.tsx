import type { AppResultLocale } from "@/i18n/result";

type TakoFaqItem = Readonly<{
  question: string;
  answer: string;
}>;

const TAKO_FAQS: Record<AppResultLocale, readonly TakoFaqItem[]> = {
  ja: [
    {
      question: "友達診断とは何ですか？",
      answer:
        "あなたの自己診断と、友達から見たあなたを比べる診断です。回答してくれた友達ごとに、性格タイプや自己認識とのギャップを結果シートで確認できます。友達を招待するときは、「＋ 招待」または「友達に診断してもらう」を押すと、LINE・ほかのアプリ・リンクのコピー・QRコードから招待できます。",
    },
    {
      question: "何人が回答すると結果を見られますか？",
      answer:
        "1人が回答すると、その友達から見たあなたの結果が表示されます。さらに招待すると友達ごとの結果シートが増え、見え方を比較できます。",
    },
    {
      question: "友達は自己診断をしていなくても回答できますか？",
      answer:
        "はい。招待リンクを開けば、自己診断や会員登録をしていない友達でも回答できます。",
    },
    {
      question: "回答した友達には何が表示されますか？",
      answer:
        "送信後に、あなたへの理解度と五つの性格傾向が表示されます。本人向けの詳しい結果シートは、回答した友達には自動で公開されません。",
    },
    {
      question: "誰が回答したか分かりますか？",
      answer:
        "回答時に友達が入力したニックネームが、結果シートに表示されます。任意のひとことが入力されている場合は、そのメッセージも確認できます。",
    },
    {
      question: "友達の回答やメッセージは公開されますか？",
      answer:
        "回答内容やメッセージが公開ページへ自動掲載されることはありません。本人側の友達診断結果として表示されます。",
    },
    {
      question: "結果が出たあとも別の友達を追加できますか？",
      answer:
        "はい。結果上部の「＋ 招待」からいつでも追加できます。回答が届くたびに、その友達の結果シートが増えていきます。",
    },
  ],
  ko: [
    {
      question: "친구 진단이란 무엇인가요?",
      answer:
        "나의 자기 진단과 친구가 보는 나를 비교하는 진단이에요. 답해 준 친구별로 성격 유형과 자기 인식의 차이를 결과 시트에서 확인할 수 있어요. 친구를 초대하려면 ‘＋ 초대’ 또는 ‘친구에게 진단 부탁하기’를 눌러 카카오톡, 다른 앱, 링크 복사, QR 코드로 초대할 수 있어요.",
    },
    {
      question: "몇 명이 답하면 결과를 볼 수 있나요?",
      answer:
        "한 명이 답하면 그 친구가 보는 나의 결과가 표시돼요. 친구를 더 초대하면 친구별 결과 시트가 늘어나 서로 다른 시선을 비교할 수 있어요.",
    },
    {
      question: "친구가 자기 진단을 하지 않아도 답할 수 있나요?",
      answer:
        "네. 초대 링크를 열면 자기 진단이나 회원 가입을 하지 않은 친구도 답할 수 있어요.",
    },
    {
      question: "답한 친구에게는 무엇이 표시되나요?",
      answer:
        "제출 후 나에 대한 이해도와 다섯 가지 성격 경향이 표시돼요. 본인용 상세 결과 시트는 답한 친구에게 자동으로 공개되지 않아요.",
    },
    {
      question: "누가 답했는지 알 수 있나요?",
      answer:
        "친구가 답변할 때 입력한 닉네임이 결과 시트에 표시돼요. 선택 사항인 한마디를 입력했다면 그 메시지도 확인할 수 있어요.",
    },
    {
      question: "친구의 답변과 메시지가 공개되나요?",
      answer:
        "답변 내용과 메시지가 공개 페이지에 자동으로 게시되지는 않아요. 본인 쪽 친구 진단 결과에 표시돼요.",
    },
    {
      question: "결과가 나온 뒤에도 다른 친구를 추가할 수 있나요?",
      answer:
        "네. 결과 위쪽의 ‘＋ 초대’에서 언제든지 추가할 수 있어요. 답변이 도착할 때마다 그 친구의 결과 시트가 늘어나요.",
    },
  ],
  en: [
    {
      question: "What is the friend test?",
      answer:
        "It compares your self-assessment with how a friend sees you. Each friend who responds gets a separate result showing the personality type they see and where their view differs from yours.",
    },
    {
      question: "How many responses do I need?",
      answer:
        "One completed response unlocks the first friend result. Inviting more friends adds more individual results so you can compare different perspectives.",
    },
    {
      question: "Can friends respond without taking the personality test?",
      answer:
        "Yes. Anyone with your invitation link can respond without creating an account or completing their own personality test.",
    },
    {
      question: "What does a friend see after responding?",
      answer:
        "They see how well their answers match your self-assessment and a summary of the five personality dimensions. Your private detailed friend results are not automatically shared with them.",
    },
    {
      question: "Can I see who responded?",
      answer:
        "The nickname each friend enters appears on their result. You can also read their optional message when they leave one.",
    },
    {
      question: "Are responses and messages public?",
      answer:
        "No. Responses and messages appear in your private friend results and are not automatically posted on a public page.",
    },
    {
      question: "Can I invite more friends later?",
      answer:
        "Yes. Use the Invite tab at the top whenever you want. A new result is added each time another friend responds.",
    },
  ],
};

export function TakoFaq({ locale = "ja" }: { locale?: AppResultLocale }) {
  const items = TAKO_FAQS[locale];
  const title =
    locale === "en" ? "Frequently asked questions" : locale === "ko" ? "자주 묻는 질문" : "よくある質問";

  return (
    <section
      aria-labelledby="tako-faq-title"
      className="bg-white px-4 pb-4 pt-6 md:px-8 md:pb-6 md:pt-8 print:hidden"
    >
      <div className="mx-auto max-w-[1080px]">
        <h2
          id="tako-faq-title"
          className="text-[22px] font-black tracking-[0.01em] text-[#2E2E5C] md:text-[28px]"
        >
          {title}
        </h2>

        <div className="mt-6 border-t border-[#E9E9F2]">
          {items.map((item) => (
            <details key={item.question} className="group border-b border-[#E9E9F2]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-4 text-left text-[14px] font-black leading-[1.65] text-[#333747] outline-none transition-colors hover:text-[#268BB5] focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/35 md:py-5 md:text-[16px] [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="relative h-5 w-5 shrink-0 text-[#268BB5] transition-transform duration-200 group-open:rotate-45"
                >
                  <span className="absolute left-1/2 top-1/2 h-px w-3.5 -translate-x-1/2 -translate-y-1/2 bg-current" />
                  <span className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-current" />
                </span>
              </summary>
              <p className="body-gothic max-w-[900px] pb-5 pr-10 text-[14px] font-normal leading-[1.9] text-[#6B7280] md:pb-6 md:text-[15px]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
