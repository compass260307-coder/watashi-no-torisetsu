# 韓国版課金設定

状態: 現行商品・価格で固定（2026-09-19）

> 全言語の商品・価格に関する事業上の正本は [`COMMERCE_CATALOG.md`](COMMERCE_CATALOG.md)。韓国語版で新規販売する商品は完全版だけ。学生プランとプレミアムは過去購入・権利互換のために定義を保持する。

## 公開状態

韓国語「運命の設計図」は完全版に含まれる常時公開機能で、公開フラグは使用しない。
`/ko/unmei` は完全版購入者に出生情報の入力と鑑定を表示する。未購入者は韓国語の本人結果ページ、または韓国語トップの完全版購入導線へ戻し、完全版だけを案内する。

## 商品と差額

| 商品キー | 表示価格 | 解放範囲 |
| --- | ---: | --- |
| `full_access` | ₩4,900 | 自己診断、専用電子書籍、友達診断、他己分析PDF、相性診断、運命の設計図、Alice 30回答、タロット3種 |

`self_report`（旧学生プラン ₩1,900）と `premium_bundle`（旧プレミアム ₩8,900）は過去購入・権利互換のために残し、新しいCheckoutを作成しない。旧学生プラン購入者が完全版へ移行する場合に限り、既存の差額計算をサーバー側で維持する。

価格は `src/lib/access-products.ts` を唯一のアプリ側定義とし、Checkout API が
購入済み権限を再確認して差額を算出する。クライアントから金額は受け取らない。

## Stripe / Vercel

必須:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_FULL_ACCESS_KRW`: active / one-time / KRW / ₩4,900 の Price

完全版の Price が金額・通貨・買い切り条件と一致しない、または Stripe から取得
できない場合、Checkout は `price_configuration_invalid` で停止する。

旧学生プラン購入者から完全版への差額はサーバ固定の inline `price_data` を使う。
すべて税込価格 (`tax_behavior=inclusive`) として作成する。

Stripe Checkout は `payment_method_types` を固定せず Dynamic Payment Methods を使う。
Stripe Dashboard の Payment methods で、アカウントが利用できる次の韓国向け手段を
有効化する。

- Korean cards (`kr_card`)
- Kakao Pay
- Naver Pay
- Samsung Pay
- PAYCO
- 通常の card / wallet

Stripe Tax を使う場合だけ、Stripe 側の商品税区分・登録地域・税込設定を確認した後に
次を設定する。

- `STRIPE_AUTOMATIC_TAX_ENABLED=true`
- `STRIPE_TAX_CODE_DIGITAL_SERVICES`（利用する場合）

自動税計算を有効にした状態では、外部 Price の `tax_behavior` が `inclusive` でないと
Checkout を停止する。

## Webhook と返金

購読イベント:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `charge.refunded`

未適用環境では、次を日付順に適用する。

- `supabase/migrations/2026-08-10-self-report-product.sql`
- `supabase/migrations/2026-08-11-premium-bundle.sql`
- `supabase/migrations/2026-08-12-korean-three-courses-refund-revocation.sql`

運命の設計図単体購入も `payment_history` に保存し、全額返金時には同一メールに残る
有効な購入を再集計して `plan` / `unmei` を更新する。部分返金では権限を維持する。

## リリース確認

1. 韓国語の自己診断・友達診断・運命・Aliceの購入導線には完全版だけが表示される。
2. 未購入時の Checkout 金額が完全版 ₩4,900になり、`self_report` と `premium_bundle` の新規Checkoutは `product_not_offered` で拒否される。
3. 旧学生プラン購入者には完全版への差額₩3,000が適用される。
4. 完全版購入後に `/ko/unmei` で出生情報を入力でき、韓国語鑑定が生成される。
5. 韓国向け決済手段が実機の Checkout に表示される。
6. 全額返金後に該当権限が閉じ、別購入がある権限だけ維持される。
7. `paywall_plan_viewed` → `purchase_cta_clicked`（クライアント診断用）→
   `checkout_requested`（サーバー正本）→ `checkout_session_created` →
   `purchase_completed` が `locale=ko` で記録される。Stripeから戻った場合は
   `checkout_cancelled` も同じ `checkout_attempt_id` で記録される。
