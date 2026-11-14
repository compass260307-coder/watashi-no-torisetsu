# ワタシのトリセツ

無料の自己診断・友達診断、結果レポート、Web決済、LINEのAlice体験を提供するNext.jsアプリです。

## チームで開発を始める

**初めて参加する人は [Mac向け参加手順](docs/TEAM_DEVELOPMENT.md) を読んでください。**

- Node.js: `.nvmrc` のバージョン（Vercelと同じ24系）
- パッケージ管理: npm 11系 / `package-lock.json` / `npm ci`
- AI: CodexまたはClaude Code。共通ルールは [`AGENTS.md`](AGENTS.md)、Claude Codeは [`CLAUDE.md`](CLAUDE.md) から参照します。
- 各自のMacに専用cloneと作業ブランチを作ります。外付けSSDと旧Desktopのバックアップコピーは作業に使いません。

```bash
npm ci
# .env.local がない初回だけ実行。実際の開発用キーは管理者から受け取ります。
cp -n .env.example .env.local
npm run dev:check
npm run dev:team
```

キーが未設定ならチェックは失敗します。`.env.example`だけで診断の保存・購入まで動くわけではありません。設定後は [ローカル画面](http://127.0.0.1:3000) を開きます。

| 目的 | コマンド |
| --- | --- |
| 開発用接続設定の確認（外部通信なし） | `npm run dev:check` |
| テスト決済用設定の確認 | `npm run dev:check -- --checkout` |
| 設定を確認してローカル起動 | `npm run dev:team` |
| 設定チェッカーの回帰テスト | `npm run verify:team` |
| 商品・価格の契約チェック | `npm run verify:commerce` |
| Lint / 型チェック | `npm run lint` / `npm run typecheck` |
| 本番形式のビルド | `npm run build` |

## 共通資料

- [参加・日常作業・引き継ぎ](docs/TEAM_DEVELOPMENT.md)
- [環境変数と検証環境の準備](docs/TEAM_ENVIRONMENT.md)
- [事業の憲法(2026-11-14失効・履歴資料)](docs/BUSINESS_CONSTITUTION.md)
- [固定中の商品・価格](docs/COMMERCE_CATALOG.md)
- [Workspace・バックアップ・リリース方針](docs/WORKSPACE_RELEASE_POLICY.md)
- [LINE × 診断結果：1タップ連携](docs/LINE_LIFF_LINKING.md)
- [ローカルのメール認証デモ](docs/LOGIN_CODE_LOCAL.md)

`apps/alice`は別アプリです。ルートの開発手順で起動するのはWeb版です。現行の開発対象は事業の憲法を確認してください。
