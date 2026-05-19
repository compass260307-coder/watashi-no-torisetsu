# ワタシのトリセツ プレミアム化計画書

**第二章への大方向転換: 「楽しい診断」から「本気の自己理解ツール」へ**

---

## 📋 ドキュメント情報

- **作成日**: 2026-05-18
- **改訂日**: 2026-05-19（v2: 4 つの判断 + レビュー指摘 O1-O5 を反映、6 週間スケジュールに延長）
- **対象**: ワタシのトリセツ プレミアム版（完全リニューアル）
- **開発期間**: **6 週間**（2026-05-19 〜 2026-06-30、予備として 7-2）
- **読者**: Claude Code、開発チーム、戦略決定者
- **前提**: Phase 3-β 完全完成（30 タスク完走）後の戦略転換

---

## 📁 リポジトリ構成（B1 決着）

このプレミアム化計画書は **戦略参照用** と **実装用** の 2 箇所に同一内容で配置する:

| 用途 | リポジトリ / パス |
|---|---|
| **戦略参照（このリポジトリ）** | `docs/PREMIUM_PLAN.md` — SNS 戦略エージェントと整合性を取るための参照用 |
| **実装本体** | GitHub: `compass260307-coder/watashi-no-torisetsu` |
| | ローカル: `/Users/wakan/Desktop/watashi-no-torisetsu/` |
| | 同パス: `docs/PREMIUM_PLAN.md` に同一コピーを配置 |

**運用ルール**:
- 計画書は実装リポジトリ側を **正本** とし、SNS 戦略リポジトリ側は同期コピー
- 大きな改訂時は両方を同時更新（少なくとも週 1 で同期確認）
- 実装作業（コード変更）はすべて `watashi-no-torisetsu` 側で行う
- SNS 戦略・エージェント設定の更新はこのリポジトリで行う

---

# Part 1: 戦略

## 1. 戦略背景: なぜプレミアム化するのか

### 動機

3 つの動機が交錯した結果の判断:

#### 1. ビジネス的理由
- 持続可能性: 無料モデルでは AI コスト（Opus 4.7 = 実測ベースで **~$0.36/回**、§ 3 参照）を吸収できない
- 「無料で配るのもったいない」: 価値あるコンテンツを正当な対価で

#### 2. プロダクト的理由
- AI 統合機能を「最高品質」にしたい
- 5,000 字超の深いレポートには Opus 4.7 が必要
- 「本気のユーザー」だけに使ってほしい

#### 3. 競合・差別化的理由
- MBTI / 16Personalities と本気で戦う
- 「無料診断」の質を超える本格派ポジション
- 「九大発の本気の自己理解サービス」というユニークさ

### Phase 3-β からの学び

Phase 3-β（30 タスク）でわかったこと:
- ✅ 技術的に「AI 統合トリセツ」は実現可能（Haiku 4.5 で動作確認済）
- ✅ Big Five × 32 タイプ × 友達評価のアーキテクチャは強い
- ⚠️ 無料の Haiku 4.5 出力は「軽い」、本格派には届かない
- ⚠️ 友達評価機能は無料維持しないとバイラルしない

→ **コア機能（AI 統合）を有料化、周辺（友達評価）は無料維持**の戦略へ。

---

## 2. プロダクト位置づけの変化

### Before（Phase 3-β 完成版）

```
ワタシのトリセツ
├── 自己診断: 無料
├── 友達評価: 無料
├── マイ図鑑: 無料
├── AI 統合トリセツ: 無料（Haiku 4.5、500 字、無制限）
└── 位置づけ: 「軽い・楽しい」Z 世代向けバイラル系
```

### After（プレミアム版）

```
ワタシのトリセツ プレミアム版
├── 自己診断: 無料
├── 友達評価: 無料（バイラル維持・PDF 利用はオプトイン制）
├── マイ図鑑（カード閲覧）: 無料
├── AI 統合トリセツ: 有料 ¥500/回（Opus 4.7、5,000 字+、PDF 付）
└── 位置づけ: 「本格的・深い」自己理解ツール
```

### キーチェンジ

| 軸 | Before | After |
|---|---|---|
| ターゲット | 九大学生（旧計画） | **自己理解を求める若年層 γ**（10 代後半〜20 代、SNS ネイティブ、性別・地域問わず） |
| トーン | Z 世代向けカジュアル | Z 世代向け親しみやすさ + 本格派の深さ |
| AI モデル | Haiku 4.5 | **Opus 4.7** |
| AI 出力長 | 500 字 | **5,000 字以上** |
| マネタイズ | なし | **¥500 買い切り（AI 統合のみ）** |
| ローンチ | ソフトローンチ予定 | **ソフトローンチ停止、完成版一発公開** |
| 既存ユーザー | 6 名 | **全員リセット、新規スタート** |
| 開発期間 | 完成済み | **6 週間（完全リニューアル）** |
| 友達評価 | 自動で統合素材に使用可 | **PDF 利用オプトイン制**（friend 側が同意した場合のみ統合素材に使える） |

### ターゲット再定義（B2 決着）

旧計画では「九大学生」と書かれていたが、既存ブランドコンテキスト（`docs/sns-strategy/brand-context.md`）では「20-30 代女性（恋愛・自己理解関心層）」と定義されており **整合性が取れていなかった**。

プレミアム化に伴い、ターゲットを以下に **再定義（γ 案）**:

```
γ: 自己理解を求める若年層
- 年齢: 10 代後半〜20 代（コア: 18-26）
- 性別: 限定なし（ただし共感ベース UI なので結果的に女性比率が高い見込み）
- 関心領域: 自己理解、対人関係、自分の「なぜ」を言語化したい欲求
- 接点: SNS ネイティブ、LINE 主体、可処分時間と可処分所得は限定的
- 心理的特徴: MBTI/16P で物足りなさを感じている、「本当の自分」への渇望
```

**この再定義の影響**:
1. **PDF デザイントーン**（ディープネイビー #1A2238 + アンティークゴールド #B8860B）は**継続前提**だが、γ 層と合うかは Week 5-6 で再評価する（§ 7 参照）
2. SNS 戦略ドキュメント（`brand-context.md` および 4 つの planner エージェント）は **改訂必要**（巻末 § 35 参照）
3. プロンプト内の「Z 世代の若者にも刺さる」表現は維持（γ 層と矛盾しない）

---

## 3. マネタイズ設計

### 価格戦略

#### 価格: ¥500（買い切り、1 回分）

**戦略的根拠**:
```
¥500 = 学生でも「食事 1 回我慢」レベル
   ↓
購入ハードル激下げ
   ↓
購入率 UP（コンバージョン重視）
   ↓
リピート促進（友達評価増えるたびに買い直し）
```

#### 比較

| 価格帯 | 評価 |
|---|---|
| ¥0（無料） | ❌ 持続不可能（AI コスト超過） |
| ¥300 | ⚠️ 安すぎ、価値が伝わらない |
| **¥500** | ✅ **学生向け最適価格** |
| ¥980 | ⚠️ 学生にはやや重い |
| ¥1,980 | ❌ Z 世代向けには高すぎ |

### コスト構造（O1 反映: 実測ベースに修正）

旧計画の試算（$0.075/回、¥11）は出力トークンのみを過小に見積もったもの。日本語 5,000-6,000 字出力 + 友達 perception 込みの入力プロンプトを実測ベースで再計算すると以下:

```
売上: ¥500/回（税込、軽減税率対象外）
─ Stripe 手数料: 3.6% × ¥500 → ¥18
─ Anthropic Opus 4.7（実測想定）:
    入力 ~6,500 tokens × $15/M  = $0.10 ≈ ¥15
    出力 ~3,500 tokens × $75/M  = $0.26 ≈ ¥39
    小計: $0.36 ≈ ¥54
─ PDF 生成（サーバーレス）: 約 ¥1
─ Supabase ストレージ: 約 ¥0.1
─ Vercel Function: 約 ¥0.5

利益（想定）: ¥426（約 85%）
```

→ 旧試算より 5 倍重いコスト構造だが、**それでも利益率 85% を確保**。健全。

**ただし要監視**:
- 友達 perception を 5 人以上含めると入力トークンがさらに増加 → コストが ¥60 → ¥80 へ
- Opus 4.7 が想定より饒舌で 6,000+ 字出力すると出力コストが膨張
- Week 1 の T1-7（プロンプト品質テスト）で **実コストを計測** し、必要なら以下を判断:
  - max_tokens 上限調整
  - 価格 ¥500 → ¥800 への引き上げ
  - Sonnet 4.6 への切替（品質トレードオフ）

詳細は § 21 の R1 リスク項目も参照。

### リピート購入の自然発生

```
ユーザー A の購入タイミング:
1. 初回購入: 自己評価のみで購入 → ¥500
2. 友達 3 人評価集まる → 「再統合」したい → ¥500
3. さらに友達 5 人 → ¥500
...

平均 LTV 想定: ¥1,000-2,000/人
```

明示的なリピート促進施策は不要、自然発生に委ねる。

### 統合の最低条件

- **自己評価のみで購入可**（友達 0 人でも OK）
- 友達評価が増えるほど深い統合になる、と訴求

### 友達評価機能の位置づけ

```
🆓 無料維持の機能:
- 自己診断（50 問）
- 友達評価依頼の送信
- 友達評価への回答（30 問）
- マイ図鑑でのカード閲覧
- 「○○から見たあなた」の単独表示

💰 有料機能:
- AI 統合トリセツ生成（¥500/回）
- PDF ダウンロード（生成時に同梱）
- 永続閲覧 URL
```

→ バイラル装置（友達評価）は無料、課金ポイント（AI 統合）は有料の綺麗な分離。

### 友達評価の「PDF 利用オプトイン制」（B3 決着、案 C 採用）

友達評価は **そのまま統合 PDF に載るわけではない**。PDF の永続性・配布可能性を考慮し、**友達側に明示的同意（オプトイン）を取る** 設計に変更:

```
友達評価フロー（30 問回答後）:
   ↓
[ オプトインチェックボックス（デフォルト OFF） ]
   ☐ この評価が、相手の有料トリセツ PDF に
      私の名前付きで載ること、PDF が相手によって
      第三者と共有される可能性に同意します。

   ※ チェックしない場合も、相手は「○○さんから見た自分」
     を Web 画面で閲覧できます。PDF 化・統合 AI 素材化のみ
     不可になります。
```

**データモデル**: `friend_perceptions.pdf_consent` boolean カラム追加（§ 13 参照）

**AI 統合素材選択 UI**（`/integrated/new`）:
- オプトイン済み perception のみ「統合素材」として選択可能
- 未同意の perception は「Web 閲覧のみ可・PDF 不可」とラベル表示
- 「○○さんに改めて同意を依頼する」ボタン（任意）

**招待文言の明示**:
- 招待 LINE Flex に「あなたの評価は、相手の有料トリセツに使われる可能性があります（最後に同意を選べます）」を明示
- プライバシーポリシー（§ 33）で詳細を規定

**Phase 2 検討事項**:
- イニシャル化オプション（「友人 A」表記で同意のハードルを下げる）
- 同意取消フロー（後から取り下げ可能にするか）

---

# Part 2: AI 機能の完全刷新仕様

## 4. AI モデル変更: Haiku 4.5 → Opus 4.7

### モデル比較

| モデル | Input/M | Output/M | 5,000-6,000 字生成コスト（実測想定） | 品質 |
|---|---|---|---|---|
| Claude Haiku 4.5 | $0.80 | $4.00 | ~$0.025 | 中〜高 |
| Claude Sonnet 4.6 | $3.00 | $15.00 | ~$0.10 | 高 |
| **Claude Opus 4.7** | **$15.00** | **$75.00** | **~$0.36** | **最高** |

※ 入力 ~6,500 tokens（友達 3 人 perception 込み）+ 出力 ~3,500 tokens 想定

→ **Opus 4.7 採用、最高品質を実現**（コスト試算は § 3 参照）。

→ Week 1 の T1-7 で実測。想定の 1.5 倍を超える場合は Sonnet 4.6 への切替か価格再考。

### 実装変更

```typescript
// src/lib/ai-cost.ts

export const AI_MODEL_DEFAULT = 'claude-opus-4-7';

export const COST_RATES = {
  'claude-opus-4-7': {
    input: 15.00,   // USD per 1M tokens
    output: 75.00,  // USD per 1M tokens
  },
  'claude-haiku-4-5-20251001': {
    input: 0.80,
    output: 4.00,
  },
  // 後方互換のため Haiku も残す（将来切替可能）
} as const;

export function calculateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = COST_RATES[model] ?? COST_RATES['claude-opus-4-7'];
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return Number((inputCost + outputCost).toFixed(6));
}
```

### maxDuration 拡張

Opus 4.7 で 5,000-6,000 字生成は **30-90 秒** かかる可能性:

```typescript
// src/app/api/integrated-trisetsu/route.ts
export const maxDuration = 120;  // 60 秒 → 120 秒（Vercel Pro/Fluid Compute 前提）
```

※ Vercel Hobby プランでは 10 秒制限のため動作しない。**Vercel Pro 以上 + Fluid Compute 有効化**を確認すること。

### max_tokens 拡張（O2 反映）

旧計画では `max_tokens = 8000` としていたが、5,000-6,000 字 + JSON 構造のオーバーヘッドで **末尾切れリスク**がある。安全側に倒す:

```typescript
// src/lib/anthropic-client.ts
const response = await anthropic.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 16000,             // 8000 → 16000 に拡張（事故防止）
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: userPrompt }],
});
```

理由:
- 日本語 6,000 字 ≈ 出力 3,500-4,500 tokens
- JSON のキー名・引用符・エスケープで +20% 程度
- Opus が「もう少し膨らませる」判断をして 7,000 字に達するケースもある
- **末尾切れ = JSON.parse 失敗 = 100% リトライ**になるので、上限は余裕を持って設定

### JSON パース失敗時のリトライ戦略（O2 反映）

```typescript
// src/lib/integrated-trisetsu-generator.ts

async function generateIntegratedTrisetsu(input, maxRetries = 2): Promise<IntegratedResult> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callAnthropic(input);
      const parsed = parseAndValidateJson(response);  // 構造検証込み
      return parsed;
    } catch (err) {
      lastError = err;
      if (err instanceof JsonParseError || err instanceof SchemaValidationError) {
        // 構造系エラーはリトライ価値あり
        await sleep(1000 * Math.pow(2, attempt));  // 指数バックオフ
        continue;
      }
      // ネットワーク・API エラーはリトライしない（コスト二重課金リスク）
      throw err;
    }
  }
  throw new Error(`Generation failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}
```

**判定基準**:
- `JsonParseError`: JSON.parse が失敗（末尾切れ等）
- `SchemaValidationError`: 必須キー（chapters.essence 等）が欠落
- 上記 2 つのみリトライ対象。**API エラー（429, 500 等）はリトライしない**（二重課金回避、後段で手動再実行）

**ログ要件**: リトライ回数・各試行の生レスポンスは `events` テーブルに記録（後続のプロンプト改善材料に）

---

## 5. AI 出力の 7 セクション構成

### 全体構造

```
🎴 ワタシのトリセツ プレミアム版

【表題】
${ownerName}さんの真のトリセツ
━━━━━━━━━━━━━━━━━━━

【副題】
1-2 行のサマリー

━━━━━━━━━━━━━━━━━━━

【第 1 章】見えてきた本質
   〜 Big Five が示す、あなたの核 〜

【第 2 章】あなたの多面性
   〜 視点が違えば、見える景色も違う 〜

【第 3 章】気づきにくい自分
   〜 ○○さんは知らない、あなた 〜

【第 4 章】強みと弱み
   〜 武器と、注意すべき癖 〜

【第 5 章】対人関係パターン
   〜 誰と、どう関わるか 〜

【第 6 章】人生の指針
   〜 これからを生きるヒント 〜

【第 7 章】あなたへのメッセージ
   〜 結びの言葉 〜
```

### 各章の文字数目安

```
第 1 章: 800-1,000 字（本質を厚く）
第 2 章: 700-900 字
第 3 章: 700-900 字
第 4 章: 800-1,000 字（実用性が高い章）
第 5 章: 700-900 字
第 6 章: 600-800 字
第 7 章: 200-400 字（短く印象的に）

合計: 約 5,000-6,000 字
```

### システムプロンプト（最終版）

```
あなたは Big Five 性格分析の世界的権威であり、
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
7 章構成、各章の文字数目安:
- 第 1 章: 見えてきた本質（800-1,000 字）
- 第 2 章: あなたの多面性（700-900 字）
- 第 3 章: 気づきにくい自分（700-900 字）
- 第 4 章: 強みと弱み（800-1,000 字）
- 第 5 章: 対人関係パターン（700-900 字）
- 第 6 章: 人生の指針（600-800 字）
- 第 7 章: あなたへのメッセージ（200-400 字、短く印象的）

合計: 約 5,000-6,000 字

【各章の必須要素】

第 1 章: 見えてきた本質
- 全視点で一致している核となる特徴
- Big Five の 5 軸 + 10 ファセットレベルでの分析
- 学術的根拠（例: 「Costa & McCrae の研究では...」）
- 「これがあなたの揺るがない本質」と結ぶ

第 2 章: あなたの多面性
- 視点ごとに違う側面の意味
- 「○○さんから見ると△△、◇◇さんから見ると□□」具体的に
- 矛盾を「人としての豊かさ」として記述
- 「人によって違う顔を見せられる」のは才能

第 3 章: 気づきにくい自分
- 自己 vs 他者のギャップから浮き彫りにする
- 「あなたが思う自分」と「他者が見るあなた」の差
- ギャップは「成長のヒント」or「隠れた魅力」
- 1-2 個の具体的な「気づき」を提示

第 4 章: 強みと弱み
- ファセットレベルでの具体的記述
- 強み: 3 つ（武器として活用方法も）
- 弱み: 2 つ（弱みを補う視点を添える）
- 人生・キャリアでの活用方法

第 5 章: 対人関係パターン
- どんな人と相性が良いか（タイプ別の補完関係）
- どんな関係で摩擦が起きやすいか
- 調和のヒント（コミュニケーション戦略）
- 友情・恋愛・仕事の場面別

第 6 章: 人生の指針
- このタイプの人が大切にすべきこと
- 避けるべき選択（落とし穴）
- 成長の方向性
- 「あなたの人生戦略」を示す

第 7 章: あなたへのメッセージ
- 1-2 段落の短い文章
- 文学的、心に残る言葉
- レポート全体を象徴する締めくくり

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
必ず以下の JSON で出力:

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
}
```

### ユーザープロンプト構造

```
以下は、{ownerName}さんについての複数のトリセツです:

{includeSelf の場合}
【自己評価】
{ownerName}さん自身が思う、自分のトリセツ:
- タイプ: {selfFullCode}（{selfTypeName}・{selfModifierLabel}）
- 5 軸スコア:
  外向 (E): {E}/10
  協調 (A): {A}/10
  好奇心 (O): {O}/10
  計画 (C): {C}/10
  繊細 (N): {N}/10
- 10 ファセット詳細:
  {各ファセットラベル}: {score}/10
- モディファイア文章:
  「{selfModifierParagraph}」

{各 perception について}
【{perceiverName}さんから見た{ownerName}さん】
- タイプ: {perceivedFullCode}（{perceivedTypeName}・{perceivedModifierLabel}）
- 5 軸スコア: ...
- 10 ファセット: ...
- モディファイア文章:
  「{perceivedModifierParagraph}」
- (もしあれば) おまけの質問:
  - 好きなところ: {favorite_point}
  - 動物に例えると: {animal}
  - 印象的なシーン: {impression_scene}

---

上記を踏まえて、{ownerName}さんの「真のトリセツ」を
7 章構成、約 5,000-6,000 字で生成してください。

学術的根拠を入れつつ、Z 世代の若者にも刺さる
親しみやすく深い文体で。

JSON 形式で出力。
```

---

## 6. プロンプト品質テスト計画

### Phase A: プロンプト初期検証

```
1. 自己評価のみ（perception 0 件）→ 試作
2. 自己 + 友達 1 人 → 試作
3. 自己 + 友達 3 人 → 試作
4. 友達のみ（include_self=false、友達 2 人）→ 試作

各パターンで:
- 5,000 字以上出てるか
- 7 章揃ってるか
- 各章のクオリティ
- 学術的記述の質
- 文学的余韻
```

### Phase B: A/B テスト（オプション、後でも可）

```
バリエーション:
- システムプロンプト v1 vs v2
- 章構成 7 章 vs 8 章
- 文字数指定厳しめ vs 緩め
```

リリース後の改善材料として残す。

---

# Part 3: PDF 生成機能仕様

## 7. PDF 構成設計

### 全体構造（クラシック章立て）

```
[ページ 1] 表紙
  - サービスロゴ
  - 「ワタシのトリセツ プレミアム版」
  - サブタイトル「{ownerName}さんの真のトリセツ」
  - 生成日: 2026-XX-XX
  - 型コード: EAO-C-N（タイプ名）

[ページ 2] 目次
  - 第 1 章 見えてきた本質 ........ p.3
  - 第 2 章 あなたの多面性 ........ p.X
  - 第 3 章 気づきにくい自分 ...... p.X
  - 第 4 章 強みと弱み ............ p.X
  - 第 5 章 対人関係パターン ...... p.X
  - 第 6 章 人生の指針 ............ p.X
  - 第 7 章 あなたへのメッセージ .. p.X
  - 統合した素材 ................. p.X

[ページ 3-]
  各章
  - 章タイトル（大）
  - 章サブタイトル（小、グレー）
  - 本文（読みやすい行間）

[最終 -2 ページ] 結びの章（第 7 章）
  - メッセージ
  - 装飾的な締めくくり

[最終 -1 ページ] 奥付
  - 統合した素材一覧
    - 🟢 自己評価
    - 🟡 田中さんから（実家系）
    - 🟡 佐藤さんから（繊細系）
  - 生成情報
    - 生成日時
    - AI モデル
    - 統合素材数

[最終ページ] サービス情報
  - ワタシのトリセツについて
  - URL
  - 「あなたの自己理解の旅を、これからも」
```

### レイアウトルール

```
ページサイズ: A4（210 × 297mm）
余白: 上下 20mm、左右 25mm

タイポグラフィ:
- 表紙タイトル: 32pt, Noto Serif JP Bold
- 章タイトル: 24pt, Noto Serif JP Bold
- 章サブタイトル: 14pt, Noto Sans JP, gray
- 本文: 11pt, Noto Sans JP, 行間 1.8
- 注釈・奥付: 9pt, Noto Sans JP, gray

カラー:
- メイン: #1A2238（ディープネイビー）
- アクセント: #B8860B（アンティークゴールド）
- セクションカラー（自己=深緑、他者=マスタード、統合=モーヴ）

背景: #FAF7F0（生成り）or 純白
```

### ⚠️ デザイントーンの再評価メモ（B2 関連）

ターゲットを **γ「自己理解を求める若年層」** に再定義した影響で、以下の整合性に懸念が残る:

| 軸 | PDF デザイン | γ ターゲット適合性 |
|---|---|---|
| 配色 | ディープネイビー + ゴールド | △ 大人すぎる可能性。落ち着きと信頼感はあるが、若年層が「自分の本」と感じられるか要検証 |
| 書体 | Noto Serif JP Bold | △ 書籍的・権威的。「本格派」を演出する一方で、SNS で映えるか不明 |
| 既存ブランド | ペンギンマスコット + パステル（`brand-context.md`） | ❌ PDF デザインとはほぼ別世界。SNS 投稿でのギャップが大きい |

**判断**: **デザイントーンは継続前提**（v1 リリース時点）。ただし以下を Week 5-6 で再評価:

- [ ] β協力者（5-10 名）に試作 PDF を見せて感想収集
- [ ] 「重すぎる」「自分のものに感じない」フィードバックが多い場合は、Phase 2 でアクセントカラー追加 or サブ書体導入を検討
- [ ] SNS 投稿用のサムネイル / OG 画像は **別系統のトーン**（ペンギン継続）で運用し、PDF とのギャップを「ブランドの二面性」として演出する案を検討

**Phase 2 候補のデザイン微調整**:
1. アクセントに γ 層向けのモダンな差し色（パステルマスタード / ダスティピンク等）を追加
2. 章扉に小さなペンギンモチーフを忍ばせる（ブランド一貫性）
3. 表紙の色面を「読者の自己診断タイプに応じて変化」させるパーソナライズ案

### 「Z 世代向けトーン維持」とのバランス

```
✅ 維持する要素:
- 親しみやすい言葉遣い（です・ます調）
- 「○○さん」と呼びかけ
- 適度な絵文字（章タイトルの脇に小さく）

✅ 高級感を出す要素:
- 上品なタイポグラフィ
- 余白を効かせる
- 装飾的な見出し
- 落ち着いた色調

→ 「友達からのお手紙」+「上質な手帳」の中間
```

---

## 8. PDF 生成の技術選定

### オプション比較

| オプション | 強み | 弱み |
|---|---|---|
| **React PDF (@react-pdf/renderer)** | React で書ける、Vercel と相性◎ | 細かいタイポグラフィは制限 |
| Puppeteer + HTML/CSS | デザイン自由度最大 | 重い、Vercel で動かしにくい |
| pdfkit | 軽量、低レベル制御 | 開発コスト高い |
| Browserless | クラウド Puppeteer | コスト発生、外部依存 |

### 採用: **React PDF (@react-pdf/renderer)**

理由:
- Vercel Functions で動く
- React コンポーネントとして書ける（保守性◎）
- 日本語フォント対応（Noto Serif JP / Noto Sans JP）
- カスタマイズ柔軟

### ⚠️ Week 1 で先行プロトタイプ必須（O7 反映）

日本語フォント込みの react-pdf は **Vercel Function bundle 50MB 制限**との戦いになる。本格実装に入ってから動かないと判明すると致命的なので、Week 1 のうちに以下の最小プロトタイプを実施:

```
T1-8（新規）: 日本語 PDF フォント先行プロトタイプ
- 最小 React 構成で Noto Serif JP + Noto Sans JP を読み込み
- Vercel Production にデプロイし、PDF が壊れず生成されるか確認
- Function bundle サイズを実測（30MB 以下に収まるか）
- フォントを Subset 化する必要があるか判断
- 必要なら: フォントを Supabase Storage 配置 + 動的フェッチに切替
```

**判断ポイント**:
- bundle が 40MB を超える → フォント外部化必須
- Cold start が 5 秒を超える → フォントキャッシュ戦略要検討
- 縦書き・禁則処理が見るに耐えない → 代替（Puppeteer + Browserless 等）も視野

このプロトタイプが Week 1 で動けば、Week 2 以降の PDF 本実装は安心して進められる。逆に動かなければ、Week 2 のスコープから PDF を一旦切り離し、Phase 2 化を決断する（§ 18 参照）。

### 実装構成

```typescript
// src/components/pdf/IntegratedTrisetsuPDF.tsx

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// フォント登録
Font.register({
  family: 'NotoSerifJP',
  src: '/fonts/NotoSerifJP-Bold.ttf',
});
Font.register({
  family: 'NotoSansJP',
  src: '/fonts/NotoSansJP-Regular.ttf',
});

const styles = StyleSheet.create({
  page: { /* ... */ },
  coverTitle: { /* ... */ },
  chapterTitle: { /* ... */ },
  body: { /* ... */ },
  // ...
});

export function IntegratedTrisetsuPDF({ data }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 表紙 */}
        <CoverPage data={data} />
      </Page>
      <Page size="A4" style={styles.page}>
        {/* 目次 */}
        <TableOfContents data={data} />
      </Page>
      {/* 各章 */}
      {Object.entries(data.chapters).map(([key, chapter]) => (
        <Page size="A4" style={styles.page} key={key}>
          <ChapterPage chapter={chapter} />
        </Page>
      ))}
      {/* 奥付 */}
      <Page size="A4" style={styles.page}>
        <ColophonPage data={data} />
      </Page>
    </Document>
  );
}
```

### PDF 生成 API

```typescript
// src/app/api/integrated-trisetsu/[id]/pdf/route.ts

import { renderToBuffer } from '@react-pdf/renderer';

export async function GET(request, { params }) {
  // 1. 認可確認
  // 2. integrated_trisetsu データ取得
  // 3. PDF 生成
  const pdfBuffer = await renderToBuffer(<IntegratedTrisetsuPDF data={data} />);
  
  // 4. PDF 返却
  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="トリセツ_${ownerName}_${date}.pdf"`,
    },
  });
}
```

---

# Part 4: Stripe 決済統合仕様

## 9. Stripe Payment Element 採用

### なぜ Payment Element

```
✅ Stripe 公式推奨（最新）
✅ 複数決済手段に自動対応（カード / Apple Pay / Google Pay）
✅ ローカル決済（コンビニ等）も将来追加可能
✅ ブランドカラー反映可能
✅ 3D セキュア対応
✅ モバイル UX 最良
```

### 商品・価格設計

```
Stripe Product:
- name: "ワタシのトリセツ AI 統合"
- description: "Big Five 統合分析レポート（PDF 付き）"

Stripe Price:
- amount: 500 (JPY)
- currency: jpy
- type: one_time（買い切り）
- payment_method_types: ['card', 'apple_pay', 'google_pay']
```

### 環境変数

```
# Vercel に追加
STRIPE_SECRET_KEY=sk_live_...        # 本番
STRIPE_PUBLISHABLE_KEY=pk_live_...   # 本番
STRIPE_WEBHOOK_SECRET=whsec_...      # Webhook 署名検証

# テスト環境
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
```

---

## 10. 購入フロー設計

### 全体フロー

```
1. ユーザーが /integrated/new で素材選択
2. 「✨ ¥500 で統合トリセツを生成」ボタンタップ
3. → /checkout 画面に遷移
   - Stripe Payment Element 表示
   - カード情報入力
   - 「決済する」ボタン
4. Stripe で決済処理
5. 成功 → Webhook で受信
6. /api/integrated-trisetsu を即実行（AI 生成）
7. 並行で LINE に「統合を作成中です」通知
8. AI 生成完了 → /integrated/[id] にリダイレクト
9. 並行で LINE に「統合完了」通知
10. ユーザーが PDF ダウンロード可能
```

### 詳細画面遷移

```
/integrated/new
  ↓ 「✨ ¥500 で統合トリセツを生成」
  ↓
/checkout/[session_id]?source=integrated
  ├─ Payment Element
  ├─ 統合内容のプレビュー（素材一覧）
  └─ 「決済する」ボタン
  ↓ Stripe 決済成功
  ↓
/checkout/processing?session_id=...
  ├─ 「AI が統合中...」のローディング
  ├─ Polling で生成完了を待つ（5 秒ごと）
  └─ 「LINE で完了通知も受け取れます」
  ↓ AI 生成完了
  ↓
/integrated/[id]
  ├─ 結果表示
  ├─ PDF ダウンロードボタン
  └─ シェアボタン
```

### Stripe Webhook 設計（O4 反映: Idempotency 強化）

```typescript
// src/app/api/webhook/stripe/route.ts

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();
  
  // 1. 署名検証
  const event = stripe.webhooks.constructEvent(
    body, sig, process.env.STRIPE_WEBHOOK_SECRET
  );
  
  // 2. イベント処理（すべて idempotent に実装）
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    
    case 'payment_intent.succeeded':
      // 既に checkout.session.completed で処理済み
      break;
    
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }
  
  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session) {
  const { user_id, perception_ids, include_self } = session.metadata;
  
  // === Idempotency 第 1 層: payment_history INSERT ===
  // stripe_session_id UNIQUE 制約により、二重 INSERT は ON CONFLICT で弾く
  const { data: payment, error } = await supabaseAdmin
    .from('payment_history')
    .insert({
      user_id,
      stripe_session_id: session.id,
      amount_jpy: 500,
      status: 'completed',
      paid_at: new Date().toISOString(),
      metadata: { perception_ids, include_self },
    })
    .onConflict('stripe_session_id')
    .ignore()              // 既に存在すれば何もしない
    .select()
    .single();

  if (!payment) {
    // 既存 payment → 既に処理済み、何もしない
    return;
  }

  // === Idempotency 第 2 層: integrated_trisetsu の status をチェック ===
  // この payment_id に紐付く生成が既にあれば再実行しない
  const existing = await supabaseAdmin
    .from('integrated_trisetsu')
    .select('id, status')
    .eq('payment_id', payment.id)
    .maybeSingle();

  if (existing) {
    // 既に生成試行済み → 何もしない（status='failed' でも再実行しない、手動対応）
    return;
  }

  // === ここから AI 生成キック ===
  // 1. integrated_trisetsu レコードを status='pending' で先に作成（ロック代わり）
  const { data: trisetsu } = await supabaseAdmin
    .from('integrated_trisetsu')
    .insert({
      user_id,
      payment_id: payment.id,
      status: 'pending',
      perception_ids,
      include_self,
    })
    .select()
    .single();

  // 2. AI 統合を非同期実行（同関数内で直接呼出が望ましい、内部 fetch は避ける）
  await generateIntegratedTrisetsuAsync(trisetsu.id);

  // 3. LINE 通知（「統合作成中」）
  await sendLineMessage(user_id, buildPaymentReceivedFlex());
}
```

**Idempotency 戦略まとめ**:
1. **DB 層**: `payment_history.stripe_session_id` UNIQUE 制約
2. **アプリ層**: `integrated_trisetsu.payment_id` で再実行ガード
3. **Webhook**: ON CONFLICT IGNORE で同イベント複数受信に耐性
4. **AI 生成**: 同一 payment_id に対する生成は **1 回のみ**、失敗時は手動再実行

**内部 fetch を避ける理由**:
- 旧計画では `fetch(BASE_URL/api/integrated-trisetsu/generate-paid)` + `INTERNAL_API_TOKEN` で内部 API を呼んでいたが、これは:
  - 不要な HTTP オーバーヘッド
  - トークン漏洩リスク
  - Function タイムアウトの二重カウント
  → 同じ Function 内で **直接関数呼び出し**にする（`generateIntegratedTrisetsuAsync(trisetsuId)`）

### エラーハンドリング（O5 反映: MVP は手動対応 + 監視）

| ケース | MVP（v1）対応 | Phase 2 対応 |
|---|---|---|
| 1. 決済成功 + AI 生成失敗 | `integrated_trisetsu.status = 'failed'` を記録 / Admin に Slack 通知 / **手動で再実行 or 返金判断** | 自動リトライ（1 回まで）+ 失敗時自動返金 |
| 2. 決済失敗 | Stripe 標準のエラー表示、再試行 UI | 同左 |
| 3. 重複決済（同 session 二重受信） | UNIQUE 制約 + ON CONFLICT IGNORE で吸収 | 同左 |
| 4. 決済成功 + Webhook 受信失敗 | Stripe ダッシュボードから手動再送 + `payment_history` 確認スクリプト | 定期 polling で Stripe → DB 整合性チェック自動化 |
| 5. AI 生成成功 + LINE 送信失敗 | logLineMessage 記録 / 結果は Web で閲覧可なので致命的ではない | 自動リトライ |

**MVP の運用**:
- Slack（または LINE 開発者通知）で `integrated_trisetsu.status = 'failed'` を即時アラート
- 1 日 1 回、`payment_history` と `integrated_trisetsu` の整合性スクリプト実行
- 失敗時の返金は **手動で Stripe ダッシュボードから refund**（自動化は Phase 2）

**Phase 2 検討**:
- 失敗時の自動 refund（Stripe Refund API + `payment_history.refunded_at` 更新）
- Cron で `status = 'pending'` が 5 分以上滞留しているレコードを検知して自動リトライ

---

# Part 5: 購入後フロー仕様

## 11. 即生成 + LINE 通知併用

### 設計方針

```
ユーザー視点:
1. 決済 → 即座に AI 生成開始
2. 結果を待つ間、画面で進捗確認
3. もし離脱しても、LINE で通知が来るので戻ってこれる
4. 戻ったら結果が完成している
```

### Polling 設計（O3 反映: integrated_trisetsu.status を参照）

`payment_history.status` は **決済の状態**、`integrated_trisetsu.status` は **AI 生成の状態**。Polling は後者を参照する。

```typescript
// /checkout/processing/page.tsx

// 5 秒ごとに生成 status をチェック
const pollIntegrationStatus = async (sessionId) => {
  const response = await fetch(`/api/checkout/status?session_id=${sessionId}`);
  const data = await response.json();
  
  // data: {
  //   payment_status: 'completed' | 'pending' | 'failed',
  //   generation_status: 'pending' | 'generating' | 'completed' | 'failed',
  //   integrated_trisetsu_id?: string,
  // }
  
  if (data.generation_status === 'completed') {
    router.push(`/integrated/${data.integrated_trisetsu_id}`);
  } else if (data.generation_status === 'failed') {
    // エラー画面（サポート連絡先表示）
  }
  // pending / generating なら継続 polling
};

useEffect(() => {
  const interval = setInterval(() => pollIntegrationStatus(sessionId), 5000);
  // 最長 3 分（36 回）で自動停止 + LINE 通知促し画面に遷移
  const timeout = setTimeout(() => {
    clearInterval(interval);
    router.push(`/checkout/waiting-line?session_id=${sessionId}`);
  }, 180_000);
  return () => { clearInterval(interval); clearTimeout(timeout); };
}, [sessionId]);
```

**`/api/checkout/status` の実装**:
```typescript
// session_id から payment_history を引く
// → payment_id から integrated_trisetsu を引く
// → 両方の status を返す
```

**離脱ハンドリング**:
- 3 分経過で polling 停止 → 「LINE で完了通知をお待ちください」画面に遷移
- ユーザーがブラウザを閉じても LINE 通知でリーチ可能

### LINE 通知のタイミング

```
通知 1: 決済完了
  「✨ ¥500 のお支払いを受け取りました
   AI 統合トリセツを作成中です...
   完了したら、またお知らせします」

通知 2: 統合完了（30-60 秒後）
  「🎴 ${ownerName}さんの真のトリセツが完成しました
   
   [統合トリセツを見る]
   [PDF をダウンロード]」

通知 3: 万一の失敗時（MVP は手動返金、O5 参照）
  「⚠️ AI 統合の生成に問題が発生しました
   ご迷惑をおかけしてすみません。
   サポート（公式 LINE のこのトーク）にご返信ください、
   状況確認のうえ、返金または再生成のご案内をいたします。」

  ※ MVP では「お支払いは取り消されました」と自動的には書かない（自動返金未実装のため）。
   Phase 2 で自動返金実装後に文言変更。
```

### LINE Flex デザイン

3 種類の新 Flex builder:
- `buildPaymentReceivedFlex()` 
- `buildIntegratedCompletePaidFlex()`
- `buildPaymentFailedFlex()`

---

# Part 6: データベース完全リセット仕様

## 12. リセット方針

### 採用方針: **完全リセット、DB クリア**

```
既存テスト DB:
- 6 名のテストアカウントデータ
- 不要な検証データ

新本番 DB:
- スキーマは流用（一部拡張）
- データは空からスタート
- 「ワタシのトリセツ プレミアム版 v1.0」として
```

### 実施方法（2 案）

#### 案 A: 既存 Supabase プロジェクトで TRUNCATE

```sql
-- 全テーブルクリア（CASCADE で関連も削除）
TRUNCATE users, line_users, friend_answers, friend_perceptions,
         integrated_trisetsu, notification_preferences, line_messages_sent,
         events CASCADE;

-- 自動増分 ID リセット（必要なら）
ALTER SEQUENCE xxx RESTART;
```

→ 速い、コスト 0

#### 案 B: 新 Supabase プロジェクト作成

```
新規プロジェクト立ち上げ:
- 新 URL / API キー
- スキーマを一括 apply
- 環境変数刷新
```

→ クリーン、心理的にもリセット

採用: **案 A**（速い、コスト最小）

### スキーマ拡張

#### 新規テーブル: payment_history

```sql
CREATE TABLE payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE NOT NULL,
  stripe_payment_intent_id text,
  amount_jpy integer NOT NULL,
  currency text DEFAULT 'jpy',
  status text NOT NULL,           -- 'pending' | 'completed' | 'failed' | 'refunded'
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb,                  -- perception_ids, include_self 等
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX idx_payment_history_stripe_session ON payment_history(stripe_session_id);
CREATE INDEX idx_payment_history_status ON payment_history(status);
```

#### integrated_trisetsu テーブル拡張（O3 反映）

```sql
ALTER TABLE integrated_trisetsu
  ADD COLUMN payment_id uuid REFERENCES payment_history(id),
  ADD COLUMN status text NOT NULL DEFAULT 'pending',
    -- 'pending'   : payment 完了、生成キュー待ち
    -- 'generating': AI 呼び出し中
    -- 'completed' : 生成完了
    -- 'failed'    : 生成失敗（手動対応待ち）
  ADD COLUMN failure_reason text,           -- 失敗時のエラー要約
  ADD COLUMN retry_count integer DEFAULT 0, -- リトライ回数
  ADD COLUMN pdf_generated_at timestamptz,
  ADD COLUMN pdf_url text;                  -- Supabase Storage の URL

CREATE UNIQUE INDEX idx_integrated_trisetsu_payment_unique
  ON integrated_trisetsu(payment_id)
  WHERE payment_id IS NOT NULL;
  -- payment_id が NULL（自己評価のみで購入前テスト等）以外は 1:1 に強制
```

#### friend_perceptions テーブル拡張（B3 反映）

```sql
ALTER TABLE friend_perceptions
  ADD COLUMN pdf_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN pdf_consent_at timestamptz,         -- 同意した日時
  ADD COLUMN pdf_consent_revoked_at timestamptz; -- 同意取消（Phase 2 で UI 提供）

CREATE INDEX idx_friend_perceptions_pdf_consent
  ON friend_perceptions(target_user_id, pdf_consent)
  WHERE pdf_consent = true;
  -- AI 統合素材選択クエリの高速化
```

**運用ルール**:
- 評価送信時に `pdf_consent` を friend にチェックボックスで取得（デフォルト OFF）
- `/api/zukan-mine` の statistics で「PDF 利用可能な perception 数」と「Web 閲覧のみの perception 数」を分けて表示
- `/integrated/new` の素材選択 UI では `pdf_consent = true` のものだけ選択可能

---

## 13. データモデル全体図（プレミアム版）

```
users
├── id (uuid)
├── line_user_id
├── owner_token
├── invite_code
├── source_user_id (招待元)
├── created_at
├── type_id
├── scores (jsonb)
└── modifier_label

line_users
├── line_user_id (PK)
├── owner_token (FK)
├── current_owner_token (再診断時)
└── ...

friend_answers
├── id
├── user_id (FK)
├── answers (jsonb, {v:2, scale:{}, choice:{}})
└── ...

friend_perceptions
├── id
├── target_user_id (FK)
├── perceiver_name
├── perceived_full_code
├── pdf_consent (boolean)            ← B3: PDF 利用同意フラグ
├── pdf_consent_at
├── pdf_consent_revoked_at
├── ...
└── notified_at

integrated_trisetsu                  ← 有料機能のコア
├── id
├── user_id (FK)
├── perception_ids (uuid[])
├── include_self (boolean)
├── status (text)                    ← O3: pending|generating|completed|failed
├── failure_reason
├── retry_count
├── generated_title
├── generated_subtitle
├── generated_chapters (jsonb)       ← 7 章構成
├── ai_model
├── ai_cost_usd
├── payment_id (FK, UNIQUE 部分制約) ← 課金紐付け + idempotency
├── pdf_url                          ← PDF 保存先
└── ...

payment_history                      ← 新規
├── id
├── user_id (FK)
├── stripe_session_id
├── amount_jpy
├── status
└── ...

notification_preferences
├── line_user_id (PK)
├── enable_xxx (boolean × 5)
└── ...

line_messages_sent                   ← 監査ログ
├── id
├── line_user_id
├── message_type
└── ...
```

---

# Part 7: 既存資産の流用 vs 刷新

## 14. 流用 / 刷新マトリクス

### ✅ そのまま流用（コード変更最小）

| カテゴリ | 機能 | 理由 |
|---|---|---|
| **データモデル** | users, friend_answers, friend_perceptions | 安定、変更不要 |
| **自己診断ロジック** | 50 問、Big Five 計算 | コア機能、不変 |
| **友達評価ロジック** | 30 問、perception 派生 | コア機能、不変 |
| **タイプ定義** | 32 タイプ、5 軸、10 ファセット | 不変 |
| **LIFF 認証** | id_token 検証 | 動作確認済み |
| **マイ図鑑** | カード閲覧 UI | 動作確認済み |
| **削除フロー** | A-4 + D-11 | 動作確認済み |
| **通知設定** | D-10 | 動作確認済み |
| **logLineMessage** | 監査ログ | 動作確認済み |

### 🔧 部分改修（コア変更）

| カテゴリ | 機能 | 変更点 |
|---|---|---|
| **AI 統合 API** | /api/integrated-trisetsu | Opus 4.7 + 5,000 字プロンプト |
| **統合表示ページ** | /integrated/[id] | 7 章構成の新レンダリング |
| **マイ図鑑 integrated** | /api/zukan-mine | payment 紐付け考慮 |
| **statistics 設定** | /settings | 課金履歴セクション追加 |

### 🆕 新規実装

| カテゴリ | 機能 |
|---|---|
| **決済システム** | Stripe Payment Element, Webhook |
| **購入フロー** | /checkout, /checkout/processing |
| **PDF 生成** | React PDF + 章立てレイアウト |
| **payment_history** | DB テーブル + 関連 API |
| **支払い後フロー** | 即生成 + LINE 通知併用 |
| **ローンチページ** | LP（マーケティング用、後フェーズ） |

### ❌ 廃止

| カテゴリ | 機能 | 理由 |
|---|---|---|
| **無料版 AI 統合** | Haiku 4.5 統合 | 有料化により廃止 |
| **「準備中」Flex** | buildIntegratedComingSoonFlex | 不要 |
| **既存β通知** | β向け案内文言 | リセット |

---

# Part 8: 開発フェーズ（6 週間構成）

スケジュール概要（O7 反映、ローンチ目標: **2026-06-30 / 予備 7-2**）:

```
Week 1 (5/19-25): AI 機能刷新 + PDF フォント先行プロトタイプ
Week 2 (5/26-6/1): PDF 本実装 + Stripe 統合
Week 3 (6/2-8): リニューアル + UX 磨き + 友達評価オプトイン UI
Week 4 (6/9-15): 統合テスト + バグ潰し
Week 5 (6/16-22): LP + 特商法 + プライバシーポリシー + β 試遊
Week 6 (6/23-29): 最終調整 + バッファ + 公開準備
2026-06-30: ローンチ 🚀（予備: 7-2）
```

---

## 15. Week 1: AI 機能の完全刷新 + PDF プロトタイプ

### タスク

```
T1-1: ai-cost.ts 更新
  - AI_MODEL_DEFAULT = 'claude-opus-4-7'
  - COST_RATES に Opus 追加（input $15/M, output $75/M）

T1-2: ai-prompt-builder.ts 完全書き直し
  - 7 章構成プロンプト
  - 仕様書のシステム + ユーザープロンプト
  - JSON スキーマ

T1-3: anthropic-client.ts 微修正
  - max_tokens = 16000 に拡張（O2 反映）
  - JSON パース失敗時のリトライ実装（最大 2 回、指数バックオフ）
  - レスポンス処理を 7 章対応

T1-4: /api/integrated-trisetsu/route.ts 改修
  - maxDuration = 120
  - 新 JSON 構造保存
  - integrated_trisetsu.generated_chapters カラム対応

T1-5: DB マイグレーション（一括）
  - integrated_trisetsu.generated_chapters jsonb
  - integrated_trisetsu.status text + failure_reason + retry_count
  - integrated_trisetsu.payment_id uuid（次フェーズで使用）
  - friend_perceptions.pdf_consent boolean + pdf_consent_at
  - payment_history テーブル新規作成

T1-6: /integrated/[id]/page.tsx 改修
  - 7 章構成のレンダリング
  - 章タイトル + サブタイトル + 本文
  - 上品なタイポグラフィ

T1-7: プロンプト品質テスト + 実コスト計測
  - 5 パターン試作（自己のみ、自己+1、自己+3、友達のみ、複雑）
  - 各回の input/output tokens を実測
  - 平均コスト ¥54 想定との乖離を確認
  - 結果を共有してフィードバックループ

T1-8 [新規]: 日本語 PDF フォント先行プロトタイプ
  - @react-pdf/renderer 最小構成セットアップ
  - Noto Serif JP + Noto Sans JP の読み込み確認
  - Vercel Production にデプロイ
  - Function bundle サイズ実測（30MB 以下が目標）
  - Cold start 時間計測
  - GO / NO-GO 判定: Week 2 で PDF 本実装に進むか、Phase 2 化するか
```

### 完了基準

- ✅ Opus 4.7 で 5,000 字超の出力が安定する
- ✅ 7 章構成 JSON が壊れず生成される（リトライ込みで成功率 99%+）
- ✅ /integrated/[id] で美しく表示される
- ✅ 実コスト計測完了（¥54 ± 30% 以内が許容）
- ✅ PDF フォントプロトタイプが Production で動作（または NO-GO 判定確定）

---

## 16. Week 2: PDF 本実装 + Stripe 決済

**前提**: T1-8 で GO 判定が出ていること。NO-GO 時は PDF タスクを Phase 2 に移し、Stripe 決済 + Web 結果のみで進める。

### タスク

```
T2-1: PDF コンポーネント作成
  - CoverPage（表紙）
  - TableOfContents（目次）
  - ChapterPage（各章）× 7
  - ColophonPage（奥付）
  - 統合エクスポート IntegratedTrisetsuPDF
  - 行末禁則処理（、。の行頭回避、章タイトル孤立回避）

T2-2: /api/integrated-trisetsu/[id]/pdf エンドポイント
  - GET で PDF バッファ返却
  - 認可確認（本人のみ、または有効な閲覧トークン）
  - エラーハンドリング
  - 生成成功時に pdf_url / pdf_generated_at を更新

T2-3: /integrated/[id] にダウンロードボタン追加
  - PDF ダウンロードリンク
  - 「PDF をダウンロード」CTA

T2-4: Stripe 環境構築
  - npm install stripe @stripe/stripe-js @stripe/react-stripe-js
  - 環境変数追加（test → prod 切替準備）
  - Stripe Product / Price 作成（ダッシュボードで）

T2-5: /checkout/[session_id]/page.tsx
  - Stripe Payment Element 統合
  - 統合内容プレビュー（素材一覧、PDF 利用可フラグ表示）
  - 決済ボタン

T2-6: /api/checkout/create-session
  - POST で Stripe Checkout Session 作成
  - metadata に perception_ids 等を含める
  - return_url 設定
  - サーバー側で perception の pdf_consent を再検証（改竄防止）

T2-7: /api/webhook/stripe（O4 反映）
  - Webhook 受信 + 署名検証
  - checkout.session.completed 処理
  - payment_history INSERT（ON CONFLICT IGNORE）
  - integrated_trisetsu 'pending' レコード作成
  - AI 生成を同 Function 内で直接呼び出し
  - status を 'generating' → 'completed' / 'failed' に更新

T2-8: /api/checkout/status エンドポイント
  - session_id から payment + generation status を返却
  - Polling 用

T2-9: 決済フローの統合テスト（Stripe Test モード）
  - 正常系（決済 → 生成 → PDF）
  - 異常系（決済成功 / 生成失敗）の手動再実行手順確認
  - Idempotency 検証（同 session ID で 2 回受信させる）

T2-10: Slack（または LINE 開発者通知）アラート設定
  - integrated_trisetsu.status = 'failed' を即時アラート
```

### 完了基準

- ✅ PDF が高級感ある仕上がりで生成される
- ✅ Stripe テストモードで決済が通る
- ✅ Webhook が正しく受信される、二重受信で二重生成しない
- ✅ payment_history が記録される
- ✅ 失敗時に Slack アラートが飛ぶ

---

## 17. Week 3: リニューアル + UX 磨き + 友達評価オプトイン UI

### タスク

```
T3-1: DB 完全リセット
  - TRUNCATE 全テーブル CASCADE（既存 6 名へ事前 DM）
  - 確認 SQL 実行
  - クリーン状態確認

T3-2: 購入フロー実装
  - /integrated/new の「生成」ボタン → 「決済へ進む」に変更
  - 素材選択 UI に pdf_consent フラグの表示（"PDF 可" バッジ）
  - /checkout/processing 画面（polling 実装、3 分タイムアウト）
  - /checkout/waiting-line 画面（3 分超過時の LINE 通知待ち画面）
  - 結果表示遷移

T3-3: 友達評価オプトイン UI（B3 反映）
  - /friend/[inviteCode] の回答送信前ステップに同意チェックボックス追加
  - デフォルト OFF、文言は § 3「PDF 利用オプトイン制」参照
  - 完了画面に「同意状態」を表示（変更したい場合の問い合わせ案内）
  - 招待 LINE Flex に同意フローの説明を追記

T3-4: LINE 通知 Flex 3 つ
  - buildPaymentReceivedFlex（決済受領）
  - buildIntegratedCompletePaidFlex（完成）
  - buildPaymentFailedFlex（失敗、手動対応案内文言）

T3-5: UX 全体磨き込み（仕様書のルール適用）
  - 絵文字選別（機能のみ、装飾廃止）
  - 改行最適化
  - ブランドカラー適用
  - フォント統一（Noto Serif + Sans + Mono）
  - カードデザイン刷新

T3-6: 各ページ個別磨き
  - /diagnosis 結果ページ
  - /friend/[inviteCode] 完成画面
  - /zukan-mine（pdf_consent 状況の表示追加）
  - /integrated/[id]
  - /settings（課金履歴セクション追加）
  - LINE Flex 全件

T3-7: 既存無料版機能の整理
  - 「準備中」Flex 削除
  - β向け文言の刷新
  - 不要な機能の隠蔽
```

### 完了基準

- ✅ DB クリーン状態
- ✅ 購入フロー全体が動く（テストモード）
- ✅ 友達評価オプトイン UI が機能
- ✅ UX 全体に統一感がある
- ✅ Z 世代向けトーン + 本格派の両立

---

## 18. Week 4: 統合テスト + バグ潰し

### タスク

```
T4-1: フルフロー実機テスト
  - 自己診断 → 友達評価（オプトイン あり/なし両パターン）→ 統合（決済込み）
  - PDF ダウンロード
  - LINE 通知全種類
  - Polling + LINE 通知の二重化テスト
  - エラーケース全網羅（決済失敗、生成失敗、二重 webhook、フォント壊れ）

T4-2: Idempotency 検証
  - 同 session で Webhook を 2 回叩く（手動 or Stripe ダッシュボード）
  - integrated_trisetsu が 2 件作られないこと確認
  - AI が 2 回呼ばれないこと確認（コストログで検証）

T4-3: 性能計測
  - PDF 生成時間（Cold start / Warm 両方）
  - AI 生成時間の分布（最小・中央値・最大）
  - Polling のクライアント体感

T4-4: バグ潰し
  - 全機能の最終確認
  - クリティカルバグゼロを確認

T4-5: 監視・運用準備
  - Slack アラート最終確認
  - 整合性スクリプト（payment vs integrated）動作確認
  - 手動返金手順のドキュメント化
```

### 完了基準

- ✅ 全フロー、決済込みで動作
- ✅ Idempotency 検証パス
- ✅ クリティカルバグゼロ
- ✅ 監視 + リカバリ手順が運用可能

---

## 19. Week 5: LP + 法務 + β 試遊

### タスク

```
T5-1: ローンチページ（LP）作成
  - サービス紹介
  - 価格表記（¥500、税込）
  - 「始める」CTA → LINE 友達追加
  - PDF サンプルのスクショ掲載
  - SEO メタタグ + OG 画像

T5-2: 特商法表記ページ作成（§ 31 参照）
  - 販売事業者情報、所在地、連絡先
  - 販売価格、決済方法
  - 商品の提供方法、提供時期
  - 返品・キャンセルポリシー

T5-3: プライバシーポリシー改訂
  - 友達評価の PDF 利用同意取得を明記
  - 第三者提供の有無（Stripe / Anthropic）
  - データ保持期間、削除手続き
  - お問い合わせ窓口

T5-4: 利用規約改訂
  - 有料サービスの提供条件
  - 禁止事項（不正利用、第三者個人情報の入力等）
  - 免責事項

T5-5: β 試遊（5-10 名）
  - 信頼できる協力者に試遊依頼
  - 試遊用ディスカウントコード or テスト用無料生成
  - PDF と Web 結果両方の感想収集
  - デザイントーンが γ 層に合うか確認（§ 7 再評価メモ参照）

T5-6: Stripe 本番モード切り替え
  - 本番 API キー設定
  - Webhook URL 本番化
  - テスト決済 1 回（自分のカード、¥500 → 即返金）
```

### 完了基準

- ✅ LP 完成
- ✅ 特商法・プライバシー・利用規約の 3 点セット公開可能
- ✅ β 試遊フィードバック反映済み
- ✅ Stripe 本番接続確認

---

## 20. Week 6: 最終調整 + バッファ + 公開準備

### タスク

```
T6-1: β 試遊フィードバック反映
  - 「重すぎる」「自分のものに感じない」等の改善
  - 必要なら Phase 2 リストに送る判断

T6-2: ブランド最終調整
  - リッチメニュー画像差し替え
  - 公式アカウントの紹介文更新
  - LIFF アプリ情報更新
  - SNS プロフィール文 / 固定投稿準備

T6-3: ローンチアナウンス準備
  - 公式アカウントから告知案
  - X 投稿準備（ローンチ宣言 + デモ動画）
  - Instagram 投稿準備（ビジュアル + ストーリーズ）
  - 知人案内 DM 文面

T6-4: 最終バグ潰し
  - 致命的バグゼロ
  - 軽微バグも Phase 2 リスト化

T6-5: バッファ（予備日）
  - 6/27-29: 想定外の遅延対応用
  - 6/30 ローンチ可能か最終判断

T6-6: 一発公開 🚀
  - 2026-06-30（または予備 7-2）
  - LINE 告知 → SNS 同時投稿
  - 監視オン（Slack アラート、リアルタイム確認）
```

### 完了基準

- ✅ 全項目クリア
- ✅ バグ報告ゼロ状態
- ✅ ブランド・告知準備完了
- ✅ ローンチ判断 GO

---

# Part 9: リスクと対策

## 21. 主要リスク

| # | リスク | 影響度 | 対策 |
|---|---|---|---|
| R1 | Opus 4.7 のコスト想定オーバー（実測 $0.36 から更に膨張） | 中 | T1-7 で実コスト計測、月次集計、Sonnet 4.6 切替 or ¥800 値上げ判断 |
| R2 | Opus 4.7 のレスポンス時間（90 秒超） | 中 | maxDuration = 120、Polling 3 分タイムアウト後 LINE 通知へフォールバック |
| R3 | PDF 生成失敗（日本語フォントロード不能 / bundle 超過） | **高** | **T1-8 で先行プロトタイプ実施、NO-GO なら Phase 2 化判断** |
| R4 | Stripe Webhook 失敗 | 高 | リトライ機構 + Slack アラート + 整合性スクリプト + 手動再処理 |
| R5 | 6 週間で完成しない | 中 | Week 単位で進捗確認、Week 6 をバッファに、スコープ削減判断 |
| R6 | 決済成功 / 統合失敗のリカバリ | 高 | status カラム追跡、MVP は手動返金、Phase 2 で自動化 |
| R7 | 既存ユーザーへの説明不足 | 低 | TRUNCATE 前に 6 名へ事前 DM、テストアカウント前提を確認 |
| R8 | 検証なしでローンチして致命バグ | 中 | Week 4 で全フロー実機テスト + Week 5 で β 試遊 |
| R9 | プロンプト品質が想定未満（学術引用が紋切り型・章タイトル単調） | 中 | Week 1 で繰り返し試作、引用バリエーション 5-10 個プリセット |
| R10 | リッチメニュー画像準備の遅れ | 低 | Week 6 までに Canva で内製、デザイナー外注は予算次第 |
| R11 [新規] | **友達評価オプトイン率が低くて統合 PDF の素材が集まらない** | **中** | 招待文言の改善、オプトイン理由の説明強化、イニシャル化オプション Phase 2 |
| R12 [新規] | **法務（特商法・プライバシー・利用規約）整備の遅れ** | **高** | Week 5 で集中対応、雛形 + リーガル相談を事前確保 |
| R13 [新規] | **PDF デザイントーンが γ 層に合わない** | 中 | Week 5 β 試遊でフィードバック収集、Phase 2 で微調整 |
| R14 [新規] | **JSON パース失敗の連発（Opus 出力ブレ）** | 中 | リトライ実装済み、events ログ収集、システムプロンプトの JSON 強調 |

## 22. リスク対策の優先順位

```
最優先（必須対応）:
- R3: PDF フォント → T1-8 先行プロトタイプで早期判断
- R4: Webhook 失敗 → 監視 + Slack アラート + 手動リカバリ
- R6: 決済成功・統合失敗 → status 追跡 + 手動返金フロー
- R12: 法務整備 → Week 5 集中対応

中優先（影響大なら対応）:
- R1: コストオーバー → Week 1 実測
- R8: 致命バグ → Week 4 徹底テスト + Week 5 β 試遊
- R9: プロンプト品質 → Week 1 繰り返し検証
- R11: オプトイン率 → 招待文言改善
- R14: JSON パース → リトライ実装

低優先（後回し可）:
- R7, R10, R13（v1 後の改善材料）
```

---

# Part 10: ローンチ戦略

## 23. ローンチタイミング（O7 反映: 6 週間）

```
2026-05-18: v1 仕様書完成
2026-05-19: v2 仕様書改訂（本ファイル）
   ↓
Week 1 (5/19-25): AI 機能刷新 + PDF プロトタイプ
Week 2 (5/26-6/1): PDF 本実装 + Stripe 統合
Week 3 (6/2-8):    リニューアル + UX 磨き + 友達評価オプトイン UI
Week 4 (6/9-15):   統合テスト + バグ潰し
Week 5 (6/16-22):  LP + 特商法 + プライバシー + β 試遊
Week 6 (6/23-29):  最終調整 + バッファ
   ↓
2026-06-30: 一発公開 🚀（予備日: 7-2）
```

## 24. ローンチアナウンス計画

### チャネル

```
1. 既存 LINE 公式アカウント
   - リニューアル告知メッセージ
   - 「全く新しいワタシのトリセツ」

2. X (Twitter)
   - 開発者個人アカウントから告知
   - リリース投稿 + デモ動画

3. Instagram
   - ビジュアル中心の告知
   - PDF サンプルのスクショ

4. 知人への直接案内
   - LINE 個別 or DM
   - 「試してみてくれない?」

5. 若年層コミュニティ（B2 反映）
   - 大学サークル / ゼミでの紹介（地域限定なし）
   - 学生団体・自己理解系コミュニティ
   - 性別問わない「自己理解関心層」全般へ
```

### メッセージ案

```
タイトル: 「あなたの真のトリセツが、ここにあります。」

本文:
ワタシのトリセツが、生まれ変わりました。

Big Five 心理学 × 友達からの評価 × AI による統合分析。

¥500 で、あなただけの「本」が手に入ります。
7 章、5,000 字以上の深いレポート。
PDF でダウンロードして、永く読み返せる。

自分のこと、もっと深く知りたいあなたへ。

▼ 試してみる
https://www.watashi-torisetsu.com
```

---

# Part 11: 開発タスク一覧（Claude Code 投入用）

## 25. Phase 別タスクリスト（6 週間版）

### Phase 1: AI 機能刷新 + PDF プロトタイプ（Week 1）

```
☐ T1-1: ai-cost.ts に Opus 4.7 追加
☐ T1-2: ai-prompt-builder.ts 7 章構成プロンプト書き直し
☐ T1-3: anthropic-client.ts max_tokens=16000 + JSON リトライ
☐ T1-4: /api/integrated-trisetsu maxDuration + 新スキーマ対応
☐ T1-5: DB マイグレーション一括（status, pdf_consent, payment_history 等）
☐ T1-6: /integrated/[id] 7 章レンダリング
☐ T1-7: プロンプト品質テスト 5 パターン + 実コスト計測
☐ T1-8: 日本語 PDF フォント先行プロトタイプ（GO/NO-GO 判定）
```

### Phase 2: PDF 本実装 + Stripe（Week 2）

```
☐ T2-1: PDF コンポーネント作成（表紙〜奥付、禁則処理）
☐ T2-2: /api/integrated-trisetsu/[id]/pdf エンドポイント
☐ T2-3: /integrated/[id] ダウンロードボタン
☐ T2-4: Stripe 環境構築
☐ T2-5: /checkout 画面
☐ T2-6: /api/checkout/create-session（perception 改竄防止）
☐ T2-7: /api/webhook/stripe（Idempotency 強化）
☐ T2-8: /api/checkout/status エンドポイント
☐ T2-9: 決済フロー統合テスト（Idempotency 検証込み）
☐ T2-10: Slack アラート設定
```

### Phase 3: リニューアル + UX + オプトイン UI（Week 3）

```
☐ T3-1: DB 完全リセット
☐ T3-2: 購入フロー実装（pdf_consent バッジ表示込み）
☐ T3-3: 友達評価オプトイン UI
☐ T3-4: LINE 通知 Flex 3 つ
☐ T3-5: UX 全体磨き込み
☐ T3-6: 各ページ個別磨き
☐ T3-7: 既存無料版機能整理
```

### Phase 4: 統合テスト + バグ潰し（Week 4）

```
☐ T4-1: フルフロー実機テスト
☐ T4-2: Idempotency 検証
☐ T4-3: 性能計測
☐ T4-4: バグ潰し
☐ T4-5: 監視・運用準備
```

### Phase 5: LP + 法務 + β 試遊（Week 5）

```
☐ T5-1: ローンチページ（LP）作成
☐ T5-2: 特商法表記ページ
☐ T5-3: プライバシーポリシー改訂
☐ T5-4: 利用規約改訂
☐ T5-5: β 試遊（5-10 名）
☐ T5-6: Stripe 本番モード切り替え
```

### Phase 6: 最終調整 + 公開（Week 6）

```
☐ T6-1: β 試遊フィードバック反映
☐ T6-2: ブランド最終調整
☐ T6-3: ローンチアナウンス準備
☐ T6-4: 最終バグ潰し
☐ T6-5: バッファ（予備日）
☐ T6-6: 一発公開 🚀（2026-06-30 or 7-2）
```

---

# Part 12: 設計判断ログ

## 26. 重要な設計判断

### 判断 1: 価格 ¥500 採用

```
論点: ¥500 / ¥980 / ¥1,980
決定: ¥500
根拠: 学生のターゲットを最重視
影響: 単価低い → 数を出す前提、リピート重視
```

### 判断 2: Opus 4.7 採用

```
論点: Haiku 4.5 / Sonnet 4.6 / Opus 4.7
決定: Opus 4.7
根拠: 「最高品質」を実現するため
影響: コスト $0.075/回（売価の 15%）、品質保証
```

### 判断 3: 7 章構成

```
論点: シンプル / 7 章 / 詳細セクション分け
決定: 7 章（本仕様書記載）
根拠: 「本のような PDF」の章立てに最適
影響: 5,000-6,000 字、永続読み返し価値
```

### 判断 4: Payment Element 採用

```
論点: Checkout / Elements / Payment Element
決定: Payment Element
根拠: Stripe 公式推奨、最新 UX
影響: 複数決済手段に自動対応
```

### 判断 5: 即生成 + LINE 通知併用

```
論点: 同期生成 / 非同期 + LINE のみ / 両方
決定: 即生成 + LINE 通知併用
根拠: 待つ人も離脱する人も両方カバー
影響: UX 最大化、復帰率向上
```

### 判断 6: 完全リセット

```
論点: 既存維持 / 部分リセット / 完全リセット
決定: 完全リセット
根拠: 既存 6 名はテストアカウント、しがらみゼロ
影響: クリーンスタート、心理的にも切替
```

### 判断 7: ソフトローンチ停止

```
論点: ソフトローンチ続行 / 停止 / 並行
決定: 停止
根拠: 中途半端な状態で世に出さない
影響: 完成度第一、ブランド第一印象を守る
```

### 判断 8: 6 週間リリース（v2 で修正、O7 反映）

```
論点: 1 ヶ月 / 6 週間 / 2 ヶ月以上
決定: 6 週間（2026-06-30 ローンチ、予備 7-2）
根拠: v1 の 1 ヶ月は過密、Week 5-6 を法務 / β / バッファに割り当て
影響: Week 単位のスコープ管理、Week 5 で法務集中対応
```

### 判断 9: ターゲット再定義「自己理解を求める若年層 γ」（v2 新規、B2 反映）

```
論点: 九大学生限定 / 20-30 代女性 / 自己理解を求める若年層
決定: γ「自己理解を求める若年層」（性別・地域問わず、10 代後半〜20 代）
根拠: 九大限定は SNS 流通の限界、20-30 代女性は既存ブランド資産の前提だがプレミアム化で恋愛フレームを外す方向に
影響: brand-context.md と 4 SNS planner エージェントの改訂が必要（§ 35 参照）
```

### 判断 10: 友達評価 PDF 利用オプトイン制（v2 新規、B3 反映）

```
論点: そのまま PDF 化 / オプトアウト / オプトイン
決定: 案 C オプトイン（friend_perceptions.pdf_consent デフォルト false）
根拠: PDF の永続性・配布可能性に対する第三者プライバシー保護
影響: 統合素材選択 UI に同意状態の表示、招待文言と PP の明示、オプトイン率が低いリスク（R11）
```

### 判断 11: MVP は手動返金、自動化は Phase 2（v2 新規、O5 反映）

```
論点: 自動返金実装 / 手動返金で MVP
決定: MVP は手動返金 + Slack アラート、Phase 2 で自動化
根拠: 想定発生頻度が低く、自動化のリスクが手動より高い段階
影響: 失敗時 LINE 文言は「サポートに連絡してください」、運用工数あり
```

### 判断 12: 実装リポジトリ分離（v2 新規、B1 反映）

```
論点: 単一リポジトリ / 戦略 + 実装の分離
決定: 戦略は watashi-no-torisetsu-sns、実装は watashi-no-torisetsu
根拠: SNS 戦略エージェントと実装コードの責務分離
影響: PREMIUM_PLAN.md を両リポジトリに同期コピー
```

---

# Part 13: 最終チェックリスト

## 27. ローンチ前必須項目

### コード
- [ ] AI 機能 Opus 4.7 で動作確認（実コスト計測完了）
- [ ] JSON パース失敗時のリトライ動作確認
- [ ] PDF 生成成功（全 7 章 + 表紙 + 奥付）
- [ ] PDF フォント Vercel Production 動作確認（T1-8 GO 判定）
- [ ] Stripe 決済フロー（本番モード）
- [ ] Idempotency 検証（同 session 二重 webhook で二重生成しない）
- [ ] LINE 通知 3 種類（受領 / 完成 / 失敗）
- [ ] /checkout/processing の Polling 動作 + 3 分タイムアウト → LINE 待ち遷移
- [ ] 友達評価オプトイン UI 動作
- [ ] payment_history + integrated_trisetsu.status 正常記録
- [ ] Slack アラート受信確認
- [ ] 整合性スクリプト動作確認

### データ
- [ ] DB 完全リセット完了（既存 6 名へ事前 DM 済み）
- [ ] payment_history テーブル作成
- [ ] integrated_trisetsu.generated_chapters カラム追加
- [ ] integrated_trisetsu.status / failure_reason / retry_count 追加
- [ ] integrated_trisetsu.payment_id カラム追加（UNIQUE 部分制約）
- [ ] friend_perceptions.pdf_consent / pdf_consent_at 追加

### 環境変数（Vercel）
- [ ] ANTHROPIC_API_KEY（既存）
- [ ] STRIPE_SECRET_KEY（本番）
- [ ] STRIPE_PUBLISHABLE_KEY（本番）
- [ ] STRIPE_WEBHOOK_SECRET（本番）
- [ ] SLACK_WEBHOOK_URL（または LINE 開発者通知用）

### Stripe ダッシュボード
- [ ] Product「ワタシのトリセツ AI 統合」
- [ ] Price ¥500 JPY one_time
- [ ] Webhook 本番 URL 設定
- [ ] テスト決済 1 回成功確認

### 法務（Week 5 完了必須、§ 31 参照）
- [ ] 特商法表記ページ公開
- [ ] プライバシーポリシー公開（PDF 利用・第三者提供を明記）
- [ ] 利用規約公開（有料サービス条件、禁止事項）
- [ ] 返金ポリシー明文化（生成完了後は返金不可、失敗時は手動返金）
- [ ] お問い合わせ窓口設置（公式 LINE トーク）

### ブランド
- [ ] リッチメニュー画像新版
- [ ] 公式アカウント紹介文更新
- [ ] LIFF アプリ情報更新
- [ ] brand-context.md と SNS planner エージェントを γ ターゲットに改訂（§ 35 参照）

### β 試遊（Week 5 完了必須）
- [ ] 5-10 名に試遊依頼
- [ ] PDF と Web 結果両方のフィードバック収集
- [ ] デザイントーンが γ 層に合うか確認

### ローンチ
- [ ] ローンチページ完成
- [ ] アナウンス文言準備
- [ ] SNS 投稿準備
- [ ] 知人案内リスト準備

---

## 28. ローンチ後モニタリング

### 日次チェック

```sql
-- 売上
SELECT 
  DATE(paid_at) as date,
  COUNT(*) as count,
  SUM(amount_jpy) as revenue_jpy
FROM payment_history
WHERE status = 'completed'
GROUP BY DATE(paid_at)
ORDER BY date DESC
LIMIT 7;

-- AI コスト
SELECT
  DATE(generated_at) as date,
  COUNT(*) as count,
  SUM(ai_cost_usd) as cost_usd,
  AVG(ai_cost_usd) as avg_cost_usd
FROM integrated_trisetsu
GROUP BY DATE(generated_at)
ORDER BY date DESC
LIMIT 7;

-- 利益率
SELECT
  SUM(ph.amount_jpy) - SUM(it.ai_cost_usd * 150) as profit_jpy
FROM payment_history ph
JOIN integrated_trisetsu it ON it.payment_id = ph.id
WHERE ph.status = 'completed'
  AND ph.paid_at > NOW() - INTERVAL '7 days';

-- エラー監視
SELECT * FROM line_messages_sent
WHERE send_result != 'success'
  AND sent_at > NOW() - INTERVAL '24 hours';
```

### Admin Dashboard 拡張

```
既存 /api/admin/dashboard に追加:
- payment_history 集計
- 利益率
- リピート購入率
- PDF ダウンロード率
```

---

# Part 14: まとめ

## 29. このプレミアム化計画の意義

### Before（Phase 3-β 完成版）
```
ワタシのトリセツ = 「無料の楽しい診断」
ターゲット = Z 世代
価値 = バイラル、軽い自己発見
```

### After（プレミアム版）
```
ワタシのトリセツ プレミアム版 = 「本気の自己理解ツール」
ターゲット = Z 世代（深さを求める人）
価値 = 永続的な「自分の本」、人生の指針書
```

### 戦略的意味

```
1. 持続可能なビジネスモデル確立
2. AI 機能の最高品質化
3. 競合（MBTI / 16P）との明確な差別化
4. 「九大発の本格派サービス」ブランド
5. 学生でも払える価格設計（¥500）
6. 友達評価無料維持でバイラル力保持
```

### この計画の核心

```
「軽い楽しさ」と「本気の深さ」の両立

¥500 という庶民的価格 × 5,000 字の本格レポート
Z 世代トーン × Opus 4.7 の最高 AI
バイラル機能無料 × コア機能有料

= ユニークなポジショニング
```

---

## 30. 開発開始時の最初の一歩

Claude Code への投入プロンプト（テンプレ、v2 反映）:

```
ワタシのトリセツのプレミアム化計画書を読んでほしい。

ファイル: docs/PREMIUM_PLAN.md
リポジトリ: compass260307-coder/watashi-no-torisetsu（実装本体）

ステップ:
1. 計画書全体を読み込んで理解（特に v2 で追加された B1-B3 / O1-O5 / O7 の判断）
2. Phase 1（Week 1）の AI 機能刷新 + PDF プロトタイプのタスクを確認
3. 不明点・懸念点があれば質問
4. 私の OK 後に T1-1 から着手

要件:
- 計画書の仕様通りに実装
- 既存コードを破壊しない（流用すべき部分を尊重）
- DB マイグレーションは Week 1 で一括（リセット自体は Week 3）
- 動作確認は段階的に
- 実コスト計測は T1-7 で必ず行う
- PDF フォントは T1-8 で先行検証、GO/NO-GO 判定

最初に着手するタスク: T1-1（ai-cost.ts に Opus 4.7 追加）

OK なら GO サインください。
```

---

# Part 15: 法務・ポリシー（v2 新規）

Week 5 で集中対応する法務 3 点セット + 返金ポリシー + 同意フロー。

## 31. 特商法表記（必須）

有料サービスを継続的に販売する以上、特定商取引法に基づく表記は **公開必須**。LP のフッターと `/legal/commerce` 等の固定ページに掲載する。

### 必須記載項目

```
販売事業者:        （個人事業主 or 屋号）
運営責任者:        （氏名）
所在地:           （請求時開示可、または住所）
連絡先:           （メールアドレス、公式 LINE）
販売価格:         AI 統合トリセツ ¥500（税込、1 回分）
お支払方法:        クレジットカード（Stripe 経由、Visa / MasterCard / Amex / JCB）
                  Apple Pay / Google Pay（Stripe Payment Element 対応分）
商品の提供方法:    決済完了後、AI 統合トリセツを生成し、Web 画面 + PDF で提供
商品の提供時期:    決済完了後、通常 30-90 秒以内に生成完了（最大 3 分）
返品・キャンセル:   § 32 参照
```

### 注意点

- **住所**: 個人事業主の場合、自宅住所を出すか「請求時に遅滞なく開示」と書くか選べる。後者なら「メール / LINE で請求があった場合 7 日以内に開示」を明記
- **連絡先メール**: 専用のドメインメール推奨（Gmail でも法的には可だが信頼性は下がる）
- **改訂日**: 「最終改訂日: 2026-XX-XX」を明記、ポリシー変更時は必ず更新

## 32. 返金ポリシー

### 基本方針: **AI 生成完了後は返金不可、生成失敗時のみ手動返金**

```
返金対象:
✅ 決済成功後、AI 生成が失敗した場合（status='failed' 確定）
✅ 決済成功後、システム側障害で永続的に PDF / Web 結果が表示できない場合
❌ 生成完了後の「期待と違った」「内容に満足できない」（クリエイティブ系商品のため対象外）
❌ 友達評価素材が想定より少なかった場合（事前に画面で確認可能のため）
❌ ユーザー操作ミスでの誤購入（決済前画面で内容確認の機会あり）
```

### 返金フロー（MVP: 手動）

```
1. ユーザーから LINE トークでサポート連絡
   ↓
2. 運営が integrated_trisetsu.status / payment_history を確認
   ↓
3. 返金対象と判断 → Stripe ダッシュボードから手動 refund
   ↓
4. payment_history.refunded_at + status='refunded' を更新
   ↓
5. ユーザーに LINE で完了報告
```

### Phase 2 で自動化する条件

- 月あたり手動返金件数が **10 件を超える** → 自動化検討
- それまでは手動運用 + ログ収集

### 利用規約に書く文言（雛形）

```
第 X 条（返金）
1. 本サービスの AI 統合トリセツは、生成完了後は商品の性質上、
   返金対象外とします。
2. ただし、以下の場合に限り、生成日から 7 日以内に申請があれば
   返金対応いたします:
   (1) システム障害により AI 生成が完了しなかった場合
   (2) 当社の責任により Web 結果 / PDF が永続的に閲覧できない場合
3. 返金申請は公式 LINE トークまたは表記の連絡先メールにて受け付けます。
4. 返金は決済時の Stripe 経由で原則 7 営業日以内に処理されます。
```

## 33. プライバシーポリシー（友達評価対応の改訂）

既存 PP が無い場合は新規作成、ある場合は以下の項目を **必ず追加**:

### 追加必須項目

```
1. 友達評価データの取扱い
   - 友達が回答する 30 問の Big Five 評価は、回答者の同意を得て収集します
   - 友達が「PDF 利用同意（オプトイン）」した場合のみ、有料統合トリセツの
     素材として使用し、PDF に「○○さん」の表記で記録されます
   - 同意していない場合、相手の Web 画面でのみ閲覧可能となります

2. 第三者提供
   - 決済処理のため Stripe Inc. に必要最小限の情報を提供
   - AI 生成のため Anthropic, PBC に診断データを提供（個人特定情報は含めない）
   - その他、法令に基づく開示請求を除き、第三者に提供しません

3. データ保持と削除
   - アカウント削除時、ユーザー個人データは 7 日以内に削除
   - friend_perceptions も連動削除（送った側 / 受けた側どちらの削除でも）
   - integrated_trisetsu の PDF は Supabase Storage から削除
   - 法令に基づく保持義務がある決済記録は別途保持

4. お問い合わせ
   - 公式 LINE トーク、または特商法表記のメールアドレス
```

## 34. 友達同意フローの実装詳細

### UI 配置

```
/friend/[inviteCode] フロー:

ステップ 1: 30 問回答
ステップ 2: おまけ質問（任意）
ステップ 3: [新規] PDF 利用同意確認
    ─────────────────────────────────────
    あなたの回答について、
    ${ownerName}さんが有料の
    「統合トリセツ PDF」を作成した場合に、
    あなたの名前（${perceiverName}）と
    回答内容が PDF に記載されます。

    PDF は ${ownerName}さんが第三者に
    共有する可能性があります。

    [ ] はい、PDF 利用に同意します
        ※ チェックしない場合も、
          ${ownerName}さんは「あなたから見た自分」を
          Web で閲覧できます。
          PDF 化と AI 統合素材化のみ
          できなくなります。

    [送信する]
ステップ 4: 完了画面
    ─────────────────────────────────────
    「同意状態: PDF 利用 ◯ / ✕」を表示
    変更したい場合の問い合わせ案内
```

### バックエンド

```sql
-- 評価送信時
INSERT INTO friend_perceptions (
  target_user_id,
  perceiver_name,
  perceived_full_code,
  ...,
  pdf_consent,
  pdf_consent_at
) VALUES (
  ...,
  $pdf_consent,            -- チェック状態
  CASE WHEN $pdf_consent THEN NOW() ELSE NULL END
);
```

### オーナー側の見え方

```
/zukan-mine の statistics に追加:
  友達評価: 5 件
  ├ PDF 利用可能: 3 件
  └ Web 閲覧のみ: 2 件
    ※ 統合 PDF に使うには、相手にもう一度
      同意をお願いする必要があります

/integrated/new の素材選択:
  ☑ [PDF 可] 田中さん から (実家系)
  ☑ [PDF 可] 佐藤さん から (繊細系)
  ☐ [Web のみ] 山田さん から (※ PDF 利用には再同意が必要)
```

### Phase 2 検討事項

- 「○○さんに再同意を依頼する」ボタン → LINE メッセージで同意取得 UI に誘導
- イニシャル化オプション（「友人 A」表記でハードル下げ）
- 同意取消フロー（送信後でも取り下げ可能に）

---

# Part 16: ブランドコンテキスト改訂判定（v2 新規）

## 35. brand-context.md と SNS planner エージェントへの影響

B2 で「ターゲットを γ = 自己理解を求める若年層」に再定義した結果、SNS 戦略リポジトリの既存ドキュメントとの整合性を取る必要がある。

### 判定: **改訂必要**

`docs/sns-strategy/brand-context.md` は **改訂必須**。具体的な変更箇所:

| 既存記述 | 改訂方針 |
|---|---|
| ターゲット「20-30 代女性（恋愛・自己理解関心層）」 | **「自己理解を求める若年層 γ」（10 代後半〜20 代、性別不問、SNS ネイティブ）** |
| 「自分の取扱説明書を作って恋愛・人間関係で活用」 | **「自分の取扱説明書を作って自己理解 / 人間関係に活用」**（恋愛フレームを後退、自己理解を前面） |
| マスコット「ペンギンキャラ」 | **継続**（SNS で使う共通アイコン、PDF とのギャップは「ブランドの二面性」として演出） |
| カラー「パステルカラー基調」 | **SNS は継続、PDF は別系統（ディープネイビー + ゴールド）** という二系統を明記 |
| トーン「ゆるく親しみやすく、重くなりすぎない」 | **継続 + 「本格派の深さも持つ」を追記**（プレミアム版の二面性を明文化） |
| 既存資産「マスコット、LINE Bot スクショ、診断結果サンプル」 | **PDF サンプル画像を追加**（プレミアム版の新資産） |

### 4 つの SNS planner エージェントへの影響

`.claude/agents/` 配下の以下 4 エージェントは、brand-context.md を Stage 1 で参照するため、改訂時に挙動が変わる:

| エージェント | 影響度 | 改訂後の確認事項 |
|---|---|---|
| `sns-strategist` | **大** | 戦略全体の前提が変わる、コンテンツ柱の再設計が必要かも |
| `tiktok-planner` | 中 | ターゲット層に合わせた撮影トーン / 音源選定の指針調整 |
| `x-planner` | 中 | スレッド構成・ハッシュタグ戦略の見直し |
| `instagram-planner` | 中 | ビジュアル方針（パステル維持 vs PDF トーン併用）の整理 |

### 推奨アクション

```
1. Week 1 のうちに brand-context.md を改訂
2. 各 planner エージェントの spec を一度走らせて、想定外の挙動が出ないか確認
3. 必要なら .claude/agents/tests/ にテスト追加（既存運用ノートに従う）
4. プレミアム版ローンチ時の SNS 投稿は、新ブランドコンテキスト準拠で生成
```

### 「ブランドの二面性」運用の整理

SNS（拡散・認知）と PDF（プレミアム購入後）でトーンが異なるのは、**意図的な戦略**として整理:

```
SNS（フロー、拡散用）:
- マスコット: ペンギン
- カラー: パステル
- トーン: ゆるい、親しみやすい
- 役割: 認知と LINE 友達追加への誘導

PDF / 結果画面（ストック、プレミアム購入後）:
- 装飾: 書籍的、章立て、上品なタイポグラフィ
- カラー: ディープネイビー + ゴールド（要再評価、§ 7）
- トーン: 親しみやすさを残しつつ深さ・本格派
- 役割: 永続的な「自分の本」、リピート購入の動機
```

この二面性を SNS 投稿で **明示的に演出**できれば、γ 層に「軽さと深さの両方がある」という独自ポジションを刷り込める。

---

**End of ワタシのトリセツ プレミアム化計画書 v2**

改訂日: 2026-05-19
改訂者: Claude + 戦略決定者
次の改訂タイミング: Week 1 終了時（T1-7 実コスト計測結果 + T1-8 PDF プロトタイプ判定を反映）
