import type { ResultLocale } from "@/i18n/result";

type HoshiyomiFaq = Readonly<{ question: string; answer: string }>;

type HoshiyomiCopy = Readonly<{
  faqs: readonly HoshiyomiFaq[];
  title: string;
  heroAlt: string;
  description: string;
  exhaustedPlaceholder: string;
  inputPlaceholder: string;
  startAria: string;
  purchaseHint: string;
  persistencePending: string;
  historyTitle: string;
  historyEmpty: string;
  messageCount: (count: number) => string;
  openConversation: string;
  deleteAria: string;
  entertainmentNotice: string;
  faqTitle: string;
  closeAria: string;
  contactPrefix: string;
  contactLabel: string;
  contactSuffix: string;
  responseError: string;
  previewResponse: string;
  backAria: string;
  guideName: string;
  guideStatus: string;
  composerPlaceholder: string;
  sendAria: string;
  chatNotice: string;
  sentMessages: (used: number, total: number) => string;
  faqButton: string;
  remainingMessages: (remaining: number, total: number) => string;
  dateLocale: string;
}>;

const JA_COPY: HoshiyomiCopy = {
  faqs: [
    {
      question: "AI占い師「Alice」とは何ですか？",
      answer:
        "あなたの性格診断と、作成済みの場合は運命の設計図も参考にしながら、悩みや気持ちを整理するAIの対話相手です。未来を断定するのではなく、あなた自身が納得できる選び方を見つけるお手伝いをします。",
    },
    {
      question: "どのコースで利用できますか？",
      answer:
        "完全版コース（¥499）には5回分、プレミアムコース（¥899）には30回分が含まれます。お試しコース（¥199）にはチャット利用分は含まれません。いずれも月額ではなく買い切りです。",
    },
    {
      question: "運命の設計図をまだ作っていなくても話せますか？",
      answer:
        "はい。自己診断の結果をもとに会話できます。出生情報を登録して運命の設計図を作成すると、星読みの内容も踏まえた、よりあなたに合わせた対話になります。",
    },
    {
      question: "チャット回数はどのように数えますか？",
      answer:
        "相談を送り、Aliceから正常に返信が届いたときに1回として数えます。通信エラーなどで返信が完了しなかった場合は、利用回数を戻します。",
    },
    {
      question: "利用回数を増やすことはできますか？",
      answer:
        "完全版コースからプレミアムコースへは、購入済み金額との差額でアップグレードでき、購入分は合計30回になります。30回を使い切った後の追加購入は、現在は対応していません。",
    },
    {
      question: "過去の会話をもう一度見られますか？",
      answer:
        "はい。会話は自動で保存され、Aliceのページからあとで開けます。ページには更新日の新しいものから最大12件を表示します。不要になった会話は削除できます。",
    },
    {
      question: "会話をほかの人に見られることはありますか？",
      answer:
        "会話がほかの利用者へ公開されることはありません。回答生成と履歴保存のため、入力内容はサービスとAIモデル提供者で必要な範囲に限って処理されます。詳しくはプライバシーポリシーをご確認ください。",
    },
    {
      question: "会話をダウンロードできますか？",
      answer:
        "現在、会話履歴のダウンロードや書き出しには対応していません。必要な内容は、お使いの端末で保存してください。",
    },
    {
      question: "大切な判断を相談しても大丈夫ですか？",
      answer:
        "星読みはエンターテインメントであり、医療・法律・金融などの専門的な助言ではありません。重要な判断が必要な場合は、必ず専門家へご相談ください。",
    },
  ],
  title: "AI占い師「Alice」と話す",
  heroAlt: "星図を広げた机で案内する、AI占い師Aliceのフェルトうさぎ",
  description:
    "性格診断とあなたの星読みを一緒に見ながら、いま気になっていることを整理します。答えを決めつけず、あなた自身の選び方を見つけるための対話です。",
  exhaustedPlaceholder: "チャット回数を使い切りました",
  inputPlaceholder: "今、何が気になっていますか？",
  startAria: "会話を始める",
  purchaseHint: "相談内容を送信すると、チャット付きコースを選べます。",
  persistencePending: "会話の保存準備中です。データベース更新後に利用できます。",
  historyTitle: "これまでの会話",
  historyEmpty: "まだ会話はありません。気になることから話してみましょう。",
  messageCount: (count) => `${count}件のメッセージ`,
  openConversation: "会話を開く",
  deleteAria: "会話を削除",
  entertainmentNotice:
    "星読みはエンターテインメントです。医療・法律・金融など重要な判断は専門家にご相談ください。",
  faqTitle: "よくある質問",
  closeAria: "閉じる",
  contactPrefix: "解決しない場合は、",
  contactLabel: "お問い合わせ",
  contactSuffix: "ください。",
  responseError: "星をうまく読めませんでした。少し時間をおいて、もう一度お試しください。",
  previewResponse:
    "話してくれてありがとうございます。いま感じている迷いには、あなたが大切にしたいものが隠れていそうです。星読みと性格診断を手がかりに、もう少し一緒に整理してみましょう。\n\nその出来事の中で、いちばん心が動いたのはどんな瞬間でしたか？",
  backAria: "会話一覧へ戻る",
  guideName: "Alice",
  guideStatus: "あなたの星と性格を見ながらお話しします",
  composerPlaceholder: "メッセージを入力…",
  sendAria: "送信",
  chatNotice: "星読みは未来を断定するものではなく、考えを整理するためのヒントです。",
  sentMessages: (used, total) => `${used}/${total}件のメッセージを送信しました。`,
  faqButton: "質問はありますか？",
  remainingMessages: (remaining, total) =>
    `チャット残り${remaining}回（購入分 ${total}回）`,
  dateLocale: "ja-JP",
};

const KO_COPY: HoshiyomiCopy = {
  faqs: [
    {
      question: "별자리 상담사는 무엇인가요?",
      answer:
        "나의 성격 진단과, 이미 만들었다면 운명의 설계도까지 참고하며 고민과 감정을 정리해 주는 AI 대화 상대예요. 미래를 단정하지 않고 스스로 납득할 수 있는 선택을 찾도록 도와드려요.",
    },
    {
      question: "어떤 코스에서 이용할 수 있나요?",
      answer:
        "완전판 코스(₩4,900)에는 5회, 프리미엄 코스(₩8,900)에는 30회의 채팅이 포함돼요. 라이트 코스(₩1,900)에는 채팅이 포함되지 않아요. 모든 코스는 구독이 아닌 1회 결제예요.",
    },
    {
      question: "운명의 설계도를 아직 만들지 않아도 대화할 수 있나요?",
      answer:
        "네. 자기 진단 결과를 바탕으로 대화할 수 있어요. 출생 정보를 등록해 운명의 설계도를 만들면 별자리 해석까지 참고해 나에게 더 잘 맞는 대화를 이어갈 수 있어요.",
    },
    {
      question: "채팅 횟수는 어떻게 계산하나요?",
      answer:
        "상담 내용을 보내고 별자리 상담사의 답변이 정상적으로 도착했을 때 1회로 계산해요. 통신 오류 등으로 답변이 완료되지 않으면 이용 횟수를 돌려드려요.",
    },
    {
      question: "이용 횟수를 늘릴 수 있나요?",
      answer:
        "완전판에서 프리미엄으로 이미 결제한 금액만큼을 뺀 차액으로 업그레이드하면 총 30회를 이용할 수 있어요. 30회를 모두 사용한 뒤의 추가 구매는 현재 지원하지 않아요.",
    },
    {
      question: "지난 대화를 다시 볼 수 있나요?",
      answer:
        "네. 대화는 자동으로 저장되며 별자리 상담사 페이지에서 다시 열 수 있어요. 최근에 업데이트된 순서로 최대 12개를 표시하며, 필요 없는 대화는 삭제할 수 있어요.",
    },
    {
      question: "다른 사람이 내 대화를 볼 수 있나요?",
      answer:
        "대화가 다른 이용자에게 공개되지는 않아요. 답변 생성과 기록 저장을 위해 입력 내용은 서비스와 AI 모델 제공자가 필요한 범위에서만 처리해요. 자세한 내용은 개인정보처리방침을 확인해 주세요.",
    },
    {
      question: "대화를 다운로드할 수 있나요?",
      answer:
        "현재 대화 기록 다운로드나 내보내기는 지원하지 않아요. 필요한 내용은 이용 중인 기기에서 따로 저장해 주세요.",
    },
    {
      question: "중요한 결정을 상담해도 괜찮나요?",
      answer:
        "별자리 상담은 엔터테인먼트이며 의료·법률·금융 등의 전문 조언이 아니에요. 중요한 판단이 필요할 때는 반드시 해당 분야의 전문가와 상담해 주세요.",
    },
  ],
  title: "별자리 상담사와 대화하기",
  heroAlt: "별자리를 펼친 책상에서 안내하는 펠트 토끼 상담사",
  description:
    "성격 진단과 나의 별자리 해석을 함께 보며 지금 마음에 걸리는 일을 정리해요. 답을 정해 주는 대신, 스스로 납득할 수 있는 선택을 찾기 위한 대화예요.",
  exhaustedPlaceholder: "채팅 횟수를 모두 사용했어요",
  inputPlaceholder: "지금 무엇이 마음에 걸리나요?",
  startAria: "대화 시작하기",
  purchaseHint: "상담 내용을 보내면 채팅이 포함된 코스를 선택할 수 있어요.",
  persistencePending: "대화 저장 기능을 준비하고 있어요. 데이터베이스 업데이트 후 이용할 수 있어요.",
  historyTitle: "지난 대화",
  historyEmpty: "아직 대화가 없어요. 지금 마음에 걸리는 일부터 이야기해 보세요.",
  messageCount: (count) => `메시지 ${count}개`,
  openConversation: "대화 열기",
  deleteAria: "대화 삭제",
  entertainmentNotice:
    "별자리 상담은 엔터테인먼트예요. 의료·법률·금융 등 중요한 판단은 전문가와 상담해 주세요.",
  faqTitle: "자주 묻는 질문",
  closeAria: "닫기",
  contactPrefix: "해결되지 않았다면 ",
  contactLabel: "문의해 주세요",
  contactSuffix: ".",
  responseError: "별을 제대로 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.",
  previewResponse:
    "이야기해 주셔서 고마워요. 지금 느끼는 망설임 속에는 소중히 지키고 싶은 마음이 숨어 있는 것 같아요. 별자리 해석과 성격 진단을 단서로 조금 더 함께 정리해 볼게요.\n\n그 일에서 마음이 가장 크게 움직였던 순간은 언제였나요?",
  backAria: "대화 목록으로 돌아가기",
  guideName: "별자리 상담사",
  guideStatus: "나의 별과 성격을 함께 보며 이야기해요",
  composerPlaceholder: "메시지를 입력하세요…",
  sendAria: "보내기",
  chatNotice: "별자리 상담은 미래를 단정하지 않으며 생각을 정리하기 위한 참고 자료예요.",
  sentMessages: (used, total) => `메시지를 ${used}/${total}회 보냈어요.`,
  faqButton: "궁금한 점이 있나요?",
  remainingMessages: (remaining, total) =>
    `채팅 ${remaining}회 남음 (구매 횟수 ${total}회)`,
  dateLocale: "ko-KR",
};

export const HOSHIYOMI_COPY: Record<ResultLocale, HoshiyomiCopy> = {
  ja: JA_COPY,
  ko: KO_COPY,
};
