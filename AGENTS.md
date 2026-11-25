<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Workspace and release guardrails

- Each team member works in their own clone or worktree of `compass260307-coder/watashi-no-torisetsu`, on a task branch. Before work, verify `pwd`, `git rev-parse --show-toplevel`, and `git remote get-url origin`. The existing Mac mini checkout remains valid; the external SSD (`WATASHI-SSD`) and `~/Documents/WATASHI_BACKUPS` (30-day retention) are backup-only. Old Desktop copies were removed on 2026-11-13. See `docs/TEAM_DEVELOPMENT.md` for onboarding.
- Allow only one writing task per checkout at a time. Parallel tasks use separate clones/worktrees and branches, with separate dev-server ports. Coordinate Git metadata operations when worktrees share one Git repository; do not overlap dependency updates or builds in the same checkout.
- Product lineup, prices, billing types, and trial periods are frozen at the 2026-09-13 catalog in [`docs/COMMERCE_CATALOG.md`](docs/COMMERCE_CATALOG.md). Do not add or remove plans, change prices, run price promotions or price A/B tests, or alter included entitlements unless the user explicitly authorizes that business decision. Copy, funnel, design, and reliability improvements may proceed only when they preserve the frozen catalog.
- The Japanese Web `full_access` offer is fixed at a JPY 499 checkout price effective 2026-09-21 10:02 JST, shown against a JPY 1,299 reference price with a JPY 800 release coupon since 2026-11-18. The only exception is the user-authorized price test from 2026-11-22 (`ja_full_access_price_test_699_v1_20261122`: from 2026-11-22 14:30 JST, half of newly diagnosed JPY buyers see JPY 1,499 − 800 = 699; it was scheduled to end at 2026-11-26 0:00 JST and was closed a few hours early on the evening of 2026-11-25; see the catalog). By the user's 2026-11-25 decision, from that point every JPY buyer is billed JPY 699 (JPY 1,499 − 800); setting `FULL_ACCESS_JA_PRICE=499` restores JPY 499. A second user-authorized price test (`ja_full_access_price_test_899_v1_20261126`) runs from 2026-11-26 0:00 JST to 2026-11-29 0:00 JST: half of newly diagnosed JPY buyers see JPY 1,699 − 800 = 899, and everyone returns to JPY 699 when it ends. Run `npm run verify:commerce`; production builds enforce this contract.
- Preserve all pre-existing tracked and untracked changes. Never use `git add -A`; stage explicit paths or selected hunks, keep commits scoped by feature, and check `git status` plus `git diff --cached --check` before committing. Push only with explicit user authorization; a non-`main` push can start a Vercel Preview deployment.
- Before code changes, read this file and the relevant local documentation for the installed Next.js version. Normally run ESLint, TypeScript, and a production build; use an isolated parent-HEAD-plus-target-diff build for large commits, with dedicated checks for images, PDFs, and migrations.
- Do not commit local outputs or secrets, including `.codex_tmp/`, `supabase/.temp/`, `node_modules/`, `.next/`, `.env.local`, API keys, or tokens. Never expose secret values in chat, logs, or screenshots, and never place secrets in `NEXT_PUBLIC_*`.
- Supabase migrations must use unique `YYYYMMDDHHMMSS_name.sql` names. Check applied history and remote schema before changes; never run `db push` or `migration repair` without explicit authorization.
- Do not push, apply database changes, send to external services, deploy, promote, or alter Vercel configuration unless explicitly authorized. Follow [`docs/WORKSPACE_RELEASE_POLICY.md`](docs/WORKSPACE_RELEASE_POLICY.md) for the complete policy.

## Team development

- Read `docs/TEAM_DEVELOPMENT.md` before onboarding or changing shared setup. Use Node from `.nvmrc` and `npm ci`; do not regenerate dependencies with another package manager.
- Use `npm run dev:team` for routine local development and `npm run dev:check -- --checkout` before testing payments. This checks local configuration only; it does not verify remote keys, schema, or account access.
- Shared project decisions belong in repository docs and the task Issue/PR. Development tasks are tracked in the Notion dev task database; merged PRs are auto-recorded there via GitHub Actions (see `docs/NOTION_DEV_SYNC.md`). Record the branch, changed areas, checks, and remaining work when handing off between people or AI tools. Do not include credentials, customer data, or capability URLs.

# ワタシのトリセツ 開発ルール

## 参照する正本

- 事業判断(戦略・優先順位・チャネル方針): **本人の明示指示と、Notion「情報プラットフォーム」の意思決定を正とする。** `docs/BUSINESS_CONSTITUTION.md` は2026-11-14に失効しており、事業方針の根拠として参照しない。
- 固定中の商品・価格: `docs/COMMERCE_CATALOG.md`(引き続き有効。CIで機械的に強制)
- 実装上の商品、価格、権利範囲: `src/lib/access-products.ts`、`src/lib/line-plus-products.ts`
- Workspace・リリース安全規則: `AGENTS.md`、`docs/WORKSPACE_RELEASE_POLICY.md`
- `docs/product_spec.md` と `docs/service-overview.md` は初期MVPの履歴資料であり、現行仕様として使用しない。

## 意思決定の進め方

- 施策・機能・投資の優先順位は固定の基準で評価せず、本人が都度判断する。AIは提案時に、期待効果とリスクをデータで示す。
- 事業上の決定はNotionの意思決定DBに記録する。リポジトリには技術・安全・表記のルールだけを置く。

## 現行プロダクトの前提(実装の事実)

- Web自己診断は50問。
- 友達診断は1人の30問回答で結果表示の土台が完成する。
- 日本版Webの新規販売は、原則として買い切りの完全版。価格は2026-11-25夜から¥699（それまでは¥499と、価格テストの¥699）。2026-11-26 0:00〜11-29 0:00 JSTは、¥699と¥899の価格テスト。
- 日本の継続課金商品は、現状Alice Plus(LINE)のみ。
- Aliceモバイルアプリ(apps/alice)は技術資産として保持する。
- 実装と表示が食い違う場合は、推測せず現在の共通定義、権利判定、Checkout実装を確認する。

## 商品・価格の固定

- 商品、価格、課金形態、trial期間は2026-09-13時点の現行バージョンで固定する。
- 値引き、期間限定セール、価格A/Bテスト、コース追加・削除を実装しない。
- コピー、導線、デザインは、商品内容と価格を変えない範囲で改善してよい。
- ユーザーが商品・価格の変更を明示した場合だけ、`docs/COMMERCE_CATALOG.md`、共通定義、計測バージョンを一緒に更新する。

## 技術スタック

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Vercel
- GitHub

## UIトーン

- モバイルファースト
- ポップな取扱説明書風
- 温かいオフホワイト + タイプ別カラー
- ラベル、スタンプ、注意書き、チェックリスト、ゆるい警告アイコン
- ネガティブ表現は「愛されるクセ」に変換する
- 友達に送っても恥ずかしくない軽さを優先する

## 表記ルール(2026-11-14確定)

- 日本語のサービス名は「ワタシのトリセツ」のみ。「OCEAN診断」「ビッグファイブ診断」を診断名・サービス名として名乗らない(ビッグファイブ理論への言及は可)。
- 「Alice」はAIキャラクター名および「Alice Plus」(LINEのプロダクト名)としてのみ使う。カタカナ「アリス」は使わない。
- ページタイトルの接尾辞はルートレイアウトの `title.template`(「〜｜ワタシのトリセツ」)に委譲し、ページ側でハードコードしない。
- 韓国語のサービス名は商標の「앨리스 진단」に統一する(2026-11-17決定)。「나의 사용설명서」はサービス名として使わない(「나만의 사용설명서」のように、本人の取扱説明書という中身を指す表現は可)。英語・インドネシア語「Alice Personalities」は各ロケールの独自ブランドとして維持する。
- 結果画面・PDFのタイプコード(OCEAn等)はプロダクト要素として維持する。
- 日本語文中の三点リーダーは「...」(半角ピリオド3つ)に統一する(2026-11-15決定)。名前やチャットの切り詰め表示に使う1文字の「…」だけは例外として維持。他言語の文言は各ロケールの慣習に従う。
- 「分かる」は漢字表記に統一する(わかる・わかり等のひらがな表記を使わない)。LINE公式用語の「友だち追加」等を除き、「友達」表記を使う。

## 実装ルール

- まず既存コードを確認してから変更する
- 仕様を勝手に広げず、現行実装と本人の指示を確認する
- 1回の変更は1機能単位にする
- モバイルファーストで実装する
- エラー表示、ローディング表示、空状態を用意する
- TypeScriptの型を崩さない
- 自由記述や友達回答は、本人を傷つける形で表示しない
- アプリの新規開発、RevenueCat接続、ストア申請は、本人の明示承認なしに進めない

## KPIイベント

最低限、以下のファネルを同じコホート定義で計測できるようにする。

- diagnosis_started
- diagnosis_completed
- friend_invite_clicked
- friend_answer_completed
- share_clicked
- paywall_viewed
- purchase_cta_clicked
- checkout_session_created
- purchase_completed

Alice Plusでは、Checkout表示、trial開始、加入、継続、解約、MRRを追跡する。国、流入元、商品、ペイウォールバージョンを混ぜずに比較する。

## エージェント追加ルール

Claude Codeは、必要だと判断した場合のみ .claude/agents/ にプロジェクト専用エージェントを追加してよい。

ただし、最初から大量に作成しないこと。原則1〜3体までに抑えること。

新しいエージェントを作る場合は、以下を明記すること。

- 役割
- 使用タイミング
- 作成理由
- CLAUDE.mdとの違い
