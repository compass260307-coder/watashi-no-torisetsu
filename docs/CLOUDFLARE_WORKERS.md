# Cloudflare Workers で動かす

本番は Vercel で動いている。このページは、同じコードを Cloudflare Workers でも動かせるようにした部分の説明。
Cloudflare 向けの処理は `DEPLOY_TARGET=cloudflare` を付けてビルドしたときだけ有効になり、Vercel のビルドと動きは変わらない。

## 仕組み

- アダプターは [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)。設定は `open-next.config.ts` と `wrangler.jsonc`。
- Worker の入口は `cloudflare/worker.mjs`。アダプターが生成した処理を包み、ページ本体の保存期間の指定と定期実行を補う。
- 基盤に依存する処理は「Vercel 用」と「Cloudflare 用 (`*.cloudflare.ts`)」の2ファイルに分け、`next.config.ts` の `turbopack.resolveAlias` で Cloudflare 向けビルドのときだけ差し替える。

| 処理 | Vercel 用 | Cloudflare 用 |
|---|---|---|
| PDF 用ブラウザの起動 | `src/lib/pdf-browser.ts` (同梱の Chromium) | `src/lib/pdf-browser.cloudflare.ts` (browser binding `BROWSER`) |
| 接続元の国 | `src/lib/request-country.ts` (`x-vercel-ip-country`) | `src/lib/request-country.cloudflare.ts` (`cf.country`) |
| LINE 用画像の変換 | `src/lib/line-upgrade-image-render.ts` (sharp) | `src/lib/line-upgrade-image-render.cloudflare.ts` (images binding `IMAGES`) |
| 自己診断レポートの小説 PDF | `src/lib/self-report-story-pdf.ts` (同梱ファイル) | `src/lib/self-report-story-pdf.cloudflare.ts` (R2 binding `PRIVATE_FILES`) |

処理を足すときは、Vercel 用のファイルと同じ関数を Cloudflare 用にも用意し、`next.config.ts` の対応表に1行足す。

## ビルドと配置

```bash
# 確認用の環境 (wrangler.jsonc のいちばん上の階層)
npm run cf:build -- --site-url=<確認用の URL> --noindex
npx opennextjs-cloudflare deploy
```

- `opennextjs-cloudflare build` を直接実行しない。`.env.local` の中身が成果物に書き出され、秘密の値が Worker のプログラム本体に入る。`npm run cf:build` (`scripts/cloudflare-build.mjs`) は `.env` 系のファイルを退避してビルドし、成果物に秘密の値が残っていないことを検査する。
- 秘密の値は Cloudflare 側に secret として登録する (`npx wrangler secret bulk <ファイル>`、または配置時の `-- --secrets-file <ファイル>`)。登録に使ったファイルは残さない。
- `NEXT_PUBLIC_` で始まる値はビルド時に埋め込まれる。`NEXT_PUBLIC_SITE_URL` は、状態を変える API の Origin チェック (`src/lib/origin-check.ts`) にも使うので、配置先の URL と一致させる。
- 本番 (`env.production`) の配置と、ドメインの向き先の切り替えは、本人の明示承認が要る (`AGENTS.md`)。

## 定期実行

`vercel.json` の `crons` と同じ3本を、`wrangler.jsonc` の `env.production.triggers.crons` (UTC) と `cloudflare/worker.mjs` の `CRON_PATHS` で対にして管理する。時刻や入口を変えるときは、3か所をそろえて直す。確認用の環境では定期実行を動かさない。

手元での確認:

```bash
npx opennextjs-cloudflare preview --port 8799
curl "http://localhost:8799/cdn-cgi/local/scheduled?cron=0+*+*+*+*&format=json"
```

## 小説 PDF の置き場

日本語版の自己診断レポート (`private/self-report-stories/` の PDF) は、Cloudflare では非公開の R2 バケット `watashi-private-files` の `self-report-stories/<ファイル名>` から読む。PDF を差し替えるときは、リポジトリのファイルと R2 の両方を更新する。

```bash
npx wrangler r2 object put "watashi-private-files/self-report-stories/<ファイル名>" \
  --file "private/self-report-stories/<ファイル名>" --content-type application/pdf --remote
```

## 注意点

- 事前生成したページは静的ファイル置き場から読む (`staticAssetsIncrementalCache`)。時間や操作による再生成 (ISR / `revalidate`) を使い始めるときは、書き込みできる保存先 (R2) に替える。
- `public/_headers` は Workers の静的ファイル用の設定。`next.config.ts` の `headers()` は、Workers では静的ファイルに効かない。
- `src/proxy.ts` (Node.js の proxy) は、アダプター側の扱いが「実験的」。アダプターを更新するときは、韓国語の特商法ページへの転送と、欠けた JS の復旧が動くことを確かめる。
- Worker の入口 (`cloudflare/worker.mjs`) は、Vercel のビルドの型検査に入らないよう `.mjs` にしている。
