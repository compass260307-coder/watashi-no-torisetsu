# ワタシのトリセツ サイト構造

> 実際のコード（`src/app` / `src/lib`）を走査して作成。推測は含めず、確認できたルート・処理のみを記載。
> 調査時点のブランチ: `feature/top-redesign` / 生成日: 2026-06-19

## 凡例

| 印 | 意味 |
| --- | --- |
| 🔒 | 認証必須（Cookie セッション `wn_session` / owner 確認 / admin-key / 署名検証のいずれか） |
| 💳 | 課金が絡むページ・処理（Stripe Checkout） |
| 🤖 | Claude（Anthropic）API を呼ぶ処理 |
| 🟢 | 認証なしで誰でもアクセス可（URL/トークンを知っていれば閲覧可） |
| ↪️ | リダイレクト（互換用） |

---

## ① ページルート全体のサイトマップ

`src/app` 配下の `page.tsx` から確認できた全ページルート。`layout.tsx` の階層も反映。

```mermaid
flowchart TD
    root["/<br/>トップLP<br/>🟢 診断済みは /me/[token] へ自動リダイレクト"]

    subgraph PUBLIC["公開ページ（認証なし 🟢）"]
        about["/about<br/>サービス紹介"]
        terms["/terms<br/>利用規約"]
        privacy["/privacy<br/>プライバシーポリシー"]
        commerce["/legal/commerce<br/>特定商取引法表記 💳"]
        diagnosis["/diagnosis<br/>自己診断（50問）<br/>?source=line でLINE経由判定"]
        resultFb["/result<br/>結果フォールバック ↪️ /me/[token]"]
        zukanAll["/zukan/all<br/>全32タイプ図鑑"]
        poc["/poc/32type<br/>32タイプPoC"]
        zukanInternal["/zukan-internal<br/>社内用32キャラ参照"]
    end

    subgraph SELF["自己結果（トークン保持者 🟢）"]
        me["/me/[token]<br/>自己診断結果（永続アクセス点）"]
        resultToken["/result/[ownerToken] ↪️ /me/[token]"]
        zukanToken["/zukan/[ownerToken] ↪️ /me/[token]"]
    end

    subgraph FRIEND["友達評価フロー"]
        friendInvite["/friend/[inviteCode]<br/>友達評価（30問）🟢<br/>layout: /friend/[inviteCode]/layout.tsx"]
        friendOld["/friend<br/>旧10問評価（非使用）"]
        evalSent["/evaluate/sent/[perceptionId]<br/>評価者向けセーフ版 🟢"]
        evalResult["/evaluate/result/[perceptionId]<br/>owner向け詳細 🔒<br/>非ownerは /evaluate/sent へ"]
    end

    subgraph MUTUAL["相互理解度ハブ 🔒"]
        friendEval["/friend-evaluation<br/>相互理解度ランキング"]
    end

    subgraph PREMIUM["真のトリセツ（課金 💳🤖）"]
        intNew["/integrated/new<br/>素材選択・購入 🔒💳"]
        checkoutSuccess["/checkout/success<br/>決済完了ポーリング 💳"]
        intId["/integrated/[id]<br/>統合トリセツ表示 🟢🤖"]
    end

    subgraph MYPAGE["マイページ系 🔒"]
        zukanMine["/zukan-mine<br/>マイ図鑑（LIFF/Web両対応）🔒"]
        settings["/settings<br/>設定（通知/削除/ヘルプ）🔒"]
    end

    subgraph AUTH["認証"]
        login["/login<br/>マジックリンク発行"]
        authError["/auth/error<br/>認証エラー"]
    end

    subgraph ADMIN["管理 🔒"]
        admin["/admin<br/>ダッシュボード（admin-key）<br/>layout: /admin/layout.tsx"]
    end

    root --> diagnosis
    root --> me
    root --> about & terms & privacy & commerce
    diagnosis --> resultFb --> me
    resultToken --> me
    zukanToken --> me
    me --> friendEval
    me --> intNew
    me --> zukanMine
    friendInvite --> evalSent
    evalResult --> friendEval
    friendEval --> evalResult
    friendEval --> intId
    intNew --> checkoutSuccess --> intId
    zukanMine --> intNew
    zukanMine --> me
    zukanMine --> settings
    zukanMine --> evalResult
    login --> zukanMine
    zukanAll --> diagnosis

    classDef auth fill:#ffe9cc,stroke:#e6892f;
    classDef pay fill:#ffd6e0,stroke:#d6336c;
    classDef ai fill:#e0d6ff,stroke:#6f42c1;
    class me,evalResult,friendEval,zukanMine,settings,admin,intNew auth;
    class intNew,checkoutSuccess,commerce pay;
    class intId,intNew ai;
```

### ルート一覧（確認済み）

**ページ（`page.tsx`）**

| ルート | layout | 認証 | 備考 |
| --- | --- | --- | --- |
| `/` | `app/layout.tsx`（ルート） | 🟢 | 診断済みなら `/me/[token]` へ自動リダイレクト（`?stay=1` で回避） |
| `/about` `/terms` `/privacy` `/legal/commerce` | ルート | 🟢 | 静的ページ。`/legal/commerce` は特商法表記💳 |
| `/diagnosis` | `app/diagnosis/layout.tsx` | 🟢 | 自己診断50問。`?source=line` でLINE Rich Menu経由判定 |
| `/result` | `app/result/layout.tsx` | 🟢 | フォールバック → `/me/[token]` |
| `/result/[ownerToken]` | `app/result/layout.tsx` | 🟢 | ↪️ `permanentRedirect` → `/me/[token]`（旧URL互換） |
| `/me/[token]` | ルート | 🟢 | 自己診断結果の永続アクセス点（7章すべて無料表示） |
| `/friend` | `app/friend/layout.tsx` | 🟢 | 旧10問評価（現フローでは未使用） |
| `/friend/[inviteCode]` | `app/friend/[inviteCode]/layout.tsx` | 🟢 | 友達評価30問（メインフロー） |
| `/friend-evaluation` | ルート | 🔒 | 相互理解度ランキングハブ（`getSession` 必須） |
| `/evaluate/sent/[perceptionId]` | ルート | 🟢 | 評価者（友達）向けセーフ版 |
| `/evaluate/result/[perceptionId]` | ルート | 🔒 | owner専用詳細。非ownerは `/evaluate/sent` へ |
| `/perceptions/[ownerToken]` | `app/perceptions/[ownerToken]/layout.tsx` | — | 知覚一覧（layout あり） |
| `/report/[ownerToken]` | `app/report/layout.tsx` | 🟢 | 深掘りレポート |
| `/integrated/new` | ルート | 🔒💳 | 素材選択・Stripe Checkout 開始 |
| `/integrated/[id]` | ルート | 🟢🤖 | AI統合トリセツ表示（シェアリンク前提） |
| `/checkout/success` | ルート | 🟢💳 | 決済完了ポーリング → `/integrated/[id]` |
| `/zukan/[ownerToken]` | `app/zukan/layout.tsx` | 🟢 | ↪️ `permanentRedirect` → `/me/[token]` |
| `/zukan/all` | `app/zukan/layout.tsx` | 🟢 | 全32タイプ図鑑 |
| `/zukan-mine` | ルート | 🔒 | マイ図鑑（Cookie セッション、LIFF/Web両対応） |
| `/me`, `/settings` | ルート | 🔒 | 設定（通知/削除/ヘルプ） |
| `/login` | ルート | 🟢 | マジックリンク発行 |
| `/auth/error` | ルート | 🟢 | 認証エラー表示 |
| `/admin` | `app/admin/layout.tsx` | 🔒 | 管理ダッシュボード（admin-key） |
| `/poc/32type`, `/zukan-internal` | ルート | 🟢 | 社内/PoC用 |

**APIルート（`route.ts`）— 別枠**

| APIルート | メソッド | 認証/署名 | 外部サービス |
| --- | --- | --- | --- |
| `/api/diagnosis` | POST | checkOrigin | Supabase |
| `/api/result` | — | owner_token / invite_code | Supabase |
| `/api/friend-info` | — | checkOrigin | Supabase |
| `/api/friend-answer` | POST | checkOrigin | Supabase + LINE |
| `/api/friend-answer/v2` | POST | checkOrigin | Supabase + LINE + Resend |
| `/api/report` | — | owner_token / sample / adminKey | Supabase |
| `/api/event` | POST | checkOrigin | Supabase |
| `/api/user` | PATCH | checkOrigin + ownerToken | Supabase |
| `/api/zukan` | — | owner_token | Supabase |
| `/api/zukan-mine` | GET | 🔒 Cookie セッション | Supabase |
| `/api/integrated-trisetsu` | POST | 🔒 セッション・dev/preview限定（本番は410）| Supabase + 🤖 Claude |
| `/api/integrated-trisetsu/[id]` | GET | 🟢 | Supabase |
| `/api/integrated-trisetsu/[id]/pdf` | GET | 🔒 セッション + 所有権 | Supabase + react-pdf |
| `/api/checkout/create-session` | POST | 🔒 セッション 💳 | Stripe + Supabase |
| `/api/checkout/create-perception-unlock-session` | POST | 🔒 セッション + 所有権 💳 | Stripe + Supabase |
| `/api/checkout/status` | — | session_id | Supabase |
| `/api/webhook/stripe` | POST | 🔒 Stripe署名 💳🤖 | Stripe + Supabase + Claude + LINE/Resend/Slack |
| `/api/webhook/line` | POST | 🔒 LINE署名 | LINE + Supabase |
| `/api/auth/request-magic-link` | POST | checkOrigin + レート制限 | Supabase + Resend |
| `/api/auth/verify-magic-link` | GET | token | Supabase |
| `/api/account/delete` | — | 🔒 セッション | Supabase + LINE |
| `/api/settings/notifications` | — | 410 Gone（Phase2凍結） | — |
| `/api/session/clear` | POST | checkOrigin | Supabase |
| `/api/cron/remind-friend-eval` | — | 🔒 Cron Bearer | Supabase + LINE |
| `/api/admin/dashboard` `/stats` `/simulate-follow` `/test-line-notify` `/welcome-status` | — | 🔒 x-admin-key | Supabase (+ LINE) |

---

## ② 主要ユーザーフロー（診断 〜 相互理解度 〜 真のトリセツ）

```mermaid
flowchart TD
    start(["ユーザー流入"])

    subgraph WEB["Webブラウザ経由"]
        lp["/ トップLP"]
    end
    subgraph LINE["LINE / LIFF 経由"]
        richmenu["LINE Rich Menu"]
        lineShare["LINE で共有された招待URL"]
        lineNotify["LINE 通知リンク"]
    end

    start --> lp
    start --> richmenu
    start --> lineShare
    start --> lineNotify

    %% 診断フロー
    lp -->|診断する| diag["/diagnosis<br/>自己診断50問<br/>🟢"]
    richmenu -->|"/diagnosis?source=line"| diag
    diag -->|"POST /api/diagnosis<br/>inviteCode + ownerToken 発行"| apiDiag{{API: diagnosis}}
    apiDiag -->|成功| me["/me/[token]<br/>自己診断結果（7章 無料）🟢"]
    apiDiag -.->|失敗| resultFb["/result → /me/[token]"]

    %% 招待・友達評価
    me -->|招待URL / QR を共有| invite["招待リンク<br/>/friend/[inviteCode]"]
    lineShare --> invite
    invite --> friendEval2["/friend/[inviteCode]<br/>友達評価30問<br/>scale→choice→consent→name 🟢"]
    friendEval2 -->|"POST /api/friend-answer/v2<br/>friend_perceptions 生成"| apiFA{{API: friend-answer/v2}}
    apiFA -->|成功| sent["/evaluate/sent/[perceptionId]<br/>評価者向けセーフ版 🟢"]
    sent -->|自分も診断| diag

    %% 相互理解度
    me -->|相互理解度を見る| hub["/friend-evaluation<br/>相互理解度ランキング 🔒"]
    lineNotify --> mine["/zukan-mine<br/>マイ図鑑 🔒"]
    mine --> hub
    apiFA -.->|"通知（LINE/メール）"| me
    hub -->|ランキング行をクリック| evalRes["/evaluate/result/[perceptionId]<br/>owner向けギャップ詳細 🔒"]

    %% 真のトリセツ（課金）
    hub -->|真のトリセツを作る| intNew["/integrated/new<br/>素材選択・購入 🔒💳"]
    me --> intNew
    mine --> intNew
    intNew -->|"POST /api/checkout/create-session"| stripe["Stripe Checkout 💳"]
    stripe -->|"success_url"| csuccess["/checkout/success<br/>ポーリング 💳"]
    csuccess -->|"webhook で AI 生成完了後"| intId["/integrated/[id]<br/>AI統合トリセツ 🟢🤖"]
    hub --> intId

    classDef pay fill:#ffd6e0,stroke:#d6336c;
    classDef ai fill:#e0d6ff,stroke:#6f42c1;
    classDef auth fill:#ffe9cc,stroke:#e6892f;
    class intNew,stripe,csuccess pay;
    class intId ai;
    class hub,evalRes,mine auth;
```

### LIFF（LINEアプリ内）経由 と Web経由 の違い

確認できた範囲では、**ページ自体はほぼ共通**で、入口と一部処理が分岐する。

| 観点 | Web ブラウザ経由 | LINE / LIFF 経由 |
| --- | --- | --- |
| 診断開始 | `/` → `/diagnosis` | LINE Rich Menu → `/diagnosis?source=line`（過去診断ありなら再診断確認モーダル） |
| 友達評価 | 共有URL `/friend/[inviteCode]` を通常ブラウザで開く | 同URLを LINE で共有 → LIFF / 通常ブラウザ双方で動作（ページ側はLIFF非依存） |
| マイ図鑑 | `/zukan-mine`（Cookie `wn_session` で認可） | LINE 通知リンク → `/zukan-mine`（旧: LIFF id_token、現: Cookie セッションに移行） |
| PDF ダウンロード | `/integrated/[id]` のダウンロードボタン | `IntegratedDownloadButton` が LIFF id_token を取得して `/api/integrated-trisetsu/[id]/pdf` を呼ぶ |
| LIFF ID | — | `NEXT_PUBLIC_LIFF_ID`（診断共有） / `_SHARE`（共有ボタン） / `_TORISETSU_REDIRECT`（連携リダイレクト） |

> LIFF id_token の検証は `lib/liff-verify.ts`（LINE Verify API に複数チャンネルIDで順次照会）。ただし主要導線はサーバ側 Cookie セッション（`wn_session`）へ移行済み。

### Stripe 決済が絡む導線（現状の所在）

確認できた決済導線は次の通り。**Checkout は本番稼働、AI生成は webhook で確定**。

1. **真のトリセツ生成（¥500）**: `/integrated/new` → `POST /api/checkout/create-session`（`getPremiumPriceId()` の price で line_items 作成、要セッション・email）→ Stripe Checkout → `success_url=/checkout/success?session_id=...` → ポーリング → `/integrated/[id]`。
2. **友達評価1件アンロック（¥500）**: `POST /api/checkout/create-perception-unlock-session`（所有権確認 + 二重課金防止 409）→ Stripe Checkout。
3. **決済確定**: `POST /api/webhook/stripe`（`stripe.webhooks.constructEvent` で署名検証）→ `checkout.session.completed` で `payment_history` / `integrated_trisetsu` を INSERT → `after()` で 🤖 `runAIGenerationAndUpdate()`（最大100秒）をキック。
4. **ステータス確認**: `/api/checkout/status`（webhook 反映前のポーリング用）。
5. **特商法表記**: `/legal/commerce` 💳。

> 補足: `POST /api/integrated-trisetsu`（手動生成）は **本番（`VERCEL_ENV==='production'`）では 410 を返す** dev/preview 限定の経路（`route.ts:34-42`）。本番の真のトリセツ生成は **Stripe webhook 経由のみ**。

---

## ③ 外部サービス連携図

どのページ / API が、Supabase / Stripe / LINE / Claude / Resend / Slack のどれを呼ぶか。

```mermaid
flowchart LR
    subgraph CLIENT["クライアント（ページ）"]
        pDiag["/diagnosis"]
        pFriend["/friend/[inviteCode]"]
        pHub["/friend-evaluation 🔒"]
        pIntNew["/integrated/new 🔒💳"]
        pIntId["/integrated/[id] 🤖"]
        pMine["/zukan-mine 🔒"]
        pLogin["/login"]
    end

    subgraph API["APIルート（src/app/api）"]
        aDiag["/api/diagnosis"]
        aFA2["/api/friend-answer/v2"]
        aZukanMine["/api/zukan-mine 🔒"]
        aCheckout["/api/checkout/*"]
        aWebStripe["/api/webhook/stripe 🔒署名"]
        aWebLine["/api/webhook/line 🔒署名"]
        aIntegrated["/api/integrated-trisetsu (POST)<br/>dev/preview限定"]
        aPdf["/api/integrated-trisetsu/[id]/pdf 🔒"]
        aMagic["/api/auth/*"]
        aCron["/api/cron/remind-friend-eval 🔒"]
        aAdmin["/api/admin/*  🔒"]
    end

    subgraph LIB["共通ロジック（src/lib）"]
        libAnthropic["anthropic-client.ts<br/>integrated-trisetsu-generator.ts<br/>ai-prompt-builder.ts"]
        libStripe["stripe-server.ts"]
        libLine["line-notify.ts / line-flex.ts"]
        libLiff["liff-verify.ts"]
        libSession["session.ts"]
    end

    subgraph EXT["外部サービス"]
        SUPA[("Supabase<br/>service_role")]
        STRIPE["Stripe 💳"]
        CLAUDE["Claude / Anthropic API 🤖<br/>Opus（7章生成）"]
        LINEAPI["LINE Messaging / Verify API"]
        RESEND["Resend（メール）"]
        SLACK["Slack（アラート）"]
    end

    %% client -> api
    pDiag --> aDiag
    pFriend --> aFA2
    pHub --> aZukanMine
    pMine --> aZukanMine
    pIntNew --> aCheckout
    pIntId --> aPdf
    pLogin --> aMagic

    %% api -> lib / ext
    aDiag --> SUPA
    aFA2 --> SUPA
    aFA2 --> libLine
    aZukanMine --> libSession --> SUPA
    aCheckout --> libStripe --> STRIPE
    aCheckout --> SUPA
    aWebStripe --> STRIPE
    aWebStripe --> SUPA
    aWebStripe --> libAnthropic
    aWebStripe --> libLine
    aWebStripe --> RESEND
    aWebStripe --> SLACK
    aIntegrated --> libAnthropic
    aIntegrated --> SUPA
    aPdf --> SUPA
    aPdf -. "LIFF id_token 検証" .-> libLiff
    aWebLine --> libLine
    aWebLine --> SUPA
    aMagic --> SUPA
    aMagic --> RESEND
    aCron --> libLine
    aCron --> SUPA
    aAdmin --> SUPA
    aAdmin --> libLine

    %% lib -> ext
    libAnthropic --> CLAUDE
    libAnthropic --> SUPA
    libLine --> LINEAPI
    libLiff --> LINEAPI
    libStripe --> STRIPE

    classDef ext fill:#eef,stroke:#446;
    class SUPA,STRIPE,CLAUDE,LINEAPI,RESEND,SLACK ext;
```

### 連携サマリ

| 外部サービス | 主用途 | 呼び出し元（確認済み） |
| --- | --- | --- |
| **Supabase**（service_role） | DB全般（users / friend_answers / friend_perceptions / integrated_trisetsu / events / magic_links / line_users 等）。認可後に admin 権限で操作 | ほぼ全 API ルート（`lib/supabase-server.ts` の `supabaseAdmin`） |
| **Claude / Anthropic** 🤖 | 真のトリセツ7章を生成（Opus、max_tokens 16000、parse失敗時リトライ） | `lib/anthropic-client.ts` ← `integrated-trisetsu-generator.ts` ← ①`/api/webhook/stripe`（本番）②`/api/integrated-trisetsu` POST（dev/preview） |
| **Stripe** 💳 | Checkout Session 作成（真のトリセツ・友達評価アンロック）+ Webhook 署名検証・決済確定 | `/api/checkout/*`, `/api/webhook/stripe`（`lib/stripe-server.ts`） |
| **LINE Messaging API** | Push / Flex 通知（welcome / 友達評価到着 / 決済受領 / 統合完成 / リマインド）。feature flag `LINE_NOTIFICATIONS_ENABLED` 制御 | `/api/friend-answer*`, `/api/webhook/*`, `/api/cron/*`, `/api/admin/*`（`lib/line-notify.ts` / `line-flex.ts`） |
| **LINE Verify API** | LIFF id_token 検証（複数チャンネルID順次照会） | `lib/liff-verify.ts` ← PDF ダウンロード等（主要導線は Cookie セッションへ移行済み） |
| **Resend** | メール送信（マジックリンク / 友達評価到着 / 統合完成通知） | `/api/auth/*`, `/api/friend-answer/v2`, `/api/webhook/stripe` |
| **Slack** | 運営者向けエラー / 統計アラート | `/api/webhook/stripe`, generator 失敗時 |

---

## 補足・注意

- 本ドキュメントは `src/app` / `src/lib` の実コードから確認できたルート・処理のみを記載。`/api/settings/notifications` は現状 410（Phase 2 凍結）、`/api/integrated-trisetsu` POST は本番 410（dev/preview 限定）。
- `/friend`（旧10問）はコード上存在するが、現行フローのメインは `/friend/[inviteCode]`（30問）。
- セッションは Cookie `wn_session`（httpOnly / Secure / SameSite=Lax、`lib/session.ts`）。`/api/session/clear` で共用端末から離脱可能。
