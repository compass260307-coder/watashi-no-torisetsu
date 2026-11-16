import type { DiagnosisCopy, DiagnosisLocaleSettings } from "@/i18n/diagnosis";
import { questions } from "@/lib/questions";
const JA_COPY: DiagnosisCopy = {
  heroTitle: "無料性格診断テスト",
  heroSubtitle: "ビッグファイブ理論で分かる32タイプ",
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
    // 最低表示は22.5秒 (2026-11-16: 友達診断の紹介スライド4枚を入れるため20秒から延長)。
    minLoadingMs: 22500,
    // 友達診断の存在を知らないまま結果を読み終える人が多いため、待ち時間に紹介する。
    // マスコット動画の代わりに4枚を等分 (約5.6秒ずつ) で流す。文は1枚につき1行だけ。
    slidesLabel: "友達診断とは？",
    slides: [
      {
        // ① 何か: 友達があなたの性格を診断してくれる。
        visual: {
          kind: "voices",
          selfLabel: "あなた",
          selfFace: "/characters/face/penguin_N.webp",
          voices: [
            { face: "/characters/face/seal_R.webp", color: "#5BC6DB", text: "しっかり者！" },
            { face: "/characters/face/fox_N.webp", color: "#E8B84A", text: "甘えんぼう？" },
            { face: "/characters/face/rabbit_N.webp", color: "#8FCE70", text: "盛り上げ役！" },
          ],
        },
        tint: "#EAF6F9",
        text: "友達があなたを診断してくれるよ！",
        highlight: "友達",
      },
      {
        // ② やり方その1: リンクを送る。
        visual: {
          kind: "send",
          selfLabel: "あなた",
          selfFace: "/characters/face/penguin_N.webp",
          friendLabel: "友達",
          friendFace: "/characters/face/seal_R.webp",
          linkLabel: "リンク",
        },
        tint: "#EEF7E9",
        text: "LINEでリンクを送るだけでOK！",
        highlight: "リンクを送るだけ",
      },
      {
        // ③ やり方その2: 友達が30問に答える。
        visual: {
          kind: "answer",
          friendLabel: "友達",
          friendFace: "/characters/face/seal_R.webp",
          countLabel: "30問",
          badge: "回答完了！",
        },
        tint: "#FFF5DC",
        text: "友達が30問に答えたら完成！",
        highlight: "30問に答えたら",
      },
      {
        // ④ 得られるもの: 自分では気づかない一面。
        visual: { kind: "gap", badge: "ギャップ発見！" },
        tint: "#F1ECFA",
        text: "友達診断で意外な一面を発見！",
        highlight: "友達診断",
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
