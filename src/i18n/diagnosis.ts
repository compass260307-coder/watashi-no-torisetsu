import { questions } from "@/lib/questions";
import type { AnswerValue, Question } from "@/lib/types";

export type DiagnosisLocale = "ja" | "ko";

export interface InAppBrowserCopy {
  title: string;
  description: string;
  copyButton: string;
  copiedButton: string;
  copyFallback: string;
  continueButton: string;
}

export interface DiagnosisCopy {
  heroTitle: string;
  heroSubtitle: string;
  heroImageAlt: string;
  nicknameLabel: string;
  nicknameEmptyError: string;
  nicknameTooLongError: (max: number) => string;
  nicknameRequired: string;
  nextButton: string;
  resultButton: string;
  submittingButton: string;
  submitError: string;
  previousPage: string;
  progressAriaLabel: (current: number, total: number) => string;
  questionAriaLabel: (number: number) => string;
  likertLeft: string;
  likertRight: string;
  likertOptions: Record<AnswerValue, string>;
  resume: {
    title: string;
    lead: string;
    unit: string;
    countSuffix: string;
    tail: string;
    continueButton: string;
    freshButton: string;
  };
  rediagnose: {
    title: string;
    lead: string;
    emphasis: string;
    emphasisSuffix: string;
    tail: string;
    confirmButton: string;
    cancelButton: string;
  };
  inAppBrowser: InAppBrowserCopy;
  analyzing: {
    messages: string[];
    steps: string[];
  };
}

interface DiagnosisLocaleSettings {
  locale: DiagnosisLocale;
  questions: Question[];
  progressStorageKey: string;
  nicknameStorageKey: string;
  resultStorageKey: string;
  startedStorageKey: string;
  homePath: string;
  resultPath: string;
  copy: DiagnosisCopy;
}

const JA_COPY: DiagnosisCopy = {
  heroTitle: "無料性格診断テスト",
  heroSubtitle: "OCEAN（ビッグファイブ）診断でわかる32タイプ",
  heroImageAlt: "ワタシのトリセツのマスコット",
  nicknameLabel: "ニックネームを教えて",
  nicknameEmptyError: "ニックネームを入力してね",
  nicknameTooLongError: (max) => `${max} 文字以内で入力してね`,
  nicknameRequired: "ニックネームを入力してね",
  nextButton: "次へ",
  resultButton: "結果を見る",
  submittingButton: "診断中...",
  submitError: "送信に失敗しました。もう一度お試しください。",
  previousPage: "前のページ",
  progressAriaLabel: (current, total) => `質問 ${current} / ${total}`,
  questionAriaLabel: (number) => `質問 ${number}`,
  likertLeft: "強くそう思う",
  likertRight: "強くそう思わない",
  likertOptions: {
    7: "強くそう思う",
    6: "そう思う",
    5: "ややそう思う",
    4: "どちらでもない",
    3: "あまりそう思わない",
    2: "そう思わない",
    1: "強くそう思わない",
  },
  resume: {
    title: "🔖 前回の続きから?",
    lead: "前回の回答が残っています",
    unit: "問",
    countSuffix: ")。",
    tail: "続きから再開できます。",
    continueButton: "前回の続きから",
    freshButton: "最初からやり直す",
  },
  rediagnose: {
    title: "🔄 再診断について",
    lead: "過去の診断とトリセツ図鑑は",
    emphasis: "全部残ります",
    emphasisSuffix: "。",
    tail: "新しいあなたの発見、楽しみですね 🐧",
    confirmButton: "OK、新しく診断する",
    cancelButton: "キャンセル (マイ図鑑に戻る)",
  },
  inAppBrowser: {
    title: "SafariやChromeでの利用を推奨しています",
    description:
      "LINEやInstagramなどのSNSアプリ内で診断すると、結果が保存されなかったり、エラーが発生する場合があります。",
    copyButton: "リンクをコピー",
    copiedButton: "コピーしました ✓",
    copyFallback:
      "うまくコピーできない場合は、下のURLを長押しでコピー：",
    continueButton: "このまま続ける",
  },
  analyzing: {
    messages: [
      "あなたの回答を読み込んでいます...",
      "Big Five 心理学で解析中...",
      "開放性・誠実性・外向性を判定...",
      "協調性・神経症傾向を分析...",
      "あなたを表すタイプを探しています...",
      "8タイプから絞り込み中...",
      "あなただけの強みを見つけています...",
      "あなたの取扱説明書を綴っています...",
      "最後の仕上げをしています...",
      "もうすぐお届けします...",
    ],
    steps: [
      "回答データを取得",
      "性格特性を解析",
      "タイプを判定",
      "トリセツを生成",
    ],
  },
};

const KO_QUESTIONS: Question[] = [
  { id: 1, text: "그룹에서 의견이 갈릴 때 내 생각을 분명하게 말하는 편이다.", facetId: "E_assertiveness", dimension: "E", reversed: false },
  { id: 2, text: "다 같이 ‘어디 갈까?’ 할 때 내가 먼저 후보를 제안한다.", facetId: "E_assertiveness", dimension: "E", reversed: false },
  { id: 3, text: "하고 싶은 말이 있어도 분위기를 살피며 삼키는 경우가 많다.", facetId: "E_assertiveness", dimension: "E", reversed: true },
  { id: 4, text: "아니라고 생각하면 상대가 누구든 ‘그건 아닌 것 같아’라고 말할 수 있다.", facetId: "E_assertiveness", dimension: "E", reversed: false },
  { id: 5, text: "많은 사람 앞에서 발표하는 일은 가능하면 피하고 싶다.", facetId: "E_assertiveness", dimension: "E", reversed: true },
  { id: 6, text: "처음 만난 사람과도 비교적 금방 친해지는 편이다.", facetId: "E_warmth", dimension: "E", reversed: false },
  { id: 7, text: "친구가 기운 없어 보이면 내가 먼저 말을 건다.", facetId: "E_warmth", dimension: "E", reversed: false },
  { id: 8, text: "낯선 사람과 이야기하는 것은 가능하면 피하고 싶다.", facetId: "E_warmth", dimension: "E", reversed: true },
  { id: 9, text: "사람들과 이야기하다 보면 자연스럽게 웃고 있다.", facetId: "E_warmth", dimension: "E", reversed: false },
  { id: 10, text: "내가 먼저 다른 사람에게 깊이 다가가는 일은 적은 편이다.", facetId: "E_warmth", dimension: "E", reversed: true },
  { id: 11, text: "조별 활동에서는 내 의견보다 전체 흐름을 우선한다.", facetId: "A_cooperation", dimension: "A", reversed: false },
  { id: 12, text: "친구와 의견이 달라도 결국 상대에게 맞추는 경우가 많다.", facetId: "A_cooperation", dimension: "A", reversed: false },
  { id: 13, text: "내 방식을 바꿔 가면서까지 다른 사람에게 맞추고 싶지는 않다.", facetId: "A_cooperation", dimension: "A", reversed: true },
  { id: 14, text: "모두가 즐거울 수 있다면 내가 조금 참는 것은 괜찮다.", facetId: "A_cooperation", dimension: "A", reversed: false },
  { id: 15, text: "‘내 의견대로 하고 싶다’고 생각하는 일이 자주 있다.", facetId: "A_cooperation", dimension: "A", reversed: true },
  { id: 16, text: "친구가 울고 있으면 나도 따라 울 것 같다.", facetId: "A_sympathy", dimension: "A", reversed: false },
  { id: 17, text: "영화나 만화를 볼 때 등장인물의 감정에 쉽게 몰입한다.", facetId: "A_sympathy", dimension: "A", reversed: false },
  { id: 18, text: "다른 사람의 감정 변화에는 비교적 무관심한 편이다.", facetId: "A_sympathy", dimension: "A", reversed: true },
  { id: 19, text: "친구 표정이 조금만 달라져도 무슨 일이 있는지 신경 쓰인다.", facetId: "A_sympathy", dimension: "A", reversed: false },
  { id: 20, text: "‘내 마음을 알아줬으면 좋겠어’라는 말을 들어도 잘 모르겠다.", facetId: "A_sympathy", dimension: "A", reversed: true },
  { id: 21, text: "‘가 본 적 없는 가게’라는 말을 들으면 가 보고 싶어진다.", facetId: "O_adventurousness", dimension: "O", reversed: false },
  { id: 22, text: "여행지에서는 유명한 곳보다 현지인만 아는 장소를 고른다.", facetId: "O_adventurousness", dimension: "O", reversed: false },
  { id: 23, text: "새로운 장소보다 익숙한 장소가 더 편안하다.", facetId: "O_adventurousness", dimension: "O", reversed: true },
  { id: 24, text: "‘한 번도 안 해 본 일’을 제안받으면 비교적 흔쾌히 한다.", facetId: "O_adventurousness", dimension: "O", reversed: false },
  { id: 25, text: "처음 해 보는 경험 앞에서는 나도 모르게 조심스러워진다.", facetId: "O_adventurousness", dimension: "O", reversed: true },
  { id: 26, text: "멍하니 있을 때 머릿속에 저절로 이야기가 떠오른다.", facetId: "O_imagination", dimension: "O", reversed: false },
  { id: 27, text: "같은 풍경을 봐도 다른 사람보다 여러 생각을 하는 것 같다.", facetId: "O_imagination", dimension: "O", reversed: false },
  { id: 28, text: "공상이나 상상에 빠지는 일은 거의 없다.", facetId: "O_imagination", dimension: "O", reversed: true },
  { id: 29, text: "‘만약 ○○라면?’을 상상하는 것을 좋아한다.", facetId: "O_imagination", dimension: "O", reversed: false },
  { id: 30, text: "현실적인 것만 생각하고 싶은 편이다.", facetId: "O_imagination", dimension: "O", reversed: true },
  { id: 31, text: "‘이건 꼭 해내고 싶다’는 목표가 늘 머릿속에 있다.", facetId: "C_achievement", dimension: "C", reversed: false },
  { id: 32, text: "시험이나 과제에서는 평균보다 높은 결과를 목표로 한다.", facetId: "C_achievement", dimension: "C", reversed: false },
  { id: 33, text: "‘느긋하게 보내는 것’이 가장 큰 행복이라고 생각한다.", facetId: "C_achievement", dimension: "C", reversed: true },
  { id: 34, text: "나만의 목표를 세우고 그것을 향해 움직이는 편이다.", facetId: "C_achievement", dimension: "C", reversed: false },
  { id: 35, text: "특별한 목표가 없어도 하루하루 나름대로 즐겁다.", facetId: "C_achievement", dimension: "C", reversed: true },
  { id: 36, text: "책상 위나 가방 안이 비교적 정돈되어 있다.", facetId: "C_orderliness", dimension: "C", reversed: false },
  { id: 37, text: "일정은 플래너나 앱으로 꼼꼼하게 관리한다.", facetId: "C_orderliness", dimension: "C", reversed: false },
  { id: 38, text: "방이 어질러져 있어도 크게 신경 쓰이지 않는다.", facetId: "C_orderliness", dimension: "C", reversed: true },
  { id: 39, text: "무언가를 시작하기 전에 먼저 순서와 계획을 생각한다.", facetId: "C_orderliness", dimension: "C", reversed: false },
  { id: 40, text: "‘나중에 정리하면 되지’ 하며 미뤄 두는 경우가 많다.", facetId: "C_orderliness", dimension: "C", reversed: true },
  { id: 41, text: "짜증이 나면 나도 모르게 표정이나 태도에 드러난다.", facetId: "N_volatility", dimension: "N", reversed: false },
  { id: 42, text: "싫은 일이 생기면 한동안 기분이 풀리지 않는 편이다.", facetId: "N_volatility", dimension: "N", reversed: false },
  { id: 43, text: "감정이 흔들려도 겉으로 드러내지 않는 편이다.", facetId: "N_volatility", dimension: "N", reversed: true },
  { id: 44, text: "친구와 다툴 때 감정을 억누르기 어려워진다.", facetId: "N_volatility", dimension: "N", reversed: false },
  { id: 45, text: "어떤 상황에서도 비교적 침착함을 유지할 수 있다.", facetId: "N_volatility", dimension: "N", reversed: true },
  { id: 46, text: "잠들기 전 오늘 있었던 일을 떠올리며 깊이 생각하곤 한다.", facetId: "N_anxiety", dimension: "N", reversed: false },
  { id: 47, text: "시험이나 발표 전에는 여러 번 확인하지 않으면 불안하다.", facetId: "N_anxiety", dimension: "N", reversed: false },
  { id: 48, text: "앞날을 걱정하는 일은 별로 없다.", facetId: "N_anxiety", dimension: "N", reversed: true },
  { id: 49, text: "‘그렇게 말해도 괜찮았을까?’ 하고 자주 되돌아본다.", facetId: "N_anxiety", dimension: "N", reversed: false },
  { id: 50, text: "무슨 일이 생기면 그때 해결하면 된다고 생각할 수 있다.", facetId: "N_anxiety", dimension: "N", reversed: true },
];

const KO_COPY: DiagnosisCopy = {
  heroTitle: "무료 성격 진단 테스트",
  heroSubtitle: "OCEAN으로 알아보는 32가지 유형",
  heroImageAlt: "나의 사용설명서 마스코트",
  nicknameLabel: "별명을 알려 주세요",
  nicknameEmptyError: "별명을 입력해 주세요",
  nicknameTooLongError: (max) => `${max}자 이내로 입력해 주세요`,
  nicknameRequired: "별명을 입력해 주세요",
  nextButton: "다음",
  resultButton: "결과 보기",
  submittingButton: "진단 중...",
  submitError: "전송에 실패했어요. 다시 시도해 주세요.",
  previousPage: "이전 페이지",
  progressAriaLabel: (current, total) => `질문 ${current} / ${total}`,
  questionAriaLabel: (number) => `질문 ${number}`,
  likertLeft: "매우 그렇다",
  likertRight: "전혀 그렇지 않다",
  likertOptions: {
    7: "매우 그렇다",
    6: "그렇다",
    5: "조금 그렇다",
    4: "어느 쪽도 아니다",
    3: "별로 그렇지 않다",
    2: "그렇지 않다",
    1: "전혀 그렇지 않다",
  },
  resume: {
    title: "🔖 이전 진단을 이어서 할까요?",
    lead: "이전에 답한 내용이 남아 있어요",
    unit: "문항",
    countSuffix: ").",
    tail: "이어서 진행할 수 있어요.",
    continueButton: "이어서 하기",
    freshButton: "처음부터 다시 하기",
  },
  rediagnose: {
    title: "🔄 다시 진단하기",
    lead: "이전 진단과 사용설명서 도감은 ",
    emphasis: "모두 그대로 남아 있어요",
    emphasisSuffix: ".",
    tail: "새로운 나를 발견해 볼까요? 🐧",
    confirmButton: "새로 진단하기",
    cancelButton: "취소하고 홈으로 돌아가기",
  },
  inAppBrowser: {
    title: "Safari 또는 Chrome 사용을 권장해요",
    description:
      "LINE이나 Instagram 같은 SNS 앱 안에서 진단하면 결과가 저장되지 않거나 오류가 발생할 수 있어요.",
    copyButton: "링크 복사",
    copiedButton: "복사했어요 ✓",
    copyFallback: "복사가 안 되면 아래 URL을 길게 눌러 복사해 주세요:",
    continueButton: "그대로 계속하기",
  },
  analyzing: {
    messages: [
      "답변을 불러오고 있어요...",
      "Big Five 심리학으로 분석하고 있어요...",
      "개방성·성실성·외향성을 확인하고 있어요...",
      "우호성·정서적 민감성을 분석하고 있어요...",
      "나를 나타내는 유형을 찾고 있어요...",
      "32가지 유형 중 가장 가까운 유형을 찾고 있어요...",
      "나만의 강점을 발견하고 있어요...",
      "나의 사용설명서를 만들고 있어요...",
      "마지막으로 다듬고 있어요...",
      "곧 결과를 보여 드릴게요...",
    ],
    steps: ["답변 확인", "성격 특성 분석", "유형 판정", "사용설명서 생성"],
  },
};

export const DIAGNOSIS_LOCALES: Record<
  DiagnosisLocale,
  DiagnosisLocaleSettings
> = {
  ja: {
    locale: "ja",
    questions,
    progressStorageKey: "torisetsu_answers_v2",
    nicknameStorageKey: "torisetsu_nickname_v2",
    resultStorageKey: "torisetsu_result",
    startedStorageKey: "torisetsu_diag_started",
    homePath: "/",
    resultPath: "/result",
    copy: JA_COPY,
  },
  ko: {
    locale: "ko",
    questions: KO_QUESTIONS,
    progressStorageKey: "torisetsu_answers_v2_ko",
    nicknameStorageKey: "torisetsu_nickname_v2_ko",
    resultStorageKey: "torisetsu_result_ko",
    startedStorageKey: "torisetsu_diag_started_ko",
    homePath: "/ko",
    resultPath: "/ko/result",
    copy: KO_COPY,
  },
};
