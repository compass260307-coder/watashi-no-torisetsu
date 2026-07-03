// 「みんなの目」他者視点解説文 (600字前後) の Claude 生成プロンプト。
// システムプロンプトは仕様書 minna_no_me_tab_spec_v1.md § 4 のドラフトを採用。
// トーン: 盲点重視 × grace 肯定。数値は入力に渡すが、本文には数値を出さない。

import type { BigFiveDimension } from "./types";
import { GAP_AXIS_LABEL, type MinnaNoMeContext } from "./minna-no-me";

export const MINNA_NO_ME_SYSTEM_PROMPT = `あなたは、ある人の性格診断の「他者視点」パートを書くライターです。
自己診断の結果と、その人の友達3人が答えた評価をもとに、
「友達から見たその人」を描く600字前後の文章を書いてください。

# 大原則
- 盲点（自分では気づいていない面）を扱うが、絶対に「欠点の指摘」にしない。
- ズレは、その人が無意識にやっていることが他人の目に別の形で映った結果として描く。
- その無意識の振る舞いを「価値」として優しく差し出す。断定・説教はしない。
- 読んだ人が「自分では当たり前だと思ってたことに、意味があったんだ」と感じられる終わり方にする。

# 構成（2〜3段落・600字前後）
1. 自分が思う自分と、みんなの目に映る自分の間に、静かなズレがあることを示す。
2. 具体的にどの面がどうズレているか（最大乖離軸を中心に）。友達の言葉も織り込む。
3. そのズレは、あなたが無意識にやっていること（人を助ける・場を保つ等）の証拠であり、価値であると肯定して締める。

# トーン
- やわらかい敬体。断定を避け「〜みたい」「〜なのかもしれない」を適度に。
- ポジティブだが、甘すぎない。地に足のついた肯定。
- 友達の生の言葉（好きなところ）を1〜2箇所、自然に引用してよい。

600字前後の本文のみを出力。見出し・前置き・メタ発言・数値は不要。`;

function formatScores(
  scores: Partial<Record<BigFiveDimension, number>>,
): string {
  const dims: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  return dims
    .map((d) => {
      const v = scores[d];
      return `${GAP_AXIS_LABEL[d]}=${typeof v === "number" ? v.toFixed(1) : "—"}`;
    })
    .join(" / ");
}

/**
 * みんなの目 解説文の user プロンプトを組む。
 * ctx は computeMinnaNoMeContext の結果、selfScores は owner の 0-10 スコア。
 */
export function buildMinnaNoMePrompt(input: {
  ownerName: string;
  selfScores: Partial<Record<BigFiveDimension, number>>;
  ctx: MinnaNoMeContext;
  qualitativeNotes: string[]; // 好きなところ・本人へのメッセージ等
}): { system: string; user: string } {
  const { ctx } = input;
  const lines: string[] = [];

  lines.push(`# 対象者: ${input.ownerName}`);
  lines.push("");
  lines.push(`- 自己タイプ: ${ctx.selfEssence}`);
  lines.push(`- 自己Big Fiveスコア(0-10): ${formatScores(input.selfScores)}`);
  lines.push(`- みんなから見たタイプ: ${ctx.friendEssence}`);
  lines.push(
    `- 友達平均スコア(0-10): ${formatScores(ctx.friendAvgScores)}`,
  );

  if (ctx.topGapAxis && ctx.selfVal !== null && ctx.friendVal !== null) {
    lines.push(
      `- 最大のズレ: ${GAP_AXIS_LABEL[ctx.topGapAxis]}（自己${ctx.selfVal.toFixed(1)} vs 友達${ctx.friendVal.toFixed(1)}）`,
    );
  } else {
    lines.push("- 最大のズレ: 目立った乖離は小さめ");
  }

  if (ctx.matched) {
    lines.push(
      "- 補足: 自己タイプと友達から見たタイプは一致している。別人になるのではなく、『あなたのまま映っている』という方向で、無意識の一貫性を価値として描くこと。",
    );
  }

  const notes = input.qualitativeNotes.filter((n) => n.trim().length > 0);
  lines.push(
    `- 友達の言葉: ${notes.length > 0 ? notes.map((n) => `「${n}」`).join("、") : "（特になし）"}`,
  );
  lines.push(
    `- 動物メタファー: ${ctx.animals.length > 0 ? ctx.animals.join("、") : "（なし）"}`,
  );

  lines.push("");
  lines.push("600字前後の本文のみを出力してください。");

  return { system: MINNA_NO_ME_SYSTEM_PROMPT, user: lines.join("\n") };
}
