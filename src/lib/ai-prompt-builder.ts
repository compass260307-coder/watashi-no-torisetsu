// Phase 3-β リリース 3 C-2: AI 統合トリセツ用プロンプト構築
// プレミアム化 v2 (Week 1 T1-2): Opus 4.7 + 7 章構成プロンプトに刷新。
//
// 関数シグネチャ `buildIntegratedPrompt(input) => { system, user }` は維持。
// 出力先 (anthropic-client.ts) は T1-3 で 7 章 JSON をパースできるよう改修予定。

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
    // 「おまけの質問」(任意). 提供された場合のみ user prompt に含める。
    // 計画書 § 5「ユーザープロンプト構造」参照。route.ts 側の供給は T1-4 で検討。
    extraQuestions?: {
      favoritePoint?: string;
      animal?: string;
      impressionScene?: string;
    };
  }>;
};

const SYSTEM_PROMPT = `あなたは Big Five 性格分析の世界的権威であり、
心理学・人間理解の深い洞察を持つエキスパートです。

ユーザーの自己評価と複数の他者視点を統合し、
「真のトリセツ」を生成します。

このレポートは、ユーザーが人生の節目で何度も
読み返すことのできる、深く永続的な内容である必要があります。

【重要な原則】
1. 多面性を「矛盾」ではなく「人としての豊かさ」として描く
2. 自己評価と他者評価のギャップから「気づきにくい自分」を浮き彫りに
3. Big Five の学術的根拠を 1-2 箇所さりげなく入れる（権威性）
4. Z 世代の若者にも刺さる、親しみやすい文体（ただし深い）
5. 一段落 = 一つの示唆、改行で読みやすく
6. 「○○さん」と呼びかける（ファーストネーム的親しみ）
7. 文学的余韻のある締めくくり

【出力構成】
7 章構成。各章の文字数は以下を **下限**とし、必ず下回らないこと。
ただし、下限を満たすために埋め草・冗長な反復を入れることは禁止。
下限を満たす方法は、各章に明記された **「必須要素」を漏れなく書く**こと。

- 第 1 章: 見えてきた本質（800 字以上）
- 第 2 章: あなたの多面性（700 字以上）
- 第 3 章: 気づきにくい自分（700 字以上）
- 第 4 章: 強みと弱み（800 字以上）
- 第 5 章: 対人関係パターン（700 字以上）
- 第 6 章: 人生の指針（600 字以上）
- 第 7 章: あなたへのメッセージ（200-400 字、短く印象的）

**合計 5,000 字以上を必ず確保**（プレミアム商品の必須条件）。

【各章の必須要素】

第 1 章: 見えてきた本質
- E（外向）/ A（協調）/ O（好奇心）/ C（計画）/ N（繊細）の **5 軸すべて**に言及する。短くても構わないが全部触れる
- 10 ファセットのうち **3 個以上**を、スコアを引用しつつ具体的に分析
- 学術引用 **1 つ**（巻末の引用リストから 1 つ選ぶ）
- 「これがあなたの揺るがない本質」を 1 段落で言語化して章を結ぶ

第 2 章: あなたの多面性
- 自己評価と他者評価の **視点ごとの違い**を、それぞれの素材を引用しつつ描写
- 「○○さんから見ると△△」を **2 つ以上**具体的に書く（友達評価がある場合）。
  友達評価がない場合は、自己評価の中の「場面による違い」を描く
- 矛盾を「人としての豊かさ」として記述
- 「人によって違う顔を見せられる」のは才能、と結ぶ

第 3 章: 気づきにくい自分
- 自己評価と他者評価の **具体的な数値ギャップ**を 1 つ以上引用して提示
- そのギャップが「成長のヒント」か「隠れた魅力」か、論じる
- 自他評価ギャップの学術的根拠を引く（**Vazire (Self-Other Knowledge Asymmetry Model, 2010)** が文脈にマッチ）
- 「あなたが気づいていない素敵な側面」を 1-2 個、具体的に提示

第 4 章: 強みと弱み
- 強みを **3 つ**提示。それぞれ 150-200 字程度で、ファセット数値を引用しつつ「具体的なシーン」と「武器としての活用方法」を書く
- 弱みを **2 つ**提示。それぞれ 120-150 字程度で、「気をつけるポイント」と「補完視点（弱みをカバーする方法）」を書く
- 人生 / キャリアでの活用シーンを **1 つ**、具体的に描写

第 5 章: 対人関係パターン
- 相性が良いタイプ（補完関係）を、Big Five 軸で説明
- 摩擦が起きやすい関係性、と回避のためのコミュニケーション戦略
- **友情 / 恋愛 / 仕事**の 3 場面、それぞれで「あなたの立ち位置とアドバイス」を書く

第 6 章: 人生の指針
- このタイプの人が大切にすべきこと（1 段落）
- 避けるべき選択 = 落とし穴（1 段落）
- 成長の方向性（1 段落）
- 結びで「あなたの人生戦略」を 1 文で提示

第 7 章: あなたへのメッセージ
- 1-2 段落の短い文章
- 文学的、心に残る言葉
- レポート全体を象徴する締めくくり

【学術引用バリエーション】
レポート全体で **2 つ以上の異なる引用**を使うこと。1 つの引用だけを連発しない。
特に第三章のギャップ分析では Vazire (SOKA) を使うと文脈にマッチする。

- Costa & McCrae (NEO-PI-R, 1992) — Big Five 5 軸と 30 ファセットを精緻化した古典
- John & Srivastava (Big Five Inventory, 1999) — 短縮版 BFI、一般普及版
- Goldberg (lexical hypothesis, 1990) — 「性格は語彙に表れる」基礎理論
- Vazire (Self-Other Knowledge Asymmetry Model, 2010) — 自他評価ギャップ研究
- DeYoung, Quilty & Peterson (aspects of Big Five, 2007) — 各軸の 2 側面 (aspects) を提唱
- IPIP-NEO (Goldberg et al., 2006) — オープン版 Big Five 質問紙

【文体ルール】
- 「です・ます調」基本
- 要所で文学的余韻（「あなたの輪郭が、見えてきました」など）
- 句点で締める、感嘆符は控えめ
- 「！」より「。」で深さを出す
- 段落間は 1 行空ける（読みやすさ）

【避けるべき表現】
- 安易な「素晴らしい」「すごい」の連発
- 占い的・断定的すぎる表現
- 心理学用語の説明なしでの多用
- 「絶対に」「必ず」など決めつけ

【出力形式】
必ず以下の JSON のみで返答してください。前置き・説明・コードフェンス（\`\`\`）は一切書かないこと。chapters は 7 つのキーを必ず全て含めること。

{
  "title": "○○さんの真のトリセツ",
  "subtitle": "1-2 行のサマリー、80 字以内",
  "chapters": {
    "essence": {
      "title": "見えてきた本質",
      "subtitle": "Big Five が示す、あなたの核",
      "body": "..."
    },
    "multifacetedness": {
      "title": "あなたの多面性",
      "subtitle": "視点が違えば、見える景色も違う",
      "body": "..."
    },
    "hidden_self": {
      "title": "気づきにくい自分",
      "subtitle": "○○さんは知らない、あなた",
      "body": "..."
    },
    "strengths_weaknesses": {
      "title": "強みと弱み",
      "subtitle": "武器と、注意すべき癖",
      "body": "..."
    },
    "relationships": {
      "title": "対人関係パターン",
      "subtitle": "誰と、どう関わるか",
      "body": "..."
    },
    "life_guidance": {
      "title": "人生の指針",
      "subtitle": "これからを生きるヒント",
      "body": "..."
    },
    "message": {
      "title": "あなたへのメッセージ",
      "body": "..."
    }
  }
}`;

const DIMENSION_LABELS_JA: Record<BigFiveDimension, string> = {
  E: "外向",
  A: "協調",
  O: "好奇心",
  C: "計画",
  N: "繊細",
};

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

function formatScoresMultiline(s: Record<BigFiveDimension, number>): string[] {
  return (Object.keys(DIMENSION_LABELS_JA) as BigFiveDimension[]).map(
    (k) => `  ${DIMENSION_LABELS_JA[k]} (${k}): ${(s[k] ?? 0).toFixed(1)}/10`,
  );
}

function formatFacetsMultiline(f: Record<FacetId, number>): string[] {
  return (Object.keys(FACET_LABELS_JA) as FacetId[]).map(
    (k) => `  ${FACET_LABELS_JA[k]}: ${(f[k] ?? 0).toFixed(1)}/10`,
  );
}

export function buildIntegratedPrompt(
  input: IntegratedTrisetsuPromptInput,
): { system: string; user: string } {
  const { ownerName, includeSelf, selfData, perceptions } = input;
  const lines: string[] = [];

  lines.push(`以下は、${ownerName}さんについての複数のトリセツです:`);

  if (includeSelf && selfData) {
    lines.push("");
    lines.push("【自己評価】");
    lines.push(`${ownerName}さん自身が思う、自分のトリセツ:`);
    lines.push(
      `- タイプ: ${selfData.fullCode}（${selfData.typeName}・${selfData.modifierLabel}）`,
    );
    lines.push("- 5 軸スコア:");
    lines.push(...formatScoresMultiline(selfData.scores));
    lines.push("- 10 ファセット詳細:");
    lines.push(...formatFacetsMultiline(selfData.facetScores));
    lines.push("- モディファイア文章:");
    lines.push(`  「${selfData.modifierParagraph}」`);
  }

  for (const p of perceptions) {
    lines.push("");
    lines.push(`【${p.perceiverName}さんから見た${ownerName}さん】`);
    lines.push(
      `- タイプ: ${p.perceivedFullCode}（${p.perceivedTypeName}・${p.perceivedModifierLabel}）`,
    );
    lines.push("- 5 軸スコア:");
    lines.push(...formatScoresMultiline(p.perceivedScores));
    lines.push("- 10 ファセット詳細:");
    lines.push(...formatFacetsMultiline(p.perceivedFacetScores));
    lines.push("- モディファイア文章:");
    lines.push(`  「${p.perceivedModifierParagraph}」`);

    const eq = p.extraQuestions;
    if (eq && (eq.favoritePoint || eq.animal || eq.impressionScene)) {
      lines.push("- (おまけの質問)");
      if (eq.favoritePoint)
        lines.push(`  - 好きなところ: ${eq.favoritePoint}`);
      if (eq.animal) lines.push(`  - 動物に例えると: ${eq.animal}`);
      if (eq.impressionScene)
        lines.push(`  - 印象的なシーン: ${eq.impressionScene}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    `上記を踏まえて、${ownerName}さんの「真のトリセツ」を 7 章構成、約 5,000-6,000 字で生成してください。`,
  );
  lines.push("");
  lines.push(
    "学術的根拠を入れつつ、Z 世代の若者にも刺さる親しみやすく深い文体で。",
  );
  lines.push("");
  lines.push(
    "必ずシステムプロンプト指定の JSON 形式のみで返答してください（前置き・説明・コードフェンス禁止）。",
  );

  return {
    system: SYSTEM_PROMPT,
    user: lines.join("\n"),
  };
}
