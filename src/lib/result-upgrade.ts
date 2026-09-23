export const RESULT_UPGRADE_QUESTIONS = [
  "暇な時間は何することが多い？",
  "最近、つい時間を忘れちゃったことは？",
  "周りの人からどんな人って言われる？",
  "恋愛で大事にしていることは？",
  "あなたの将来の夢は？",
] as const;

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

export function normalizeResultUpgradeAnswers(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length !== RESULT_UPGRADE_QUESTIONS.length) {
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
