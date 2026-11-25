import { questions } from "./questions";
import {
  QUESTIONS_V2_REVISION,
  questionsV2,
  questionsV2Original,
} from "./questions-v2";
import type { Question } from "./types";

// 自己診断の質問セット。
//   v1: 従来の 50 問 (src/lib/questions.ts)。英語・インドネシア語は常にこれ。
//   v2: 場面具体型に書き換え、出題順を混ぜた 50 問 (src/lib/questions-v2.ts)。日本語版と韓国語版。
//       韓国語の文は src/i18n/ko/diagnosis.ts にあり、id・出題順・ファセット・逆転は日本語版と同一。
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
 * 韓国語版 /ko/diagnosis で出す質問セット (2026-11-17 に日本語版と同じ v2 へ切り替え)。
 * 元に戻すときは、この 1 行を "v1" に変えてデプロイする。確認用: /ko/diagnosis?qset=v1
 */
export const KO_DEFAULT_QUESTION_SET_ID: QuestionSetId = "v2";

/**
 * セット指定のない回答の扱い。v2 導入前のクライアント (デプロイ時点で開いていた画面) と
 * 英語・インドネシア語はセットを送らないため、従来の v1 として採点する。
 */
export const LEGACY_QUESTION_SET_ID: QuestionSetId = "v1";

/** URL クエリのキー (例: /diagnosis?qset=v1)。 */
export const QUESTION_SET_QUERY_KEY = "qset";

/** 日本語版で選べるセット (画面に出す文と、今の向き)。サーバーの採点は resolveQuestionSet を通す。 */
export const JA_QUESTION_SETS: Record<QuestionSetId, Question[]> = {
  v1: questions,
  v2: questionsV2,
};

/**
 * 日本語版の画面が回答と一緒に送る「v2 の版」。韓国語版は送らない (undefined)。
 * 向きを変えた質問を、答えた人が見た文に合った向きで採点するために使う
 * (src/lib/questions-v2.ts の「向きを変えた質問の扱い」)。
 */
export const JA_QUESTION_SET_REVISION = QUESTIONS_V2_REVISION;

/**
 * サーバー側の採点用。信頼できない入力 (リクエスト body) からセットを解決する。
 * 日本語版・韓国語版で既知の id が指定されたときだけそのセット、それ以外は従来の v1。
 *
 * v2 は、日本語版の今の版 (revision が QUESTIONS_V2_REVISION と一致) のときだけ今の向きで
 * 採点する。版を送らない回答 (反映の時点で開いていた日本語版の画面・韓国語版) は、
 * 答えた人が見た文に合わせて最初の向きで採点する。
 */
export function resolveQuestionSet(
  value: unknown,
  locale: string,
  revision?: unknown,
): { id: QuestionSetId; questions: Question[] } {
  if (
    (locale === "ja" || locale === "ko") &&
    (value === "v1" || value === "v2")
  ) {
    if (value === "v2") {
      const isCurrentJapanese =
        locale === "ja" && revision === QUESTIONS_V2_REVISION;
      return {
        id: value,
        questions: isCurrentJapanese ? questionsV2 : questionsV2Original,
      };
    }
    return { id: value, questions: JA_QUESTION_SETS[value] };
  }
  return { id: LEGACY_QUESTION_SET_ID, questions };
}
