# 経営KPIの定義と運用

管理画面 `/admin`、CSV出力、`/api/metrics` はすべて
`src/lib/core-kpis.ts` の同じ集計結果を利用する。

## 期間の意味

期間指定は単純なイベント発生日フィルタではなく、コホート指定として扱う。

- 自己診断起点の指標: 選択期間に初回自己診断を完了したユーザーを、その後の行動まで現在時点で追跡
- 課金起点の指標: 選択期間に初回フルアクセス決済を完了したユーザーを、その後の行動まで現在時点で追跡

このため「7日」を選んだ場合でも、その7日間に自己診断した人が後日課金・友達回答した結果は反映される。

## KPI

| KPI | 分子 | 分母 | 正本 |
|---|---|---|---|
| 自己診断完了→課金率 | 自己診断後にフルアクセス実決済した人 | 自己診断コホート | `users.diagnosis_completed_at` + `payment_history` |
| 自己診断完了→友達診断1人完了率 | 自己診断後に友達回答が1件以上届いた人 | 自己診断コホート | `friend_perceptions` |
| 課金→友達診断1人完了率 | 初回課金後に友達回答が1件以上届いた人 | 初回課金コホート | `payment_history` + `friend_perceptions` |
| ARPU | コホートに紐づく実決済額−返金額 | 自己診断コホート | `payment_history` |
| 拡散係数 | コホートから招待経由で生まれた新規診断完了者 | 自己診断コホート | `users.source_user_id` |

ARPUはJPY/KRWなど通貨別に算出し、異なる通貨は合算しない。Stripe Checkout Session IDで決済を冪等化し、全額・一部返金を純売上へ反映する。

## リリース手順

1. Supabaseへ `supabase/migrations/2026-07-20-core-kpi-facts.sql` を適用
2. Stripe webhookの送信イベントに `charge.refunded` を追加
3. アプリをデプロイ
4. `/api/metrics` の `coreKpiReady` が `1`、管理画面の「要DB更新」が消えたことを確認
5. `paymentUserMatchRate` を確認し、100%未満なら未紐付けの旧ゲスト決済を監査

マイグレーション未適用時は、新KPIを誤って0として見せず「要DB更新」と表示する。既存のイベント参考指標は継続表示する。

## `/api/metrics` の主要フィールド

- `coreKpiReady`, `coreKpiIssues`
- `coreDiagnosisCohortUsers`
- `diagnosisToPaidUsers`, `diagnosisToPaidRate`
- `diagnosisToFriendUsers`, `diagnosisToFriendRate`
- `paidCohortUsers`, `paidToFriendUsers`, `paidToFriendRate`
- `arpuJpy`, `arpuKrw`
- `coreViralCoefficient`, `coreViralChildren`
- `paymentUserMatchRate`
