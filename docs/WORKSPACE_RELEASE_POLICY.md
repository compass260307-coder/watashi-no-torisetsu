# Workspace Backup and Release Policy

この文書は、SSD移行後の正式な作業環境、Git整理、バックアップ、DB migration、Vercelリリースに関する運用ルールの正本です。事故を避け、変更を機能単位で検証・復元できる状態に保つことを目的とします。

## 1. 正式な作業環境

- 正式な作業パスは `/Volumes/WATASHI-SSD/WATASHI_WORKSPACE/projects/watashi-no-torisetsu` です。
- 旧Desktop版はバックアップ専用です。参照はできますが、編集やGit操作の対象にしません。
- 作業開始時に `pwd` と `git rev-parse --show-toplevel` を実行し、両方が正式パスを示すことを確認します。
- SSD名やフォルダ構成を、合意なく変更しません。スクリプトや設定に固定パスがある可能性を考慮します。
- コマンド、ビルド、Git操作、ファイル生成が動作中の間はSSDを取り外しません。

## 2. 同時作業

- 同じリポジトリでは、原則として一度に1タスクだけがファイルを書き換えます。
- 別タスクを並行する場合、そのタスクは閲覧・調査だけに限定します。
- 書き込みタスクが実行中の状態で、別タスクからGit操作、依存関係の更新、ビルド生成を重ねません。
- 書き込み担当を切り替える前に、実行中プロセス、ステージ状態、作業ツリーの差分を確認します。

## 3. Git運用

- `git add -A` は使用しません。対象ファイルを明示して追加するか、`git add -p`などで必要なハンクだけを部分ステージします。
- 自分が作成したと確認できない既存変更を、破棄、上書き、巻き戻し、削除しません。
- コミット前後に `git status` を確認し、コミット前には `git diff --cached --check` も実行します。
- コミットは、レビュー、検証、取り消しができる機能単位に分けます。
- `git push` は、ユーザーから明示的な許可がある場合だけ実行します。
- このプロジェクトでは、非`main`ブランチのpushでもVercel Previewが自動起動します。pushを単なるバックアップ操作として扱いません。

## 4. 変更の検証

- コードを変更する前に、ルートの [`AGENTS.md`](../AGENTS.md) と `node_modules/next/dist/docs/` にあるNext.js 16.2.6の関連ローカル資料を確認します。
- コード変更では原則として、対象ESLint、ルートTypeScript、Next.js本番buildを実行します。
- 大きなコミットや混在した作業ツリーから切り出すコミットでは、親HEADへ対象差分だけを適用した隔離環境でもTypeScriptと本番buildを実行します。
- 画像は参照パス、大文字・小文字、形式、デコード、寸法、容量を検証します。
- PDFはファイル数、slug、破損、配信Functionへの同梱、ignore判定を検証します。
- migrationは命名、依存順、制約、RLS、関数権限、既存schemaとの整合性を静的に検証します。
- 実行できなかった検証や既知の失敗は、成功扱いにせず終了報告へ記録します。

## 5. ファイル分類とignore

変更を次の区分に分け、コミットへ混在させません。

- ソースコード: アプリ、API、ライブラリ、migration、運用に必要なスクリプトと文書。
- 本番アセット: 実行時にコードから参照され、形式・内容を検証済みの画像やPDF。
- ローカル生成物: `.next/`、キャッシュ、一時出力、プレビュー生成物など。
- 検討資料: UI案、旧設計書、比較画像、試作品、採用前の素材。
- 秘密情報: 環境ファイル、APIキー、トークン、秘密鍵、個人情報を含むローカル資料。

`.codex_tmp/`、`supabase/.temp/`、`node_modules/`、`.next/`はコミットしません。未使用アセットや検討用アセットを本番コミットへ混ぜません。

`private/`は原則としてVercelデプロイ対象から除外します。例外は、検証済みの自己レポートPDF 32件に一致する `private/self-report-stories/*-vertical-story.pdf`だけです。この例外は `.vercelignore` で明示し、PDF配信Functionへの同梱を検証します。`private/`内のその他のファイルを公開または同梱してよいという意味ではありません。

## 6. 秘密情報

- `.env.local`、APIキー、アクセストークン、service-roleキーなどの秘密情報をGitへコミットしません。
- 秘密値をチャット、ログ、スクリーンショット、コミットメッセージ、検証記録へ表示しません。確認時は変数名の有無だけを扱います。
- Vercel環境変数はProduction、Preview、Developmentで分離して管理します。
- PreviewへProductionの資格情報を流用しません。Previewには用途を限定したテスト用資格情報を設定します。
- `NEXT_PUBLIC_`で始まる変数はクライアントへ公開されます。秘密値を入れません。
- Expoのpublic configやbundleにも、service-roleキー、AIキー、その他の秘密値が含まれないことを確認します。

## 7. DB migration

- Supabase CLIが認識する `YYYYMMDDHHMMSS_name.sql` 形式を使用します。
- timestampを含むmigration番号を重複させません。作成前にローカルとremoteの履歴を確認します。
- 操作前に、適用済みmigration履歴とremote schemaの両方を確認します。ファイルの存在だけで適用状態を判断しません。
- 古いpolicy migrationを後から適用して、最新の許可集合やセキュリティpolicyを過去の状態へ戻さないよう、依存順と最終状態を確認します。
- migrationはstagingまたは同等の隔離環境で検証してからProductionへ適用します。
- DBとアプリの互換性を維持できる順序で、schema追加、アプリ配布、後処理を計画します。
- `supabase db push`や`supabase migration repair`は、明示的な許可なしに実行しません。

## 8. Vercelリリース

- リリース前にVercel CLIのversion、ログイン主体、接続先project ID、team、Git branchを確認します。
- 非`main`ブランチのpushでも、自動でVercel Previewが起動します。
- Previewで画面、API、認証、課金、アセット、ログを検証してからProductionへ進みます。
- migrationとアプリは、DBとの前方・後方互換性を保つ適用順にします。必要なschemaより先に、それを必須とするアプリを公開しません。
- Productionデプロイ、既存デプロイのpromote、rollbackは、対象と影響を確認し、明示的な許可がある場合だけ実行します。
- デプロイ前に、Vercel上で利用可能なrollback手順、直前の正常デプロイ、DB変更を戻せるかどうかを確認します。

## 9. バックアップ

- 大規模変更、push、migration適用、PreviewまたはProductionデプロイの前にバックアップを作成します。
- Git BundleはMac本体の `/Users/wakan/Documents/WATASHI_BACKUPS/` に保存します。
- ファイル名には日付、ブランチ名、現在HEADの短縮SHAを含め、既存ファイルを上書きしません。
- `git bundle create`後に `git bundle verify`を実行し、現在HEADがbundle内に存在することを確認します。
- bundleのSHA-256チェックサムとファイル容量を記録します。
- Git Bundleが保存するのはGitにコミット済みの履歴と指定refです。未コミット変更と未追跡ファイルは含まれません。
- 重要な未コミット素材がある場合は、Git Bundleとは別の安全な保存先へバックアップします。その際も秘密情報の取扱いと既存ファイルの上書き防止を徹底します。

## 10. 作業終了条件

作業完了時は、次をすべて確認して報告します。

- 意図しないステージがなく、コミット完了後のステージが空であること。
- 実行した検証、その結果、実行できなかった検証が記録されていること。
- 未解消事項、残存する変更、未追跡ファイル、次の安全な手順が明示されていること。
- `git push`、DB適用、外部サービスへの送信、Preview／Productionデプロイを実施したか、していないかが明記されていること。
