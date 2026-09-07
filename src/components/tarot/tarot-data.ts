export type TarotLocale = "ja" | "ko";

type TarotModeConfig = {
  title: string;
  shortTitle: string;
  description: string;
  lead: string;
  selectionCount: 1 | 3;
};

export const TAROT_MODES = {
  one: {
    title: "今日の1枚",
    shortTitle: "1枚引き",
    description: "今日の流れと、意識したいこと",
    lead: "今日の流れと、意識したいことを1枚から読み解きます。",
    selectionCount: 1,
  },
  three: {
    title: "3枚引き",
    shortTitle: "3枚引き",
    description: "過去・現在・これからを総合鑑定",
    lead: "過去・現在・これからのつながりを、3枚から総合的に読み解きます。",
    selectionCount: 3,
  },
  "yes-no": {
    title: "YES / NO",
    shortTitle: "YES / NO",
    description: "迷っていることをカードに聞く",
    lead: "迷っていることを思い浮かべ、答えと注意点をカードから受け取ります。",
    selectionCount: 1,
  },
} as const satisfies Record<string, TarotModeConfig>;

export type TarotMode = keyof typeof TAROT_MODES;

export const KO_TAROT_MODES = {
  one: {
    title: "오늘의 한 장",
    shortTitle: "한 장 뽑기",
    description: "오늘의 흐름과 마음에 새길 점",
    lead: "한 장의 카드에서 오늘의 흐름과 마음에 새길 점을 읽어 드려요.",
    selectionCount: 1,
  },
  three: {
    title: "세 장 뽑기",
    shortTitle: "세 장 뽑기",
    description: "과거·현재·앞으로의 흐름을 종합 해석",
    lead: "세 장의 카드로 과거와 현재, 앞으로 이어질 흐름을 종합적으로 읽어 드려요.",
    selectionCount: 3,
  },
  "yes-no": {
    title: "YES / NO",
    shortTitle: "YES / NO",
    description: "망설이는 일을 카드에 물어보기",
    lead: "망설이는 일을 떠올리고 카드에서 답과 주의할 점을 받아 보세요.",
    selectionCount: 1,
  },
} as const satisfies Record<TarotMode, TarotModeConfig>;

export const TAROT_MODES_BY_LOCALE = {
  ja: TAROT_MODES,
  ko: KO_TAROT_MODES,
} as const;

export function tarotModes(locale: TarotLocale) {
  return TAROT_MODES_BY_LOCALE[locale];
}

export const TAROT_MODE_IDS = Object.keys(TAROT_MODES) as TarotMode[];

export function isTarotMode(value: string): value is TarotMode {
  return value in TAROT_MODES;
}
