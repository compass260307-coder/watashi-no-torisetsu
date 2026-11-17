import { questions } from "./questions";
import { questionsV2 } from "./questions-v2";
import type { Question } from "./types";

// 自己診断の質問セット。
//   v1: 従来の 50 問 (src/lib/questions.ts)。日本語以外の言語は常にこれ。
//   v2: 場面具体型に書き換え、出題順を混ぜた 50 問 (src/lib/questions-v2.ts)。日本語版のみ。
//
// 採点は「id → ファセット / 逆転」の対応に依存し、その対応はセットごとに違う。
// そのため回答を送るときは必ずどのセットの回答かを一緒に渡し、クライアントとサーバーで
// 同じセットを使って計算する。
export type QuestionSetId = "v1" | "v2";

/**
 * 日本語版 /diagnosis で出す質問セット。
 *
 * ★ 質問を元に戻すときは、この 1 行を "v1" に変えてデプロイする。★
 *
 * 切り替えの前後で開いていた画面は、そのとき表示していたセットの id を回答と一緒に
 * 送るので、どちら向きに切り替えても採点はずれない。
 * 確認用に URL でも上書きできる: /diagnosis?qset=v1 / /diagnosis?qset=v2
 */
export const JA_DEFAULT_QUESTION_SET_ID: QuestionSetId = "v2";

/**
 * セット指定のない回答の扱い。v2 導入前のクライアント (デプロイ時点で開いていた画面) と
 * 日本語以外の言語はセットを送らないため、従来の v1 として採点する。
 */
export const LEGACY_QUESTION_SET_ID: QuestionSetId = "v1";

/** URL クエリのキー (例: /diagnosis?qset=v1)。 */
export const QUESTION_SET_QUERY_KEY = "qset";

/** 日本語版で選べるセット。 */
export const JA_QUESTION_SETS: Record<QuestionSetId, Question[]> = {
  v1: questions,
  v2: questionsV2,
};

/**
 * サーバー側の採点用。信頼できない入力 (リクエスト body) からセットを解決する。
 * 日本語版で既知の id が指定されたときだけそのセット、それ以外は従来の v1。
 */
export function resolveQuestionSet(
  value: unknown,
  locale: string,
): { id: QuestionSetId; questions: Question[] } {
  if (locale === "ja" && (value === "v1" || value === "v2")) {
    return { id: value, questions: JA_QUESTION_SETS[value] };
  }
  return { id: LEGACY_QUESTION_SET_ID, questions };
}
