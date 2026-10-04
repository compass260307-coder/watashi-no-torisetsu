# full-access-status コスト改善

調査・実装日: 2026-10-04 JST。リリース差分の基準は最新origin/main 9db8cea9。未公開のタイ語変更は含めない。対象は `/api/checkout/full-access-status` と直接の表示・決済復帰・キャッシュ破棄経路のみ。価格、商品、購入時ポリシー、コンテンツのサーバー認可は変更していない。

## 修正前の呼び出し元

直接fetchは2箇所。共通関数 `src/lib/use-course-navigation-access.ts` の `requestFullAccessStatus` と、独立した `PaidUnlockWatcher` のポーリング。

| 利用箇所 | 経路・用途 | 取得条件 |
| --- | --- | --- |
| BottomNav | useCourseNavigationAccess → requestFullAccessStatus。Alice/運命/タロットの鍵 | ownerToken変更。非表示ページと開発プレビューは省略 |
| TopHeader | 同上。ヘッダー・ドロワーの鍵 | ownerToken変更 |
| TopFooter | 同上。フッターの鍵 | ownerToken変更 |
| FullAccessPromoCard | requestFullAccessStatus。購入済み・旧差額の表示 | ownerToken/previewMode/usesLegacyFullAccessCard変更 |
| SelfAccessPlanCarousel | requestFullAccessStatus。購入済み・価格表示 | ownerToken/previewMode変更 |
| UnmeiPriceCta | requestFullAccessStatus。旧アップグレード導線の表示 | sessionOwnerToken/hasFull変更。別に期限のないtorisetsu_full_tokenも使用 |
| PaidUnlockWatcher | 独自fetch。Stripe webhook反映確認 | 決済後、親が未反映判定したときだけ。最大10回・約60秒のbackoff |

FullAccessPromoCardはPaywallModal・各言語の自己/友達結果・相性ページ等から利用される。SelfAccessPlanCarouselはFullAccessPromoCard内のコース表示でも利用される。UnmeiPriceCtaは各言語の運命LPから利用される。PaidUnlockWatcherは日本語/英語の自己・友達結果、相性、公開済み4言語のhoshiyomi/tarotで利用される。日本語のMeResultPageを再利用する言語も同じ経路。

### 重複の実態

- 通常取得には既にowner_token別のin-flight共有と30秒のメモリキャッシュがあった。同一ページの同時fetchはある程度抑えられていた。
- React再レンダリングだけで無条件にAPIを再実行する実装ではなかった。依存配列はtoken等のprimitive。ページ再マウント、30秒経過後の課金カード表示、ハードリロードで再取得する。
- SWR/React Queryはこの経路にはない。既存のwindow focus自動refetchもない。追加の定期refetchは導入していない。
- 独立したPaidUnlockWatcherは通常fetchと共有せず、確認結果も通常キャッシュに渡していなかった。成功時のハードリロードでも通常取得が再発生する。
- ログアウト・ユーザー切替・セッション再発行を明示したキャッシュ無効化がなかった。

## 修正前のSupabase通信一覧

| 関数 | SELECT/RPCと権限上の用途 |
| --- | --- |
| route入口 | users.id by owner_token。秘密トークンによる本人行の解決 |
| hasFullAccess | users.plan/email by id。本人の完全版。未fullならusers.id by email + plan=full。ゲスト購入・再診断のメール横断 |
| hasSelfReportAccess | 共有済みhasFullAccessを参照。payment_history count(completed/self_report/本人)。なければusers.email、同一emailのusers.id(limit20)、関連ユーザーのself_report count。自己本文/PDF |
| hasTakoAccess | 共有済みhasFullAccessを参照。共有済みgetAccessPurchaseEntitlementsを参照してfriend policy。その後本人のtako_unlock count、users.email、関連users.id(limit20)、他の行のtako_unlock count。旧単品の友達権利 |
| getAccessPurchaseEntitlements | users.email、関連users.id(limit50)、completedのself_report/full_access/premium_bundleの履歴(id/user_id/kind/metadata/paid_at)。premiumBundle/tarot、および各policy・差額前提の判定 |
| hasUnmeiAccess | users.unmei/email/plan、同一emailのunmei=true行。なければ共有済みgetAccessPurchaseEntitlementsを参照。旧plan=fullの互換を含む運命権利 |
| ensureHoshiyomiCreditsFromPurchase | getHoshiyomiCredits、関連users.id、completedのfull/premium履歴。その購入ごとのgrantHoshiyomiCreditsToTarget、最後にgetHoshiyomiCredits再実行。チャット未付与の復元 |
| getHoshiyomiCredits / grant…ToTarget | 毎回users.id/email、関連users.id(limit50)、各関連ユーザーへのrelease_stale_hoshiyomi_reservations、hoshiyomi_credit_balances。target不足時だけgrant_hoshiyomi_credits。APIのastrologer判定はremainingでなくtotal>0を使用 |

最新mainではfull/purchasesのPromise共有は実装済み。その共有を維持した基準で比較しても、自己・友達・運命のユーザー情報と購入者の残高確認がユーザー・関連ユーザー・残高を繰り返す。権限は異なるが、参照するデータは重複していた。

## 実装

- memoryのowner別in-flight/解決結果と、タブ内sessionStorageの5分キャッシュを共有。sessionStorageには1件のowner_token・7つのboolean・期限・スコープのみ保持し、メールや決済明細は保存しない。
- スコープは保存されたowner_token、セッション有無、非認証のセッション世代Cookie、変更通知の世代。createSession/rotateSessionで世代を更新、destroySession/resetLocalDataで破棄する。認証Cookieは公開しない。
- 通常の再レンダリング・focus復帰でrefetchしない。期限切れ後に新たな取得要求があるときだけ更新。ストレージ使用不可時はメモリ共有で継続。
- paid=1、checkout=success、upgraded=1、purchase-completeへの復帰は期限内でも無効化。PaidUnlockWatcherの各pollはfresh指定で最新値を読む。同時のfresh要求も共有し、成功後のリロードで結果を再利用する。
- storageイベント/visibility復帰で別タブの購入・ユーザー変更を検知。freshで確認した状態変化も他タブへ通知する。ログアウト/切替前の進行中応答を保存・表示しない。
- 課金カードとCTAは購読型useFullAccessStatusへ統一。token変更直後には前のtokenのstateを返さない。UnmeiPriceCtaの無期限full_tokenキャッシュを廃止し、リセット時にも旧キーを消す。
- Supabaseの[外部キーによるleft join](https://supabase.com/docs/guides/database/joins-and-nesting)でusersとcompleted購入履歴・チャット累計付与数を取得。メールなし1通信、メールあり2通信で各権限を判定。メールありの2回目に本人行も含まれる場合は、本人データを1行に統合して計算する。
- 購入policyの計算だけをaccessPurchaseEntitlementsFromRowsとして共用。既存個別関数の挙動は維持。full/selfReport/friendの旧判定、旧unmei、差額前提、refund、メール正規化、旧20/50件上限を維持。
- APIのチャット判定は累計付与数だけなので、通常取得で予約掃除・再付与確認を繰り返さない。target未達時だけ既存の復元処理を実行。hoshiyomiページ・チャット送信の残高/予約処理は維持。
- レスポンスはprivate, no-store。全ユーザー共通のCDNキャッシュ・サーバー権限キャッシュはない。通常のDB取得失敗は503で、未購入の成功値として保存しない。

## Before / After

ローカルの固定データに対し、実際のsupabase-jsが送信するHTTP通信をカウントした。観測された本番平均9.4と、下表の条件別通信数は別の指標。無効token、メール有無、購入内容、履歴数等で分布が変わる。

| 条件 | 変更前のHTTP通信数 | 変更後 |
| --- | ---: | ---: |
| 未購入・メールなし | 9 | 1 |
| 未購入・メールあり | 15 | 2 |
| 通常購入・残高付与済み | 21 | 2 |
| アップセル購入・残高付与済み | 25 | 2 |
| 同じメールの別行で購入 | 26 | 2 |
| 旧self_report | 9 | 2 |
| 旧tako_unlock | 13 | 2 |
| チャット未付与 | 復元を毎回確認 | 初回は既存復元を追加実行、復元後は1〜2 |

ブラウザではStrictMode＋3 consumersで初回1 invocation、再レンダリング・再マウントを伴う遷移・リロードで追加0。購入確認は必要なfresh呼び出しを維持した。

日次20,000〜30,000 invocationを達成すれば、通常通信は最大約40,000〜60,000/日＋復元/互換経路になる。100,000/日を下回るには、通常2通信の場合にinvocationを約50,000/日未満へ減らす必要がある。5分キャッシュの効果は利用者数・滞在時間・タブ数に依存し、日次の実測目標達成はまだ未確認。

## 確認結果

- node scripts/full-access-status-regression-test.mjs: 未購入・通常購入・アップセル・旧商品・旧plan・同一/別メール・refund・webhook途中の状態・付与復元で従来判定と一致。FK欠落時の互換、50件超の関連行も確認。
- 同テスト: 同時fetch共有、5分TTL、ハードリロード、focus、決済bypass、別タブ通知、セッション世代変更、ログアウト→別ユーザー、切替前の遅い応答、DBエラー未保存を確認。
- node scripts/full-access-status-browser-test.mjs: Chrome/React実装/実PaidUnlockWatcherで、未購入、通常購入、アップセル、購入直後、reload、ページ遷移、別タブから戻る、ログアウト→Bを確認。React StrictModeでも重複なし。外部サービスはローカルの固定応答に置き換えた。
- 対象ESLint、全体TypeScript、verify:commerce、verify:tarot: 成功。
- 最新main＋対象16ファイルの全体Next.js本番build: 成功 (Next 16.2.6 Turbopack)。隔離worktreeに独立したnpm ciで依存を導入。未公開タイ語ファイルを含めず、翻訳変更・build設定変更は不要だった。
- 元の混在作業ツリーの全体buildは既存/th/previewの翻訳不足で失敗していた。これをリリース基準にせず、最新mainに対象差分だけを移して公開済み機能を維持した。

## 残存リスクと反映後の観測

- 購入以外のrefund等を別サービス側で変更すると、クライアントの表示は短時間古い場合がある。表示キャッシュは認可に使用せず、実アクセスとCheckoutは引き続きサーバーの最新DB判定。
- チャット復元が必要な初回、同一メール50件以上、履歴上限到達、FK/schema cache未対応の環境では1〜2通信を超える。権利を守るため既存経路を残している。FK欠落は安全なカテゴリログで検出できる。
- Preview DBはDNSで解決できない既存設定のため、実環境検証待ち。本番のFK/schema cache、実Stripe webhookのタイミング、日次invocation/External API Callsは未検証。ローカルmigrationのFK定義と隔離テストは確認済み。
- 5分を超える滞在、新規タブ、ストレージ制限では追加取得が発生する。ユーザー数自体によるinvocationの下限がある。
- Vercel CLI metricsの対象集計はObservability Plusが必要と返された。契約の追加・変更は行わず、既存のDashboard Observabilityで対象routeを絞り込む。
- 反映後は同じ24時間窓で対象APIのinvocation、External API Calls/invocation、503、legacy relationship fallback、決済反映の所要時間を比較する。target不足による付与復元の初回は通常取得と分けて見る。

## 変更ファイル

- src/app/api/checkout/full-access-status/route.ts
- src/lib/full-access-status.ts (新規)
- src/lib/full-access-status-server.ts (新規)
- src/lib/full-access-status-client.ts (新規)
- src/lib/entitlements.ts
- src/lib/use-course-navigation-access.ts
- src/lib/reset-data.ts
- src/lib/session-constants.ts
- src/lib/session.ts
- src/components/result/PaidUnlockWatcher.tsx
- src/components/result/FullAccessPromoCard.tsx
- src/components/result/SelfAccessPlanCarousel.tsx
- src/components/uranai/UnmeiPriceCta.tsx
- scripts/full-access-status-regression-test.mjs (新規)
- scripts/full-access-status-browser-test.mjs (新規)
- docs/FULL_ACCESS_STATUS_COST_AUDIT.md (本書)

既存のtracked/untracked変更は元の作業ツリーに維持。最新mainから隔離した16ファイルだけをリリース対象とする。DB migrationは不要。Preview用DBのDNS接続失敗を検出したため、実環境での8ケース確認が完了するまではProductionへ進めない。デプロイ結果と指標は作業の最終報告に記録する。
