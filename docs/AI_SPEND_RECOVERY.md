# AI生成の予算停止と再開

## 対象と設定

結果アップグレードの文章はAnthropic直接接続、キャラクター画像はVercel AI Gatewayを利用する。ここで扱う予算停止は画像生成側のGateway予算・残高不足。

2026-10-13に読み取りで確認したプロジェクト予算は月額$50、使用額$11.5593005。上限・更新周期・BYOKの計上条件を維持したまま、50%・75%・100%の通知を設定した。通知先はVercel標準のプロジェクト予算通知先（チームOwner / Billingロール）。メールの送達自体は未検証。

通知設定の保存直後、PUT応答の`currentSpend`が一時的に0になった。続く予算inspectでは元の使用額が維持されていた。更新の応答だけで使用額がリセットされたと判断せず、読み取りで再確認する。

## アプリの扱い

- `quota_for_entity_exceeded`と`insufficient_funds`を通常の生成失敗と分ける。旧データの`Project budget exceeded`も認識する。
- GatewayがこれらをHTTP 500で返す場合も、専用fetchで402に正規化する。SDKの一時障害向け再試行は維持し、予算超過だけ再送を止める。
- DBのstateは既存の`failed`を利用し、`last_error`へ`ai_spend_blocked:budget_exceeded`または`ai_spend_blocked:insufficient_funds`を保存する。新しいDB stateやmigrationは不要。
- status APIは利用者へ`blocked`、`retryAt`、`canRetry`を返す。上限金額・請求リンク・生のエラー本文は返さない。
- 停止中のページ表示・ポーリングではAIを呼ばない。停止から5分経過後、本人が明示的に再開した場合だけ1回の生成処理を開始できる。時間経過だけで予算の復旧を保証したり、自動再開したりしない。
- 完成済みの文章・画像は再利用し、欠けた部分だけ生成する。予算停止では生成内容の失敗回数を増やさない。
- ready / in-progress / blockedの短絡では生成APIの1時間6回の枠を消費しない。新しい生成処理を開始できる場合だけ枠を使う。

## 運用上の再開

1. `vercel ai-gateway budgets inspect project watashi-no-torisetsu --format json`で上限、期間、使用額、通知を確認する。予算はスコープ別に重なるため、必要に応じて`budgets list`も確認する。
2. 残高不足の場合はGateway Creditsも確認する。予算に余裕があることだけでは残高があると判断しない。今回のローカル環境にはGateway APIキーがなく、クレジット残高は取得できていない。
3. 必要な予算・残高の変更はリリースポリシーに従い承認を得て実施する。自動で上限を増やさない。
4. 設定反映後、対象ユーザーが「作成を再開する」を押す。保存済み文章を保持して画像だけ再開できる。停止が続いている場合は再びblockedに戻し、5分間の待機を設ける。
5. 本番の失敗行の一括変更や有料AIによる一括再生成は、別途明示的な承認なしに行わない。

## 確認

`node scripts/ai-spend-guard-test.mjs`は実際のAI SDKとGateway providerをモックHTTPで実行し、予算超過で呼び出しが1回に止まること、旧データ・再開間隔・API認可・回数制限・画像だけの再開・日本語・韓国語の表示を確認する。本番AIやDBへ書き込まない。
