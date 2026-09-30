# 小さな通信・ビルドの無駄の削減（2026-09-30）

## 変更

### PDF用HTMLの不要なフォント先読み

`src/app/report/layout.tsx` と `src/app/tako-report/layout.tsx` の `Noto_Sans_KR` に `preload: false` を指定した。

- 削減対象はLatinサブセットの **26,084 bytes、1リクエスト**。変更前の本番ビルドでは `fca78c2ee6cec166-s.p.0kizb7t94.kuf.woff2`。
- 日本語では韓国語フォントを本文に使わないため、この先読みは不要だった。
- フォント本体、CSS変数、韓国語用の適用CSSは残す。韓国語で必要な文字を描画するときは取得され、PDFにも埋め込まれる。
- ロゴ用フォントの先読みは維持。課金画面、価格、決済処理の変更なし。
- 対象はprint HTMLページとHTMLからのPDF生成。通常の日本語自己診断PDFは既成PDFを返すため、全PDFダウンロードに26KBの削減を計上できるわけではない。

### 文書だけの更新ではVercelビルドを省略

`scripts/ignore-documentation-build.mjs` を追加し、`vercel.json` の `ignoreCommand` から呼ぶ。

- 前回**成功**デプロイの `VERCEL_GIT_PREVIOUS_SHA` と今回の `VERCEL_GIT_COMMIT_SHA` を比較する。
- `README.md / AGENTS.md / CLAUDE.md / HANDOFF.md` と `docs/` 以下の `.md` だけが変わった場合に省略する。ただし `docs/COMMERCE_CATALOG.md` は通常ビルド対象。
- ソース、画像、PDF、設定、依存関係、スクリプト、CI、未知のパスの変更は通常ビルド。
- 初回デプロイ、SHA欠損・不正、浅いcloneでの履歴不足、履歴分岐、HEAD不一致、Gitエラー、同一SHA再デプロイ、空差分は通常ビルド。
- `HEAD^` との比較はしない。コード変更のデプロイ失敗後に文書だけを修正しても、未反映のコード変更を含めて判定する。
- rename判定を無効にし、コードをdocsへ移動した場合もコードの削除を検知する。
- 終了コードはVercelの仕様に合わせ、`0 = 省略`、`1 = 通常ビルド`。
- 省略の対象は主にビルド処理。Ignored Build Stepでもデプロイ件数等の枠は消費する。

### 古くなったPRチェックを取消

`.github/workflows/commerce-catalog.yml` にconcurrencyを追加した。同じPRへ更新が続いたときは古い実行を取り消し、最新コミットの価格チェックを実行する。mainへのpushはSHA単位とし、別コミットのチェックは取り消さない。

このCIは元々Next.jsの本番ビルドを実行していない。ビルドの二重実行を削除した、という変更ではない。価格チェックの名前・起動条件・処理、prebuildの価格検証と画像manifest生成は維持した。

## 検証

- ビルド省略の回帰テスト：`node --test scripts/ignore-documentation-build-test.mjs`、20件成功。実際の一時Gitリポジトリで文書・コード・rename・履歴欠損・失敗後の差分などを検証。
- 対象ESLint、TypeScript：成功。
- 本番ビルド：成功（Next.js 16.2.6、静的ページ322件）。価格ガード42件・公開アセット参照243件も成功。
- 本番font manifestの比較で、自己診断・友達診断のprintページから26,084 bytesのフォント先読みだけが除外され、その他のルートの先読みは不変。自己診断PDF配信Functionへの既成PDF32件の同梱も確認。
- 開発用printプレビュー：自己診断・友達診断 × 日本語・韓国語の4ページで、フォント先読みが2件から1件へ減少。本文テキスト長・各sectionの幅と高さは変更前後で一致。
- 既存の開発用 `previewType=sparkle-dolphin__N` を利用し、実ユーザーのDB参照・購入・外部ストレージへのPDF保存は行っていない。
- 韓国語PDFの変更前後を実際のアプリのPDF生成APIで取得。自己診断16ページ（9,637,554 bytes）、友達診断21ページ（11,404,507 bytes）。ページ数、全ページの抽出テキストが一致。
- 全37ページを72dpiでPNG化して比較し、変更前後のピクセル差分ゼロ。両PDFでNotoSansKRの埋め込みを確認。本文ページの画像と日韓ブラウザ表示も目視確認。
- 一時PDF・PNG・比較記録は `.codex_tmp/small-cost-cleanup/` に置き、コミット対象外。

## 作業・反映範囲

- 隔離worktree：`.codex_tmp/locale-split-20260930`
- ブランチ：`codex/small-cost-cleanup-20260930`、親コミット：`3b4d579b85be0d0b813cf6bfd3d714f84e8fe7d3`
- 以前の翻訳分離・背景キャッシュ・画像サイズ・API確認通信の改善を引き継ぐ。
- push、Preview/Productionデプロイ、Vercel管理画面の変更、DB変更は実施していない。本番の削減量は反映後に確認する。
- バックアップ：`/Users/wakan/Documents/WATASHI_BACKUPS/20260930_small-cost-cleanup_3b4d579b.bundle`（15,458 bytes）。検証済みの差分bundleで、復元には `62603f9c` までの履歴が必要。
- バックアップSHA-256：`2464f8fdde7b29e76a9356ee225c1941c5a893d5fb523d3a64bfb187d41e013f`
- 次回デプロイ前にVercel CLIの更新を推奨（セッション通知：59.15.1 → 61.1.0、`npm i -g vercel@latest`）。今回はCLI更新・デプロイ操作なし。

## 参照

- Next.js 16.2.6ローカル資料：`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`（preload / subsets）
- [Vercel ignoreCommand](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand)
- [Vercel前回成功デプロイSHA](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_git_previous_sha)
- [Vercel Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step)
- [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
