# Notion開発同期 (notion-dev-sync)

PRの動きをNotionの開発管理ページへ自動反映する仕組み。実体は `.github/workflows/notion-dev-sync.yml`。

## 何が自動で起きるか

| GitHubでの出来事 | Notionでの反映 |
| --- | --- |
| PRをオープン / 再オープン / Ready for review | 「開発タスク」DBで `PR・ブランチ` がそのPR URLと一致する行を **レビュー・検証** に変更 |
| PRをマージ | 一致するタスク行を **完了** に変更 + 「開発履歴」DBに1行追加(タイトル・PR番号・マージ日・作者・ブランチ) |
| PRをマージせずクローズ | 何もしない(タスクの「見送り」は手動で判断) |

- タスク行の `PR・ブランチ` にPRのURLを貼っておくことが唯一の紐付け条件。貼っていないPRでも開発履歴には残る。
- 開発履歴は同じPR番号を二重登録しない。
- Notion API障害やトークン未設定ではワークフローは warning を出して成功終了する(PRをブロックしない)。

## 対象のNotion

- ページ: 「ワタシのトリセツ 開発」(独立ページ)
- 開発タスクDB: `dec08d23f6cf49eab08db889e02ffc40`
- 開発履歴DB: `386f59472bbd4b8db85f06b3fd96cef9`

DBを作り直した場合はワークフロー冒頭の `TASKS_DB` / `HISTORY_DB` を更新する。

## セットアップ(初回のみ・管理者)

1. https://www.notion.so/profile/integrations で内部インテグレーションを作成(名前例: `watashi-dev-sync`、権限: コンテンツの読み取り・挿入・更新)。シークレット(`ntn_...`)を控える。
2. Notionの「ワタシのトリセツ 開発」ページ右上 `…` → 「接続」→ 作成したインテグレーションを追加(子DBにも権限が及ぶ)。
3. リポジトリにシークレットを登録(値は対話入力なのでログに残らない):
   ```bash
   gh secret set NOTION_TOKEN -R compass260307-coder/watashi-no-torisetsu
   ```

## 動作確認

PRを1つオープン → Actionsの `Notion Dev Sync` 実行ログに `Updated ... task row(s)` が出ること、マージ後に開発履歴へ行が増えることを確認する。

## 秘密情報の扱い

- トークンはGitHub Secretsのみに置く。チャット・コミット・`.env.local` に書かない。
- トークンを漏らした場合はNotion側でインテグレーションのシークレットを再発行し、`gh secret set` で上書きする。
