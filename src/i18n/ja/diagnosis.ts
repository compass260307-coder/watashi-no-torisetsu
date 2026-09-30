import type { DiagnosisCopy, DiagnosisLocaleSettings } from "@/i18n/diagnosis";
import { questions } from "@/lib/questions";
const JA_COPY: DiagnosisCopy = {
  heroTitle: "無料性格診断テスト",
  heroSubtitle: "OCEAN（ビッグファイブ）診断でわかる32タイプ",
  heroImageAlt: "ワタシのトリセツのマスコット",
  nicknameLabel: "ニックネーム",
  nicknameHelper: "結果ページに表示される名前です。",
  genderLabel: "あなたのジェンダー（任意）",
  genderOptions: [
    {
      value: "male", label: "男性"
    },
    {
      value: "female", label: "女性"
    },
    {
      value: "other", label: "その他"
    },
  ],
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
    description: "LINEやInstagramなどのSNSアプリ内で診断すると、結果が保存されなかったり、エラーが発生する場合があります。",
    copyButton: "リンクをコピー",
    copiedButton: "コピーしました ✓",
    copyFallback: "うまくコピーできない場合は、下のURLを長押しでコピー：",
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
export const JA_DIAGNOSIS_SETTINGS: DiagnosisLocaleSettings = {
  locale: "ja",
  questions,
  persistProgress: false,
  progressStorageKey: "torisetsu_answers_v2",
  nicknameStorageKey: "torisetsu_nickname_v2",
  genderStorageKey: "torisetsu_gender_v1",
  resultStorageKey: "torisetsu_result",
  startedStorageKey: "torisetsu_diag_started",
  homePath: "/",
  resultPath: "/result",
  copy: JA_COPY,
};
