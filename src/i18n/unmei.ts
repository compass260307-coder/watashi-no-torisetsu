import type { ResultLocale } from "@/i18n/result";

export type BirthLocationOption = {
  value: string;
  label: string;
  latitude?: number;
  longitude?: number;
};

export const KOREAN_BIRTH_REGIONS: readonly BirthLocationOption[] = [
  { value: "서울특별시", label: "서울특별시", latitude: 37.5665, longitude: 126.978 },
  { value: "부산광역시", label: "부산광역시", latitude: 35.1796, longitude: 129.0756 },
  { value: "대구광역시", label: "대구광역시", latitude: 35.8714, longitude: 128.6014 },
  { value: "인천광역시", label: "인천광역시", latitude: 37.4563, longitude: 126.7052 },
  { value: "광주광역시", label: "광주광역시", latitude: 35.1595, longitude: 126.8526 },
  { value: "대전광역시", label: "대전광역시", latitude: 36.3504, longitude: 127.3845 },
  { value: "울산광역시", label: "울산광역시", latitude: 35.5384, longitude: 129.3114 },
  { value: "세종특별자치시", label: "세종특별자치시", latitude: 36.48, longitude: 127.289 },
  { value: "경기도", label: "경기도", latitude: 37.4138, longitude: 127.5183 },
  { value: "강원특별자치도", label: "강원특별자치도", latitude: 37.8228, longitude: 128.1555 },
  { value: "충청북도", label: "충청북도", latitude: 36.8, longitude: 127.7 },
  { value: "충청남도", label: "충청남도", latitude: 36.5184, longitude: 126.8 },
  { value: "전북특별자치도", label: "전북특별자치도", latitude: 35.7175, longitude: 127.153 },
  { value: "전라남도", label: "전라남도", latitude: 34.8679, longitude: 126.991 },
  { value: "경상북도", label: "경상북도", latitude: 36.4919, longitude: 128.8889 },
  { value: "경상남도", label: "경상남도", latitude: 35.4606, longitude: 128.2132 },
  { value: "제주특별자치도", label: "제주특별자치도", latitude: 33.4996, longitude: 126.5312 },
] as const;

type ChatCopy = {
  guideName: string;
  productName: string;
  srTitle: string;
  introInput: readonly string[];
  introPurchase: readonly string[];
  futureDate: string;
  thanks: string;
  askTime: readonly string[];
  unknownTimeAnswer: string;
  askPlace: string;
  unknownTimeReply: string;
  skipAnswer: string;
  skipReply: string;
  editQuestions: Record<"date" | "time" | "place", string>;
  confirmLead: string;
  dateField: string;
  timeField: string;
  placeField: string;
  unknownTimeLabel: string;
  unknownPlaceLabel: string;
  previewConfirmed: string;
  previewPayment: string;
  saveError: string;
  paymentReady: string;
  paymentNext: string;
  generationReady: string;
  networkError: string;
  typing: string;
  waiting: string;
  year: string;
  month: string;
  day: string;
  yearSuffix: string;
  monthSuffix: string;
  daySuffix: string;
  birthTimeAria: string;
  unknownTimeChip: string;
  regionAria: string;
  regionPlaceholder: string;
  cityPlaceholder: string;
  skipChip: string;
  editDate: string;
  editTime: string;
  editPlace: string;
  submitting: string;
  purchaseContinue: string;
  confirm: string;
  send: string;
  formatDate: (year: number, month: number, day: number) => string;
};

export const UNMEI_CHAT_COPY: Record<ResultLocale, ChatCopy> = {
  ja: {
    guideName: "星読みの案内人",
    productName: "運命の設計図",
    srTitle: "あなたの設計図を描くために",
    introInput: [
      "ご購入ありがとうございます。",
      "これから、あなただけの運命の設計図を一緒につくっていきましょう。",
      "まずは、生まれた日のことから教えてください。",
    ],
    introPurchase: [
      "運命の設計図へようこそ。星の配置とあなたの性格から、あなただけの鑑定書をおつくりします。",
      "まずは、あなたが生まれた日を教えてください。",
    ],
    futureDate: "未来の日付は選べないみたいです。もう一度教えてください。",
    thanks: "ありがとうございます。",
    askTime: [
      "次は、生まれた時刻を教えてください。",
      "母子手帳に載っていることが多いです。",
      "わからなくても大丈夫。",
    ],
    unknownTimeAnswer: "時間はわからない",
    askPlace: "最後に、生まれた場所を教えてください。都道府県だけでも大丈夫です。",
    unknownTimeReply: "わかりました。その場合は、お昼12時の空で読みますね。",
    skipAnswer: "スキップする",
    skipReply: "わかりました。出生地は未入力のまま進めますね。",
    editQuestions: {
      date: "生まれた日を、もう一度教えてください。",
      time: "生まれた時刻を、もう一度教えてください。",
      place: "生まれた場所を、もう一度教えてください。",
    },
    confirmLead: "それでは、この内容で設計図を描きます。",
    dateField: "生年月日",
    timeField: "出生時刻",
    placeField: "出生地",
    unknownTimeLabel: "わからない（正午で計算）",
    unknownPlaceLabel: "未入力",
    previewConfirmed: "ありがとうございます。入力内容を確認できました。",
    previewPayment: "本番ではここで出生情報を保存し、最後の商品確認へ進みます。",
    saveError: "うまく保存できませんでした。もう一度お試しください。",
    paymentReady: "ありがとうございます。準備ができました。",
    paymentNext: "最後に、お支払いへ進みます。決済が終わると、その場で星を読みはじめます。",
    generationReady: "受け取りました。それでは——星を読みはじめますね。",
    networkError: "ネットワークエラーが起きました。もう一度試してみてください。",
    typing: "入力中",
    waiting: "あなたが生まれた瞬間の空を再現しています。1分ほどかかることがあります。",
    year: "年",
    month: "月",
    day: "日",
    yearSuffix: "年",
    monthSuffix: "月",
    daySuffix: "日",
    birthTimeAria: "出生時刻",
    unknownTimeChip: "わからない（正午で計算）",
    regionAria: "都道府県",
    regionPlaceholder: "都道府県を選択",
    cityPlaceholder: "市区町村（任意）",
    skipChip: "スキップする",
    editDate: "生年月日を直す",
    editTime: "出生時刻を直す",
    editPlace: "出生地を直す",
    submitting: "送信中…",
    purchaseContinue: "このまま進む",
    confirm: "この内容で描いてもらう",
    send: "送信",
    formatDate: (year, month, day) => `${year}年${month}月${day}日`,
  },
  ko: {
    guideName: "별자리 안내자",
    productName: "운명의 설계도",
    srTitle: "나만의 설계도를 그리기 위한 출생 정보",
    introInput: [
      "어서 오세요. 지금부터 당신의 운명 설계도를 함께 만들어 볼게요.",
      "먼저 태어난 날짜를 알려 주세요.",
    ],
    introPurchase: [
      "운명의 설계도에 오신 것을 환영해요. 별의 배치와 성격 진단을 함께 읽어 나만의 감정서를 만들어요.",
      "먼저 태어난 날짜를 알려 주세요.",
    ],
    futureDate: "미래 날짜는 선택할 수 없어요. 다시 알려 주세요.",
    thanks: "고마워요.",
    askTime: [
      "다음은 태어난 시간을 알려 주세요. 출생 기록에서 확인할 수 있지만, 몰라도 괜찮아요.",
    ],
    unknownTimeAnswer: "태어난 시간을 몰라요",
    askPlace: "마지막으로 태어난 장소를 알려 주세요. 시·도만 선택해도 괜찮아요.",
    unknownTimeReply: "알겠어요. 태어난 시간을 모르면 정오의 하늘을 기준으로 읽을게요.",
    skipAnswer: "건너뛰기",
    skipReply: "알겠어요. 출생지는 입력하지 않은 채로 진행할게요.",
    editQuestions: {
      date: "태어난 날짜를 다시 알려 주세요.",
      time: "태어난 시간을 다시 알려 주세요.",
      place: "태어난 장소를 다시 알려 주세요.",
    },
    confirmLead: "그럼 이 내용으로 운명의 설계도를 그릴게요.",
    dateField: "생년월일",
    timeField: "출생 시간",
    placeField: "출생지",
    unknownTimeLabel: "모름(정오 기준)",
    unknownPlaceLabel: "입력하지 않음",
    previewConfirmed: "고마워요. 입력 내용을 확인했어요.",
    previewPayment: "실제 화면에서는 출생 정보를 저장한 뒤 마지막 상품 확인으로 이동해요.",
    saveError: "정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    paymentReady: "고마워요. 준비가 끝났어요.",
    paymentNext: "마지막으로 결제를 진행해 주세요. 결제가 끝나면 바로 별을 읽기 시작해요.",
    generationReady: "잘 받았어요. 이제 별을 읽기 시작할게요.",
    networkError: "네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
    typing: "입력 중",
    waiting: "태어난 순간의 하늘을 재현하고 있어요. 약 1분 정도 걸릴 수 있어요.",
    year: "년",
    month: "월",
    day: "일",
    yearSuffix: "년",
    monthSuffix: "월",
    daySuffix: "일",
    birthTimeAria: "출생 시간",
    unknownTimeChip: "시간을 몰라요(정오 기준)",
    regionAria: "출생 시·도",
    regionPlaceholder: "시·도 선택",
    cityPlaceholder: "시·군·구(선택)",
    skipChip: "건너뛰기",
    editDate: "생년월일 수정",
    editTime: "출생 시간 수정",
    editPlace: "출생지 수정",
    submitting: "저장 중…",
    purchaseContinue: "계속하기",
    confirm: "이 내용으로 설계도 만들기",
    send: "보내기",
    formatDate: (year, month, day) => `${year}년 ${month}월 ${day}일`,
  },
};

export const UNMEI_READING_COPY = {
  ja: {
    title: "あなたの運命の設計図",
    youAre: "あなたは",
    groupSuffix: "のタイプ",
    fallbackConstellation: "あなたの星座",
    ending: ["星は、答えではなく道しるべ。", "迷ったときは、いつでもこの空に戻ってきてください。"],
    sectionTitles: {
      haichi: "あなたが積み上げてきたもの",
      kokoro: "誰かといるときのあなた",
      chosen: "これから訪れる転換点",
      grace: "最後にひとつだけ",
    },
  },
  ko: {
    title: "나의 운명 설계도",
    youAre: "당신은",
    groupSuffix: " 유형",
    fallbackConstellation: "나의 별자리",
    ending: ["별은 정답이 아니라 길잡이예요.", "길을 잃을 때면 언제든 이 하늘로 돌아오세요."],
    sectionTitles: {
      haichi: "당신이 차곡차곡 쌓아 온 것",
      kokoro: "누군가와 함께 있을 때의 당신",
      chosen: "앞으로 찾아올 전환점",
      grace: "마지막으로 한 가지만",
    },
  },
} as const satisfies Record<ResultLocale, unknown>;

export const UNMEI_CHART_COPY = {
  ja: {
    label: "出生図",
    titleLabel: "あなたの星の称号",
    moon: "月",
    details: (label: string) => `${label}の詳細を見る`,
    scroll: "スクロール",
    arrangement: "あなたが生まれた瞬間の、天体の配置図",
    touchHint: "気になる星に、ふれてみてください",
    timeUnknownNote: "出生時刻が分かると、月の位置が一点に定まります。",
    phrases: [
      "これは、あなたが生まれた瞬間の空。",
      "同じ配置は、もう二度とめぐってこない。",
      "ここから、あなたの物語を読みはじめます。",
    ],
    meanings: {
      sun: "何を大切にして生きるかを照らす、あなたの物語の中心です",
      moon: "ひとりになったとき、心が帰っていく場所を示します",
      mercury: "言葉の選び方、考えの巡らせ方。あなたの知性のかたちです",
      venus: "何に心を動かされ、どんなふうに人を愛するかを示します",
      mars: "一歩を踏み出すとき、あなたの背中を押す内側の火です",
      jupiter: "あなたが自然と広がり、伸びていける方向を指しています",
      saturn: "時間をかけて本物になっていくもの。あなたの成熟を見守る星です",
      asc: "世界と出会う瞬間に、あなたが最初にまとう空気です",
      mc: "長い道の先で、あなたがたどり着く空の頂きです",
    },
  },
  ko: {
    label: "출생 차트",
    titleLabel: "나의 별이 건네는 이름",
    moon: "달",
    details: (label: string) => `${label} 자세히 보기`,
    scroll: "스크롤",
    arrangement: "당신이 태어난 순간의 천체 배치도",
    touchHint: "궁금한 별을 눌러 보세요",
    timeUnknownNote: "출생 시간을 알면 달의 위치를 한 지점으로 정확히 표시할 수 있어요.",
    phrases: [
      "이것은 당신이 태어난 순간의 하늘이에요.",
      "똑같은 별의 배치는 다시 돌아오지 않아요.",
      "이제 여기서 당신의 이야기를 읽기 시작할게요.",
    ],
    meanings: {
      sun: "무엇을 소중히 여기며 살아가는지 비추는 당신 이야기의 중심이에요",
      moon: "혼자 있을 때 마음이 편안하게 돌아가는 곳을 보여 줘요",
      mercury: "말을 고르고 생각을 이어 가는 당신만의 지성 방식을 보여 줘요",
      venus: "무엇에 마음이 움직이고 어떤 방식으로 사랑하는지 보여 줘요",
      mars: "첫걸음을 내디딜 때 등을 밀어 주는 마음속 불꽃이에요",
      jupiter: "당신이 자연스럽게 가능성을 넓히며 성장할 방향을 가리켜요",
      saturn: "시간을 들여 진짜 내 것이 되는 힘과 성숙의 과정을 지켜봐요",
      asc: "세상과 처음 만날 때 자연스럽게 드러나는 당신의 분위기예요",
      mc: "긴 여정 끝에 당신이 향하게 될 하늘의 꼭대기를 보여 줘요",
    },
  },
} as const;
