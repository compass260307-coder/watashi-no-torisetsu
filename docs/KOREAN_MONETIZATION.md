# 韓国版課金設定

状態: 現行商品・価格で固定（2026-09-13）

> 全言語の商品・価格に関する事業上の正本は [`COMMERCE_CATALOG.md`](COMMERCE_CATALOG.md)。韓国語版では学生プランと完全版を新規販売し、プレミアムは過去購入・権利互換のために定義を保持する。

## 公開フラグ

韓国語「運命の設計図」の表示は、未設定のProduction/Previewでは非公開。
完全版に含まれる機能として公開するときだけVercelへ次を設定して再デプロイする。

- `NEXT_PUBLIC_KO_UNMEI_ENABLED=true`

非公開時は `/ko/unmei` が404になり、韓国語ナビから運命の設計図を除外する。ローカルの `next dev` では未設定でも表示する。

## 商品と差額

| 商品キー | 表示価格 | 解放範囲 | 上位コースへの差額 |
| --- | ---: | --- | --- |
| `self_report` | ₩1,900 | 自己診断、自己分析PDF、友達診断、他己分析PDF | 完全版 ₩3,000 |
| `full_access` | ₩4,900 | 学生プラン + 相性診断、運命の設計図、Alice 30回答、タロット3種 | — |

`premium_bundle`（内部定義 ₩8,900）は過去購入・権利互換のために残す。新規の主力商品として表示・販売しない。既存購入者に必要な差額計算はサーバー側の共通定義を維持する。

価格は `src/lib/access-products.ts` を唯一のアプリ側定義とし、Checkout API が
購入済み権限を再確認して差額を算出する。クライアントから金額は受け取らない。

## Stripe / Vercel

必須:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_FULL_ACCESS_KRW`: active / one-time / KRW / ₩4,900 の Price

完全版の Price が金額・通貨・買い切り条件と一致しない、または Stripe から取得
できない場合、Checkout は `price_configuration_invalid` で停止する。

学生プランと既存購入者向け差額はサーバ固定の inline `price_data` を使う。
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

1. 韓国語の自己診断・友達診断で完全版と学生プランの導線が表示される。
2. 未購入時の Checkout 金額が学生プラン ₩1,900、完全版 ₩4,900になる。
3. 学生プラン購入後は、完全版への差額が₩3,000になる。
4. 完全版購入後に `/ko/unmei` で出生情報を入力でき、韓国語鑑定が生成される。
5. 韓国向け決済手段が実機の Checkout に表示される。
6. 全額返金後に該当権限が閉じ、別購入がある権限だけ維持される。
7. `paywall_plan_viewed` → `purchase_cta_clicked` →
   `checkout_session_created` → `purchase_completed` が `locale=ko` で記録される。
