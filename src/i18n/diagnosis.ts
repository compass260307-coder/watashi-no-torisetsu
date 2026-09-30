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
  };
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
