# Mac向けチーム開発手順

対象は `compass260307-coder/watashi-no-torisetsu` のWeb版です。各自のMacでCodexまたはClaude Codeを使い、変更をGitHubのPRでまとめます。

## 1. 最初にそろえるもの

| 項目 | メンバーの準備 | 管理者の準備 |
| --- | --- | --- |
| GitHub | 各自のアカウントを作り、プロフィールのユーザー名を伝える | write権限が必要なメンバーを招待する |
| Codex / Claude Code | 各自のアカウントでログインする。両方の導入は任意 | 共通ルールをこのリポジトリで維持する |
| Node.js / npm | `.nvmrc`のNode 24.14.0、npm 11系を用意する | バージョン変更はlockfile・CIとまとめて検証する |
| Git / GitHub CLI | `git --version` と `gh --version` が動くことを確認する | GitHubのレビュー担当を決める |
| 開発用DB | 管理者から開発専用キーを安全な共有手段で受け取る | `watashi-dev` の接続先・キー・schemaを確認する |
| Stripeなど | 担当機能のテストに必要になってから設定する | テスト環境のアクセス権・キー・費用上限を管理する |

GitHubユーザー名がまだ不明でも、手順書と環境の準備は進められます。アカウントのパスワードや個人トークンを共有しません。GitHubへの接続は各自で `gh auth login` を実行し、ブラウザで認証します。

## 2. 自分専用のコードを取得

新しいフォルダに取得します。すでに同名フォルダがあれば、上書きせず内容を確認してください。

```bash
mkdir -p ~/Developer
cd ~/Developer
gh repo clone compass260307-coder/watashi-no-torisetsu
cd watashi-no-torisetsu
pwd
git rev-parse --show-toplevel
git remote get-url origin
git status --short --branch
```

現在の共有設定がまだPR段階なら、管理者が伝えるブランチを取得してください。`main`への反映前に、この手順が`main`で使えるとは限りません。

nvmを使っている場合はリポジトリ内で `nvm install`、`nvm use` を実行します。それ以外のバージョン管理ツールでも `.nvmrc` のバージョンを指定します。

```bash
node --version
npm --version
npm ci
```

Nodeは24.14.0、npmは11系を基準にします。初回の型チェックは `npm run typecheck` を使い、Next.jsの型定義を生成してからTypeScriptを実行します。既存の依存関係を変えずにインストールするため `npm ci` を使います。yarn/pnpm/bunのlockfileを追加しません。

## 3. 開発用設定を入れる

```bash
# 初回のみ。既存ファイルは上書きしない。
cp -n .env.example .env.local
chmod 600 .env.local
```

エディタで `.env.local` を開き、[環境変数一覧](TEAM_ENVIRONMENT.md)に従って管理者から受け取った開発用Supabaseキーを入力します。値をチャット、Issue、PR、スクリーンショットに貼りません。Productionの環境ファイルをコピーしません。

```bash
npm run dev:check
npm run dev:team
```

[http://127.0.0.1:3000](http://127.0.0.1:3000)を開きます。停止はターミナルで `Ctrl+C` です。別ポートを使う場合は、`NEXT_PUBLIC_SITE_URL`も同じポートに変更し、`npm run dev:team -- --port 3001` のように起動します。

`dev:check`はNext.jsと同じ優先順位で環境ファイルとシェルの設定を確認します。開発用DB、Supabaseキーの形式・JWTに含まれる接続先、Stripeのテストモード、計測停止、ローカルURLを確認します。ネットワークには接続しません。JWTの署名、有効期限、実際の権限、DBのschemaやPrice IDの内容まで保証するものではありません。

## 4. Codex / Claude Codeで作業

両ツールとも取得したリポジトリを作業フォルダとして開きます。CLIを使う場合は、そのフォルダで `codex` または `claude` を起動します。

- 共通ルールは `AGENTS.md`。`CLAUDE.md`は`@AGENTS.md`を読み込みます。
- 起動後に「このリポジトリの共通ルールと実行する確認コマンドを要約して」と伝え、正しいフォルダ・ルールを参照していることを確認します。
- 各ツールのログイン、個人メモ、MCP認証は各自で設定します。片方のチャット履歴がもう片方へ自動同期される前提にしません。
- `.claude/settings.local.json`などの個人設定はGitへ入れません。
- 共通の技術判断・仕様は`docs/`、進捗はIssue/PRへ残します。

AIへの最初の依頼例：

> AGENTS.mdと関連仕様を読み、Issueの完了条件に沿って作業してください。最初にブランチと既存差分、開発環境を確認してください。作業後は変更内容、検証結果、未完了事項を報告してください。

## 5. 日々の開発とレビュー

1. Issueに目的・担当・完了条件を記録する。テンプレートを使う。
2. 作業ツリーが空であることを確認して`main`を更新し、作業ブランチを作る。
3. 変更を実装し、関連するチェックと画面確認を行う。
4. 対象ファイルだけをステージし、差分を確認してコミットする。
5. pushの許可を得てからpushし、PRテンプレートに結果と確認方法を書く。
6. レビューと検証環境での確認後、リリース担当が既存の承認手順に従って反映する。

```bash
git status --short --branch
git switch main
git pull --ff-only
git switch -c feat/short-task-name
# 実装後。checkは変更内容に応じて追加する。
npm run verify:team
npm run verify:commerce
npm run lint
npm run typecheck
npm run build
git diff --check
# git add の対象は自分が変更したファイル名を明示する
git diff --cached --check
```

途中の変更があれば、上記のブランチ切り替え前に保存方法を判断します。他人の差分を破棄しません。pushはVercel Previewを開始する可能性があるため、[リリース方針](WORKSPACE_RELEASE_POLICY.md)の承認条件を維持します。

各自のcloneで並行作業できます。同じMacでCodexとClaude Codeを同時に編集させる場合は別worktreeを使います。

```bash
# 既存ブランチ名・フォルダ名と重複しない名前を選ぶ
git worktree add ../watashi-task-b -b feat/task-b
```

新しいworktreeでも`npm ci`と開発専用の環境設定が必要です。`.env.local`や`node_modules`は自動共有されません。開発サーバーのポートを分けてください。

## 6. 引き継ぎに残す内容

Issue/PRへ以下を残します。公開リポジトリのため、顧客情報・秘密値・本人専用の結果URLは書きません。

```text
目的 / 完了条件:
担当 / 作業ブランチ / 最後のコミット:
変更した箇所:
確認したこと / 未実施の確認:
決定した仕様と関連文書:
残っていること / 次の作業:
DB変更・外部送信・push・デプロイの有無:
```

## 7. 初回の動作確認

管理者が開発DBのschemaとテスト設定を確認した後、架空のユーザー・回答だけで実施します。

- トップ・自己診断・結果プレビューが表示できる。
- 開発DBへ自己診断を保存できる。
- 友達招待URLが開発用の接続先を指し、友達回答が保存できる。
- [ローカルメール認証デモ](LOGIN_CODE_LOCAL.md)が動く。これは実アカウントのログイン検証とは別。
- 決済担当は`npm run dev:check -- --checkout`を通し、Stripeテスト決済→Webhook→権利反映を確認する。
- AI生成、LINE、Googleログイン、PDFなどは、担当機能ごとに必要な設定を追加して確認する。

共通の確認用URLは環境担当が指定します。現在の`resolveSiteUrl()`は`vercel.app`を本番ドメインへ変換するため、Preview上の共有リンクを未確認のまま他の人へ送らないでください。環境変数を設定しただけではこの挙動は変わりません。詳しくは[検証環境の準備](TEAM_ENVIRONMENT.md)を参照してください。
