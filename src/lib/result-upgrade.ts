export const RESULT_UPGRADE_QUESTIONS = [
  "暇な時間は何することが多い？",
  "最近、つい時間を忘れちゃったことは？",
  "周りの人からどんな人って言われる？",
  "恋愛で大事にしていることは？",
  "あなたの将来の夢は？",
] as const;


export const KO_RESULT_UPGRADE_QUESTIONS = [
  "여유 시간이 생기면 주로 뭘 하세요?",
  "최근에 시간 가는 줄 모르고 빠져든 일은 무엇인가요?",
  "주변 사람들은 어떤 사람이라고 말하나요?",
  "연애에서 중요하게 생각하는 건 무엇인가요?",
  "앞으로 이루고 싶은 꿈은 무엇인가요?",
] as const;

export function resultUpgradeQuestions(locale: "ja" | "ko" = "ja"): readonly string[] {
  return locale === "ko" ? KO_RESULT_UPGRADE_QUESTIONS : RESULT_UPGRADE_QUESTIONS;
}

/**
 * 日本語Webの新しい7問（2026-11-18）。答えやすい「もしも・たとえ」型にそろえる。
 * LINE・韓国語と、すでに保存済みの5問回答は従来の RESULT_UPGRADE_QUESTIONS のまま扱う。
 * 保存された回答がどちらの質問に対するものかは、回答数（5 or 7）で判別する。
 */
export const WEB_RESULT_UPGRADE_QUESTIONS_V2 = [
  "自分を動物にたとえるなら？理由も教えて",
  "人生最後の晩ごはん、何を食べる？",
  "無人島に1つだけ持っていけるなら、何にする？",
  "宝くじで1億円当たったら、最初に何する？",
  "夏休みの宿題、いつやるタイプだった？",
  "理想の恋人を動物にたとえるなら？理由も教えて",
  "超能力を1つだけ使えるなら、どんな能力にする？",
] as const;

export const LEGACY_RESULT_UPGRADE_ANSWER_COUNT = RESULT_UPGRADE_QUESTIONS.length;
export const WEB_RESULT_UPGRADE_ANSWER_COUNT_V2 = WEB_RESULT_UPGRADE_QUESTIONS_V2.length;

export function isWebResultUpgradeV2Answers(
  locale: "ja" | "ko" | undefined,
  answerCount: number,
): boolean {
  return (locale ?? "ja") === "ja" && answerCount === WEB_RESULT_UPGRADE_ANSWER_COUNT_V2;
}

/** 保存済みの回答数から、その回答が答えた質問セットを返す。 */
export function resultUpgradeQuestionsForAnswers(
  locale: "ja" | "ko" | undefined,
  answerCount: number,
): readonly string[] {
  if (isWebResultUpgradeV2Answers(locale, answerCount)) return WEB_RESULT_UPGRADE_QUESTIONS_V2;
  return resultUpgradeQuestions(locale ?? "ja");
}

export type ResultUpgradeState =
  | "answers_ready"
  | "generating"
  | "ready"
  | "failed";

export type ResultUpgradeReadingSection = {
  title: string;
  body: string;
};

export type ResultUpgradeReading = {
  title: string;
  subtitle: string;
  sections: ResultUpgradeReadingSection[];
  closingMessage: string;
};

export type ResultUpgradeSelfSections = {
  overview: ResultUpgradeReadingSection;
  love: ResultUpgradeReadingSection;
  career: ResultUpgradeReadingSection;
  everyday: ResultUpgradeReadingSection;
  caution: ResultUpgradeReadingSection;
};

/**
 * 新しい生成結果の5章を、自己診断ページの各章へ名前付きで割り当てる。
 * 旧データ（4章以下）は従来表示へ安全にフォールバックする。
 */
export function resultUpgradeSelfSections(
  reading: ResultUpgradeReading | null | undefined,
): ResultUpgradeSelfSections | null {
  if (!reading || reading.sections.length < 5) return null;
  const [overview, love, career, everyday, caution] = reading.sections;
  if (!overview || !love || !career || !everyday || !caution) return null;
  return { overview, love, career, everyday, caution };
}

export type ResultUpgradeRow = {
  user_id: string;
  locale?: "ja" | "ko";
  answers: string[];
  source_type_id: string;
  source_character_path: string;
  state: ResultUpgradeState;
  personalized_type_name: string | null;
  personalized_intro: string | null;
  reading: ResultUpgradeReading | null;
  character_storage_path: string | null;
  text_model: string | null;
  image_model: string | null;
  attempts: number;
  generation_started_at: string | null;
  generated_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 回答一式を検証する。従来の5問と、日本語Webの7問のどちらかだけを完成済みとして受け付ける。
 * どちらを許可するかは呼び出し側が allowedCounts で絞る（LINE・韓国語は5問のみ）。
 */
export function normalizeResultUpgradeAnswers(
  value: unknown,
  allowedCounts: readonly number[] = [
    LEGACY_RESULT_UPGRADE_ANSWER_COUNT,
    WEB_RESULT_UPGRADE_ANSWER_COUNT_V2,
  ],
): string[] | null {
  if (!Array.isArray(value) || !allowedCounts.includes(value.length)) {
    return null;
  }
  const answers = value.map((answer) =>
    typeof answer === "string" ? answer.trim() : "",
  );
  if (answers.some((answer) => answer.length === 0 || answer.length > 500)) {
    return null;
  }
  return answers;
}

export function isResultUpgradeReady(
  row: ResultUpgradeRow | null | undefined,
): row is ResultUpgradeRow & {
  personalized_type_name: string;
  personalized_intro: string;
  reading: ResultUpgradeReading;
  character_storage_path: string;
} {
  return Boolean(
    row?.state === "ready" &&
      row.personalized_type_name?.trim() &&
      row.personalized_intro?.trim() &&
      row.character_storage_path &&
      row.reading?.sections?.length,
  );
}

// LINEで新しく受け付ける回答。既存Web購入者の回答制限は維持する。
export const LINE_RESULT_UPGRADE_ANSWER_MAX_LENGTH = 50;
