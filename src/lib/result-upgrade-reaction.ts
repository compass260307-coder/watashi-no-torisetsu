import { WEB_RESULT_UPGRADE_QUESTIONS_V2 } from "@/lib/result-upgrade";

/**
 * 日本語Webの7問チャットで、Aliceが回答へ返す一言まわりの共通定義。
 * サーバー（AI生成）とクライアント（失敗時の定型文）の両方から使うため、server-only を付けない。
 */

/** 各回答を結果のどこに使うか。Aliceの反応と、生成プロンプトの対応づけで同じ内容を使う。 */
export const WEB_RESULT_UPGRADE_ANSWER_USES_V2 = [
  "キャラクターの表情や雰囲気",
  "鑑定書の日常の章",
  "キャラクターの持ち物",
  "鑑定書の仕事と価値観の章",
  "鑑定書のクセの章",
  "鑑定書の恋愛の章",
  "鑑定書の最後のメッセージ",
] as const;

/** Aliceが質問するときの言い回し。反応の吹き出しの続きとして表示する。 */
export const WEB_RESULT_UPGRADE_QUESTION_MESSAGES_V2 = [
  "まずは、自分を動物にたとえるなら？理由も教えて！",
  "じゃあ次は...人生最後の晩ごはん、何を食べる？",
  "次は...無人島に1つだけ持っていけるなら、何にする？",
  "じゃあ...宝くじで1億円当たったら、最初に何する？",
  "次は...夏休みの宿題、いつやるタイプだった？",
  "あと2つだよ。理想の恋人を動物にたとえるなら？理由も教えて！",
  "最後の質問！超能力を1つだけ使えるなら、どんな能力にする？",
] as const;

export const WEB_RESULT_UPGRADE_INTRO_V2 =
  "ここからは、診断の選択肢だけでは見えなかったあなたを教えてね。質問は7つ。一言でも、じっくり話しても大丈夫だよ。";

export const WEB_RESULT_UPGRADE_OFFER_MESSAGE_V2 =
  "7つのお話を聞かせてくれてありがとう🌷 あなた専用のキャラクターと鑑定書を作れるよ。";

export const RESULT_UPGRADE_REACTION_MAX_LENGTH = 160;

const QUOTE_MAX_LENGTH = 16;

type FallbackTemplate = {
  /** 短い回答を引用して返す。 */
  quoted: (answer: string) => string;
  /** 長い回答や改行を含む回答には、引用せずに返す。 */
  plain: string;
};

// AIの反応を出せなかったとき（通信エラー・時間切れ・利用上限）に表示する定型文。
// どんな回答でも成り立つ内容にとどめ、回答の意味を決めつけない。
const FALLBACK_TEMPLATES: readonly FallbackTemplate[] = [
  {
    quoted: (answer) => `「${answer}」かぁ、あなたらしさが出てるね！キャラクターの表情や雰囲気に入れておくね。`,
    plain: "理由まで教えてくれてありがとう！キャラクターの表情や雰囲気に入れておくね。",
  },
  {
    quoted: (answer) => `「${answer}」かぁ！最後に選ぶものって、本音が出るよね。日常の章に入れておくね。`,
    plain: "くわしく教えてくれてありがとう！最後に選ぶものって、本音が出るよね。日常の章に入れておくね。",
  },
  {
    quoted: (answer) => `「${answer}」を選ぶんだ！1つだけって言われてそれなのが、あなたらしいね。キャラクターに持たせておくよ。`,
    plain: "1つだけって言われてそれを選ぶところが、あなたらしいね。キャラクターに持たせておくよ。",
  },
  {
    quoted: (answer) => `「${answer}」かぁ！お金の使い道って、その人の本音が出るんだよ。仕事と価値観の章に入れるね。`,
    plain: "なるほど、最初にそれなんだ！お金の使い道って、その人の本音が出るんだよ。仕事と価値観の章に入れるね。",
  },
  {
    quoted: (answer) => `「${answer}」なんだね！宿題のやり方って、今の予定の立て方にも出るんだよ。クセの章に入れておくね。`,
    plain: "教えてくれてありがとう！宿題のやり方って、今の予定の立て方にも出るんだよ。クセの章に入れておくね。",
  },
  {
    quoted: (answer) => `「${answer}」かぁ！どんな人に惹かれるのかが伝わってくるよ。恋愛の章に入れておくね。`,
    plain: "理由まで教えてくれてありがとう！どんな人に惹かれるのかが伝わってくるよ。恋愛の章に入れておくね。",
  },
  {
    quoted: (answer) => `「${answer}」かぁ、その能力を選ぶのがあなたらしいね！鑑定書の最後のメッセージに入れておくね。`,
    plain: "その能力を選ぶのがあなたらしいね！鑑定書の最後のメッセージに入れておくね。",
  },
];

export function fallbackResultUpgradeReaction(questionIndex: number, answer: string): string {
  const template = FALLBACK_TEMPLATES[questionIndex];
  if (!template) return "教えてくれてありがとう！";
  const trimmed = answer.trim();
  const quotable =
    trimmed.length > 0 &&
    trimmed.length <= QUOTE_MAX_LENGTH &&
    // 文になっている回答（句読点入り）を丸ごと引用すると不自然なので、単語だけを引用する。
    !/[\n\r「」。、．，.,!?！？]/.test(trimmed);
  return quotable ? template.quoted(trimmed) : template.plain;
}

/** 反応APIが受け付ける回答（1〜7件、各500文字以内）。途中までの回答一式を検証する。 */
export function normalizeResultUpgradeReactionAnswers(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > WEB_RESULT_UPGRADE_QUESTIONS_V2.length
  ) {
    return null;
  }
  const answers = value.map((answer) => (typeof answer === "string" ? answer.trim() : ""));
  if (answers.some((answer) => answer.length === 0 || answer.length > 500)) return null;
  return answers;
}

/** AIの出力を表示用に整える。使えない出力のときは null を返し、呼び出し側が定型文へ切り替える。 */
export function sanitizeResultUpgradeReaction(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let text = value.replace(/\s+/g, " ").trim();
  // 全体をかぎかっこや引用符で包んだ出力だけ外す。「ネコ」かぁ...のように引用で始まる文は残す。
  const wrapped = text.match(/^(["'「『])(.*)(["'」』])$/);
  if (wrapped && !/["'「」『』]/.test(wrapped[2])) text = wrapped[2].trim();
  if (text.length < 4 || text.length > RESULT_UPGRADE_REACTION_MAX_LENGTH) return null;
  return text;
}
