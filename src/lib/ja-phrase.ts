import { Parser, jaModel } from "budoux";

// 日本語を読みやすい位置で折り返すためのユーティリティ。
// 改行候補の位置に ZWSP (ゼロ幅スペース) を挟み、CSS 側の .phrase-jp
// (word-break: keep-all) と組み合わせて「はっきり」等の語中改行を防ぐ。
// word-break: auto-phrase は iOS Safari 未対応のため、全ブラウザで
// 効かせるには ZWSP 挿入が必要 (globals.css の .balance-jp と使い分け)。
//
// 候補は「読点・句点の直後」を第一とする。BudouX の文節境界をそのまま
// 全部候補にすると、text-wrap: balance が行長の均等さを優先して
// 「空気を / 読んで」のような読点より不自然な位置を選んでしまうため、
// 1行に収まらない長い節に限って文節境界を補助候補として足す。
const parser = new Parser(jaModel);

// ひらがな・カタカナ・漢字のいずれかを含むときだけ処理する
// (ko/en/id の文言はスペース折返しのためそのまま返す)。
const JA_PATTERN = /[ぁ-ゟ゠-ヿ一-鿿]/;

const ZWSP = "\u{200B}";

// この字数以下の節はひとかたまり (内部に改行候補を作らない)。
// 質問文は 17px / 幅390px で1行 ≈ 21字: 18字以下なら節ごと次行に送れるので
// 文節候補は不要。超える節は1行に収まらない画面があるため BudouX で補う。
const CLAUSE_KEEP_MAX = 18;

const OPEN_BRACKETS = "「『（";
const CLOSE_BRACKETS = "」』）";
const CLAUSE_DELIMITERS = "、。！？";

// 括弧の外にある読点・句点の直後で節に分割する
// (「いや、それは」のような括弧内の読点では切らない)。
function splitClauses(text: string): string[] {
  const clauses: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of text) {
    current += ch;
    if (OPEN_BRACKETS.includes(ch)) depth++;
    else if (CLOSE_BRACKETS.includes(ch)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && CLAUSE_DELIMITERS.includes(ch)) {
      clauses.push(current);
      current = "";
    }
  }
  if (current) clauses.push(current);
  return clauses;
}

// word-break: keep-all でもブラウザは「」等の括弧の前後・括弧内の読点の直後を
// 改行機会として残すため、balance がそこを選んで「〜「どこ行く？」/ となったら」の
// ような折返しを作ってしまう。WJ (WORD JOINER) を挟んで ZWSP 候補以外の
// 改行機会を塞ぎ、改行位置を候補だけに限定する。
const WJ = "\u{2060}";

function suppressNaturalBreaks(text: string): string {
  return (
    text
      // 句読点・閉じ括弧の直後 (次が ZWSP 候補・句読点・閉じ括弧・末尾なら不要)
      .replace(/([」』）、。！？])(?![」』）、。！？\u{200B}]|$)/gu, `$1${WJ}`)
      // 開き括弧の直前 (直前が ZWSP 候補や挿入済み WJ なら不要)
      .replace(/([^\u{200B}\u{2060}])([「『（])/gu, `$1${WJ}$2`)
  );
}

export function phraseWrapJa(text: string): string {
  if (!JA_PATTERN.test(text)) return text;
  const withCandidates = splitClauses(text)
    .map((clause) =>
      clause.length > CLAUSE_KEEP_MAX
        ? parser.parse(clause).join(ZWSP)
        : clause,
    )
    .join(ZWSP);
  return suppressNaturalBreaks(withCandidates);
}
