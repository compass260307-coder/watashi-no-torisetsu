import type { AnswerValue, Question } from "@/lib/types";

export type DiagnosisLocale = "ja" | "ko" | "en" | "id";

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
  // 最終カード (16P 風): ニックネーム説明 + 任意のジェンダー設問
  nicknameHelper: string;
  genderLabel: string;
  genderOptions: { value: "male" | "female" | "other"; label: string }[];
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
    // messages[i] の表示時間 (ms)。省略時や不足分は一律2000ms。
    // 最後のメッセージは画面遷移まで表示され続けるため対応する値は不要。
    messageDurationsMs?: number[];
    // 解析待ち画面の最低表示時間 (ms)。省略時は20秒。
    minLoadingMs?: number;
    // マスコットの代わりに流す機能紹介スライド。省略時はマスコットのみ。
    // 表示時間全体を枚数で等分して順に切り替え、最後の1枚で止まる。
    slides?: AnalyzingSlide[];
    // 各スライドのカード上部に出す見出し。後ろに ①②③ の番号が付く。
    slidesLabel?: string;
  };
}

type Voice = { face: string; color: string; text: string };

export interface AnalyzingSlide {
  // 絵は3種類。どれも表示された瞬間に要素が順にポンッと出る。
  //   voices: 左に「あなた」、右に友達3人の一言が1つずつ届く図。
  //   send:   「リンク」が自分から友達へ届く図。
  //   answer: 友達の30問バーが伸びて、完了スタンプが出る図。
  //   gap:    「自分 / 友達」のギャップ図。badge は最後に出るスタンプ。
  // face はキャラクターの顔画像 (public/characters/face)。
  visual:
    | {
        kind: "voices";
        selfLabel: string;
        selfFace: string;
        voices: [Voice, Voice, Voice];
      }
    | {
        kind: "send";
        selfLabel: string;
        selfFace: string;
        friendLabel: string;
        friendFace: string;
        linkLabel: string;
      }
    | { kind: "answer"; friendLabel: string; friendFace: string; countLabel: string; badge: string }
    | { kind: "gap"; badge: string };
  // 絵を載せる帯の色。
  tint: string;
  // スライドの文は1つだけ。改行は "\n"。highlight に一致する部分だけ色を変える。
  text: string;
  highlight?: string;
}

export interface DiagnosisLocaleSettings {
  locale: DiagnosisLocale;
  questions: Question[];
  persistProgress: boolean;
  progressStorageKey: string;
  nicknameStorageKey: string;
  genderStorageKey: string;
  resultStorageKey: string;
  startedStorageKey: string;
  homePath: string;
  resultPath: string;
  copy: DiagnosisCopy;
}
