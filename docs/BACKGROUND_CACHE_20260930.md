# トップ背景画像のブラウザキャッシュ改善

2026-09-30。翻訳辞書分離の `1abc2afb` を親として実装。

## 調査と変更

実際に外部ファイルを取得するCSS背景画像は、トップページのPC用・モバイル用の2枚だった。変更前の本番URLはどちらも `Cache-Control: public, max-age=0, must-revalidate`。Vercel CDNではHITでも、ブラウザは再訪時にサーバーへ確認する設定だった。

`src/lib/top-hero-background.ts` で2枚を静的importし、Next.jsが生成する画像内容のハッシュ付きURLを共有するよう変更した。ヘッダーを広い範囲で変更する必要はない。

- TopHero（日本語・英語・インドネシア語）とKoTopHero（韓国語）のpreloadとCSS背景は、同じURLから生成する。
- PC／モバイルの切り替え条件を維持し、その幅で使う1枚だけを取得する。
- URLは画像内容の変更に応じて自動更新される。手動の版番号更新は不要。
- CSS変数はサーバーから返すHTMLのstyleに含めるため、JavaScriptの実行を待たずに背景を表示できる。
- 元の `public/characters/keyvisual*.webp` は保持。既存のOG・Pinterest等のURLも引き続き使える。

## 実測結果

本番ビルドをローカルで起動し、Chromeの新規ブラウザコンテキストで初回表示、その後同じコンテキストの新しいタブで再訪した。外部計測、購入処理、DB通信は遮断した。

| 対象 | 画像本体 | 新URLのCache-Control | 再訪時の画像転送 |
| --- | ---: | --- | ---: |
| PC背景（1536×1024） | 67,008 B | `public, max-age=31536000, immutable` | 0 B |
| モバイル背景（941×1672） | 56,158 B | `public, max-age=31536000, immutable` | 0 B |

初回・再訪とも表示対象の画像1枚だけを使用し、preloadとCSSによる重複取得はなかった。再訪はChromeのキャッシュ応答として確認した。画像の再確認リクエストも不要になる。HTML自体の再確認は別扱いで、今回の変更対象ではない。

実際の請求削減量は再訪率とキャッシュ保持状況に依存する。変更前も304応答で画像本体を省略できる場合があるため、毎回56KB／67KB丸ごと削減すると見積もらない。初回の画像本体は同じサイズで、静的importに伴いJA／EN／IDトップの圧縮前JavaScriptは約1.1KB増える。

## 検証

- 対象ESLint、TypeScript、本番ビルド成功（322ページ静的生成）。
- 固定商品カタログ42項目、公開アセット参照243件の検証成功。
- 元画像とビルド生成画像の全バイト一致を確認。元画像のデコード・寸法・WebP形式も確認。
- `verify-background-cache.mjs`: 4言語×幅390px／1440pxの初回・再訪、およびJA／KOのJavaScript無効時を検証。計12条件・24回のページ表示で、画像1枚、preload一致、長期キャッシュ、再訪時0 Bを確認。
- `verify-locale-delivery.mjs`: 前回の翻訳分離と課金初期読み込みについて、4言語・9画面の検証を再実施して成功。課金画面を開く際の追加JavaScript取得なし。
- 独立した読み取りレビューで、CSS変数の渡し漏れ、旧URL削除、言語別の取りこぼしがないことを確認。

再現コマンド（本番ビルド済み、別ターミナルでサーバーを起動）:

```sh
npm run start -- --hostname 127.0.0.1 --port 3036
node scripts/verify-background-cache.mjs
```

`CHROME_PATH` でChromeの実行ファイルを指定できる。開発サーバーはキャッシュ条件が異なるため、検証には使用しない。

## 反映状態

`codex/background-cache-20260930` にローカル実装。前回の翻訳分離を含む隔離worktreeで作業し、元の作業ツリーの既存変更は保持した。push、Preview／Productionデプロイ、Vercel設定変更、DB変更は未実施。本番反映後に独自ドメインのヘッダーと再訪時の通信を再確認する。
