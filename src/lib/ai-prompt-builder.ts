// Phase 3-β リリース 3 C-2: AI 統合トリセツ用プロンプト構築
//
// 仕様書 PHASE_3B_release_3.md「C-2 AI プロンプト設計と実装」のテンプレートを
// 関数化。クライアント (anthropic-client.ts) は本関数の出力をそのまま渡す。

import type { BigFiveDimension, FacetId } from "./types";

export type IntegratedTrisetsuPromptInput = {
  ownerName: string; // 「あなた」or display_name
  includeSelf: boolean;
  selfData?: {
    fullCode: string;
    typeName: string;
    modifierLabel: string;
    scores: Record<BigFiveDimension, number>;
    facetScores: Record<FacetId, number>;
    modifierParagraph: string;
  };
  perceptions: Array<{
    perceiverName: string;
    perceivedFullCode: string;
    perceivedTypeName: string;
    perceivedModifierLabel: string;
    perceivedScores: Record<BigFiveDimension, number>;
    perceivedFacetScores: Record<FacetId, number>;
    perceivedModifierParagraph: string;
  }>;
};

const SYSTEM_PROMPT = `あなたは性格分析と心理洞察のエキスパートです。
複数の視点から見たある人物のトリセツ（取扱説明書）を統合し、
立体的で深い「真のトリセツ」を生成してください。

以下の点を大切にしてください:
- 平均化ではなく、多面性として統合する
- 矛盾は「人としての豊かさ」として表現する
- 自己評価と他者評価の差分から「気づきにくい自分」を浮き彫りにする
- Z 世代の若者にも刺さる、親しみやすく深い文体
- 約 500 字、過度に長くしない
- 出力は JSON 形式のみ (説明文や前置きは一切書かない)
- JSON のフィールド:
  - title: タイトル (30 字以内、例: "○○さんの真のトリセツ")
  - summary: 1-2 行のサマリー (80 字以内)
  - body: 本文 (約 500 字、必ず以下の構成を含む)

本文の必須構成:
1. 共通して見える本質 (全視点で一致している特徴)
2. 場面によって変わる多面性 (視点ごとに違う側面)
3. 自分も気づいてない深い特徴
4. ○○さんが大切にすべき自分らしさ`;

const FACET_LABELS_JA: Record<FacetId, string> = {
  E_assertiveness: "主張力",
  E_warmth: "温かさ",
  A_cooperation: "協力性",
  A_sympathy: "共感性",
  O_adventurousness: "冒険性",
  O_imagination: "想像力",
  C_achievement: "達成欲求",
  C_orderliness: "秩序性",
  N_volatility: "感情爆発",
  N_anxiety: "不安",
};

function formatScores(s: Record<BigFiveDimension, number>): string {
  return `E=${s.E.toFixed(1)}, A=${s.A.toFixed(1)}, O=${s.O.toFixed(1)}, C=${s.C.toFixed(1)}, N=${s.N.toFixed(1)}`;
}

function formatFacets(f: Record<FacetId, number>): string {
  return (Object.keys(FACET_LABELS_JA) as FacetId[])
    .map((k) => `${FACET_LABELS_JA[k]}=${(f[k] ?? 0).toFixed(1)}`)
    .join(", ");
}

export function buildIntegratedPrompt(
  input: IntegratedTrisetsuPromptInput,
): { system: string; user: string } {
  const { ownerName, includeSelf, selfData, perceptions } = input;
  const lines: string[] = [];

  lines.push(`以下は、${ownerName}さんについての複数のトリセツです:`);

  if (includeSelf && selfData) {
    lines.push("");
    lines.push(`【自己評価】`);
    lines.push(`${ownerName}さん自身が思う、自分のトリセツ:`);
    lines.push(
      `- タイプ: ${selfData.fullCode}（${selfData.typeName}・${selfData.modifierLabel}）`,
    );
    lines.push(`- 5 軸スコア: ${formatScores(selfData.scores)}`);
    lines.push(`- 10 ファセット: ${formatFacets(selfData.facetScores)}`);
    lines.push(`- モディファイア文章:`);
    lines.push(`  「${selfData.modifierParagraph}」`);
  }

  for (const p of perceptions) {
    lines.push("");
    lines.push(`【${p.perceiverName}さんから見た${ownerName}さん】`);
    lines.push(
      `- タイプ: ${p.perceivedFullCode}（${p.perceivedTypeName}・${p.perceivedModifierLabel}）`,
    );
    lines.push(`- 5 軸スコア: ${formatScores(p.perceivedScores)}`);
    lines.push(`- 10 ファセット: ${formatFacets(p.perceivedFacetScores)}`);
    lines.push(`- モディファイア文章:`);
    lines.push(`  「${p.perceivedModifierParagraph}」`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    `上記を踏まえて、${ownerName}さんの「真のトリセツ」を生成してください。`,
  );
  lines.push("");
  lines.push(`必ず以下の JSON 形式のみで返答してください (前置き・説明禁止):`);
  lines.push(`{`);
  lines.push(`  "title": "...",`);
  lines.push(`  "summary": "...",`);
  lines.push(`  "body": "..."`);
  lines.push(`}`);

  return {
    system: SYSTEM_PROMPT,
    user: lines.join("\n"),
  };
}
