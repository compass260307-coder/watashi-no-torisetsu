import type { DiagnosisCopy, DiagnosisLocaleSettings } from "@/i18n/diagnosis";
import {
  JA_DEFAULT_QUESTION_SET_ID,
  JA_QUESTION_SET_REVISION,
  JA_QUESTION_SETS,
} from "@/lib/question-sets";
const JA_COPY: DiagnosisCopy = {
  heroTitle: "無料性格診断テスト",
  heroSubtitle: "Big Five 性格特性モデル準拠",
  heroImageAlt: "ワタシのトリセツのマスコット",
  heroSteps: [
    {
      label: "ステップ1",
      title: "テストに答える",
      titleSp: "50問に答える",
      body: "質問は50問、約5分で終わります。ありのままの自分で答えてください。",
    },
    {
      label: "ステップ2",
      title: "性格タイプを知る",
      titleSp: "32タイプから性格を診断",
      body: "32タイプの中から診断し、あなたの性格をくわしく解説します。",
    },
    {
      label: "ステップ3",
      title: "新しい自分に出会おう",
      titleSp: "友達診断で新しい自分を発見",
      body: "友達にも答えてもらえば、自分では気づけない一面が見つかります。",
    },
  ],
  nicknameLabel: "ニックネーム",
  nicknameRequiredBadge: "必須",
  genderLabel: "性別（任意）",
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
  ageLabel: "年代（任意）",
  ageOptions: [
    { value: "10s", label: "10代" },
    { value: "20s_early", label: "20代前半" },
    { value: "20s_late", label: "20代後半" },
    { value: "30s", label: "30代" },
    { value: "40s", label: "40代" },
    { value: "50s_plus", label: "50代以上" },
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
      "32タイプから絞り込み中...",
      "友達から見た性格を予測中...",
      "あなたの診断結果をまとめています...",
      "もうすぐ確認できます...",
    ],
    // 見せたいメッセージ (Big Five解析中 / 協調性・神経症傾向 / 32タイプ絞り込み /
    // 友達から見た性格を予測) を3秒に延ばし、つなぎを1.4秒に短縮してリズムを作る。
    // 合計18.2秒で最後に到達する。
    // ※ 紹介スライドを出している間はメッセージ自体を表示しない (スライドの文が主役のため)。
    messageDurationsMs: [1400, 3000, 1400, 3000, 1400, 3000, 3000, 2000],
    // 最低表示は20秒。経緯: 20秒 (マスコット動画) → 22.5秒 (2026-11-16 紹介スライド4枚) →
    // 32.5秒 (2026-11-17 5枚) → 20秒 (同日)。待ち時間を延ばすたびに、診断完了後に結果ページへ
    // たどり着かない人が増えたため (19〜22時台: 20秒 1.0% → 22.5秒 2.0% → 32.5秒 3.5%)、
    // 「友達が30問に答えたら完成」の1枚を外して4枚・20秒に戻した。
    minLoadingMs: 20000,
    // 友達診断の存在を知らないまま結果を読み終える人が多いため、待ち時間に紹介する。
    // マスコット動画の代わりに4枚を流す。①〜③は4.5秒ずつ、行動につなげる最後の1枚だけ6.5秒。
    // 文は1枚につき1行だけ。
    slideDurationsMs: [4500, 4500, 4500, 6500],
    slidesLabel: "友達診断とは？",
    slides: [
      {
        // ① 何か: 自己診断のあなたのカードがめくれて、友達診断のあなた (別のキャラ) が出る。
        // 実際の結果の「◯◯から見たあなた」をそのまま見せる (2026-11-17。旧: 友達3人の一言が届く図)。
        visual: {
          kind: "flip",
          selfTitle: "自分から見たあなた",
          selfFace: "/characters/face/penguin_N.webp",
          selfWord: "マイペース",
          friendTitle: "友達から見たあなた",
          perceivedFace: "/characters/face/fox_N.webp",
          perceivedColor: "#E8B84A",
          perceivedWord: "実はリーダー気質！",
        },
        tint: "#EAF6F9",
        text: "友達があなたを診断してくれるよ！",
        highlight: "友達",
      },
      {
        // ② やり方: リンクを送る。トーク画面風にして、頼む手軽さと
        // 「気軽に答えてもらえる」ことを見せる (2026-11-17)。
        visual: {
          kind: "chat",
          message: "友達診断おねがい！",
          linkLabel: "友達診断リンク",
          readLabel: "既読",
          friendFace: "/characters/face/seal_R.webp",
          reply: "いいよ〜！やってみる！",
        },
        tint: "#EEF7E9",
        text: "LINEでリンクを送るだけでOK！",
        highlight: "リンクを送るだけ",
      },
      {
        // ③ 得られるもの: 自分では気づかない一面。
        visual: { kind: "gap", badge: "ギャップ発見！" },
        tint: "#F1ECFA",
        text: "友達診断で意外な一面を発見！",
        highlight: "友達診断",
      },
      {
        // ④ どこから: このあと開く結果ページの下部ナビ「友達診断」を指す。
        // 紹介で上げた関心を、結果ページで迷わず行動につなげるための1枚 (2026-11-17)。
        visual: {
          kind: "entry",
          selfFace: "/characters/face/penguin_N.webp",
          pageLabel: "あなたの診断結果",
          tabs: ["自己診断", "友達診断", "Alice", "占星術", "タロット"],
          bubble: "結果ページのここ！",
        },
        tint: "#EDEDFD",
        text: "友達診断はここからできるよ！",
        highlight: "ここから",
      },
    ],
    steps: [
      "回答データを分解",
      "Big Five理論で解析",
      "友達から見た性格を予測",
      "診断結果を生成",
    ],
  },
};
export const JA_DIAGNOSIS_SETTINGS: DiagnosisLocaleSettings = {
  locale: "ja",
  // 出す質問は src/lib/question-sets.ts の JA_DEFAULT_QUESTION_SET_ID で決まる。
  questions: JA_QUESTION_SETS[JA_DEFAULT_QUESTION_SET_ID],
  questionSet: {
    id: JA_DEFAULT_QUESTION_SET_ID,
    sets: JA_QUESTION_SETS,
    revision: JA_QUESTION_SET_REVISION,
  },
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
