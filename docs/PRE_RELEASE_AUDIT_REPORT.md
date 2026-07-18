# Pre-Release Audit Report

監査日: 2026-05-10
対象: ワタシのトリセツ (リリース 2026-06-01)
スタック: Next.js 16.2.4 (App Router, Turbopack) / React 19.2.4 / TypeScript 5 / Tailwind v4 / Supabase / @line/bot-sdk 11 / @line/liff 2.28

## エグゼクティブサマリー

12 章 (75+ 確認項目) の監査の結果、合計 50 件の問題を発見しました (Critical 2 / High 9 / Medium 21 / Low 10 / Info 8)。

最大の懸念は **Supabase の RLS ポリシーが事実上ノーガード** であること、および **`/api/line-resolve` で他人の owner_token を取得できる** ことです。これら 2 件の Critical を放置するとリリース直後に「他人のトリセツを覗き見できる」「全ユーザーの診断データが匿名で改竄できる」状態になり、サービスの根幹である「友達と一緒に作る、自分の取扱説明書」という信頼コンセプトが破壊されます。

加えて Chapter 2 (API セキュリティ) に High が 4 件集中しており、owner_token / invite_code / line_user_id を経由したなりすまし系の脆弱性が直列にあります。これらは個別の小さな修正の積み重ねで解消できますが、**リリース日 (2026-06-01) より前に必ず対応** が必要です。

技術品質面 (Chapter 5/6/10/11) は概ね高水準で、TypeScript 型エラー 0、build 成功、SEO/プラポリ整備、フッター・お問い合わせ導線などはむしろ模範的です。lint warnings (React 19 set-state-in-effect 系 11 件) や巨大な PNG 画像 (1〜2MB × 13 枚) も体験影響度を限ると Medium 以下に留まります。

総じて、**コード品質・体験設計は良好だが、データレイヤー (Supabase RLS + 認可設計) のセキュリティが未成熟** という特徴的なプロファイルです。

## リリース判定

### ❌ No-Go (現状のままリリース不可)

**判定根拠**:
- Critical が 2 件存在 (機械的判定: Critical 1 件以上で No-Go)
- Chapter 2 + 3 (セキュリティ + DB) に High が集中 (Ch2: 4 件、Ch3: 1 件)
- 攻撃の難度が低く、実害が大きい (なりすまし、データ漏洩、データ改竄)

**Conditional Go への切替条件**:
- 必須対応リスト (下記) の Critical 2 件 + High 8 件 を全て解消
- Chapter 12 のリリース実機チェックを完了

## 必須対応リスト (リリース前に絶対対応)

> リリース日 2026-06-01 までに完了させること。技術的難度は高くなく、合計 1〜2 営業日で対応可能と推定。

### Critical (2 件)

1. **[Ch3 Critical]** `supabase/schema.sql` の RLS ポリシーを `using (true)` から service_role 限定に変更
   - 全テーブル (users / friend_answers / events / line_users / feature_optins) の select / update / delete を service_role 専用に絞る
   - 同時に `SUPABASE_SERVICE_ROLE_KEY` を Vercel に追加し、`src/lib/supabase-server.ts` を新設して全 `/api/*` で使用
   - 影響範囲: 9 つの API ルート + lib/line-notify.ts の supabase 利用箇所
2. **[Ch2 Critical]** `/api/line-resolve` の認可追加
   - LIFF ID トークンを Authorization: Bearer で受け取り、サーバ側で `https://api.line.me/v2/profile` 検証
   - または短期的には endpoint 廃止 + share / torisetsu/redirect ページの「自分の owner_token 解決」フローを別実装

### High (8 件)

3. **[Ch2 High]** `/api/friend-info?code=...` から owner_token を返すのをやめる (友達画面の "覗き見" モーダル仕様変更とセット)
4. **[Ch2 High]** `/api/user` PATCH の認可を ownerToken 必須に。inviteCode 単体での display_name 書換禁止
5. **[Ch2 High]** `/api/line-register` に LIFF ID トークン検証を追加
6. **[Ch2 High]** `generateCode()` を `Math.random()` から `crypto.randomBytes()` ベースに変更 (`src/app/api/diagnosis/route.ts`)
7. **[Ch1 High]** `ADMIN_KEY` を 32 文字以上のランダム値に変更し Vercel 本番に再投入 (`torisetsu2026` のような推測しやすい値を排除)
8. **[Ch4 High]** `/api/friend-answer` の friend_count race condition 対策 (last_notified_friend_count カラムの atomic update など)
9. **[Ch8 High]** `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/global-error.tsx` を追加 (日本語マスコット付きエラー UI)
10. **[Ch9 High]** CSRF 対策 (Origin ヘッダー検証ヘルパー) を `/api/{diagnosis,event,friend-answer,line-register,user}` に追加

## 推奨対応リスト (リリース後 1 週間以内)

### Medium 優先 (体験 / 運用品質)

11. **[Ch4 Medium]** /api/friend-answer に idempotencyKey または friend session unique 制約 (再 submit 防止)
12. **[Ch4 Medium]** /api/diagnosis 失敗時のエラー UI 追加 (現在は無音 fallback)
13. **[Ch5 Medium]** ESLint react-hooks/set-state-in-effect エラー 11 件を修正 (React 19 推奨パターン)
14. **[Ch6 Medium]** ペンギン PNG 画像を WebP 変換 + 200-300 KB 程度に圧縮
15. **[Ch7 Medium]** safe-area-inset 対応 (iPhone X 系対応)
16. **[Ch8 Medium]** 全 /api/* に try/catch ラップ (現在 line-register と webhook のみ)
17. **[Ch9 Medium]** `next.config.ts` に headers() ブロック追加し X-Frame-Options を SAMEORIGIN (LIFF ページ除く)
18. **[Ch11 Medium]** プラポリの Cloudflare 記載と実 DNS 設定の整合性確認
19. **[Ch2 Medium]** レートリミット実装 (Vercel Edge Middleware + Upstash Redis)
20. **[Ch3 Medium]** users.source_user_id, events.session_id へ index 追加

### Low 優先 (改善余地)

21. **[Ch5 Low]** `as any` (admin/stats) のジェネリック化 + 不要 disable directive 削除
22. **[Ch6 Low]** /report で recharts を next/dynamic 化
23. **[Ch8 Low]** LIFF 初期化失敗時の自動 retry
24. **[Ch10 Low]** `public/ogp.png` (旧) 削除
25. **[Ch2 Low Info]** `/api/admin/*` の ADMIN_KEY 比較を `crypto.timingSafeEqual` 化

## ユーザー実施項目 (Chapter 12)

Chapter 12 のリリース実機チェック (環境変数 / DNS / LIFF / Webhook / メール / GA / Search Console / OGP プレビュー / 管理画面動作 / 旧ドメイン処理など 11 セクション) は本ドキュメント末尾参照。リリース前後の運用者タスクとして必ず順次実施すること。

---

## Chapter 1: 環境変数 + シークレット管理

### 監査サマリー
- 確認項目数: 8
- 発見問題数: 4
- 重要度内訳: Critical 0 / High 1 / Medium 2 / Low 0 / Info 1

### 発見事項

#### 🟠 [High] Supabase クライアントが anon key 単一構成 (service_role 未使用)
- ファイル: `src/lib/supabase.ts`
- 内容: アプリ全体で唯一の Supabase クライアントが `NEXT_PUBLIC_SUPABASE_ANON_KEY` を使って `createClient` している。`SUPABASE_SERVICE_ROLE_KEY` は環境変数にも存在せず、サーバ側 API ルート (line-register, friend-answer, admin/* など) もすべて anon key で書き込み・更新を行う。これは Chapter 3 の RLS ポリシー (anyone can insert/update/select) と組み合わさって、**ブラウザ JS から Supabase REST API を直叩きすれば誰でも全テーブルに書ける** 状態を意味する。
- リスク: 本番でクライアント JS を読めば anon key が露出 (ビルド成果物にハードコード)、攻撃者は `events` 改ざん / 任意 `users` insert / `display_name` 上書き / `line_users` レコード追加 / `friend_answers` 大量投入 等が可能。RLS で守られていないので API ルート経由でなくとも実行できる。
- 推奨修正: (a) RLS ポリシーを最低限「insert は誰でも、select/update は service_role のみ」に絞る (b) サーバ用に `SUPABASE_SERVICE_ROLE_KEY` を追加し、`/api/*` 配下の route.ts 用に `lib/supabase-server.ts` を新設、admin / write 系ルートはこれを使う。

#### 🟡 [Medium] `.env.local` がリポジトリと同じディレクトリに平文で実在
- ファイル: `/Users/wakan/Desktop/watashi-no-torisetsu/.env.local`
- 内容: `.gitignore` の `.env*` で除外されており `git ls-files | grep .env` 結果も空のため Git には載っていないが、ローカルに `LINE_CHANNEL_ACCESS_TOKEN` (本物トークン) と `LINE_CHANNEL_SECRET` 等が平文で存在する。誤って共有 (zip / dropbox / Slack) されるリスクは存在する。
- リスク: 本物トークン漏洩 → なりすまし push / 既存友達への spam / webhook 偽装。
- 推奨修正: 共有時は `.env.local` を必ず除外する運用ルール明文化 (CLAUDE.md などに記載)。万が一漏れた場合の rotate 手順を決めておく。

#### 🟡 [Medium] `LIFF_ID_SHARE` (server-side fallback) 環境変数が想定リストにあるが実 env に未投入
- ファイル: `src/lib/line-flex.ts:14`
- 内容: コードは `process.env.NEXT_PUBLIC_LIFF_ID_SHARE ?? process.env.LIFF_ID_SHARE ?? ""` の順で参照する。`.env.local` には `NEXT_PUBLIC_LIFF_ID_SHARE` も `LIFF_ID_SHARE` も存在しない。welcome flex / N1/N2/N3 通知の「他己評価を増やす」ボタン / report ボタンの share URL は最終的に `/friend/{inviteCode}` の **web URL** にフォールバックするので致命的ではないが、LIFF を使った直接シェアにならない。
- リスク: LINE 通知のボタン体験劣化。LIFF shareTargetPicker が起動せず、Web 友達招待ページにジャンプ。
- 推奨修正: Vercel Production / Preview の env に `NEXT_PUBLIC_LIFF_ID_SHARE` を必ず投入。Chapter 12 のチェックリストに含める。

#### ℹ️ [Info] `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT` / `ADMIN_KEY` (本番値) も `.env.local` に未記載
- ファイル: `.env.local`
- 内容: ローカル `.env.local` には Supabase / LINE 基本キー + `NEXT_PUBLIC_LIFF_ID` + `ADMIN_KEY=torisetsu2026` のみ。GA や検索コンソール検証コード、torisetsu redirect LIFF ID は Vercel 側に設定されている前提。本番設定は Chapter 12 で必ず確認すること。
- リスク: GA / Search Console 連携漏れ、`ADMIN_KEY` が `torisetsu2026` のような推測しやすい値のまま本番投入されると `/admin` パネル + admin API 全てが侵害される。
- 推奨修正: ADMIN_KEY を 32 文字以上のランダム文字列に変更し Vercel に投入。`.env.local` のサンプル値はあくまで開発専用と明記。

### 安心ポイント
- `.gitignore` に `.env*` が正しく含まれており、`git ls-files | grep .env` 結果は空 → コミット履歴にシークレット混入なし。
- `next.config.ts` は完全に空、`env:` ブロックでクライアント露出させていない。
- `process.env` 参照箇所を全列挙したが、`NEXT_PUBLIC_` プレフィックスが付いている変数 (SITE_URL / GA_MEASUREMENT_ID / GOOGLE_SITE_VERIFICATION / LIFF_ID / LIFF_ID_SHARE / LIFF_ID_TORISETSU_REDIRECT / DEVELOPER_NAME) はすべて公開しても問題ないもの。シークレット (LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN / ADMIN_KEY) は `NEXT_PUBLIC_` プレフィックスなし。
- ハードコードされたトークン / API key / secret は `src/` 配下にゼロ (grep 確認済)。

## Chapter 2: API ルートのセキュリティ

### 監査サマリー
- 確認項目数: 12
- 発見問題数: 8
- 重要度内訳: Critical 1 / High 4 / Medium 2 / Low 0 / Info 1

### 発見事項

#### 🔴 [Critical] `/api/line-resolve` が誰でも他人の owner_token を取得できる
- ファイル: `src/app/api/line-resolve/route.ts`
- 内容: `GET /api/line-resolve?lineUserId=...` は認証なしで誰でも呼べ、与えられた `lineUserId` に紐付く `owner_token` / `display_name` / `invite_code` をそのまま返す。LINE userId は秘密情報ではなく (LIFF を持つ別アプリで取得可、また 33 文字 `U` プレフィクスなので頑張れば総当たりも理論上不可能ではない)、攻撃者が他人の LINE userId を入手すれば その人の **完全版トリセツ閲覧 URL になる owner_token** を奪える。
- リスク: 他人の `/report/{ownerToken}`, `/result/{ownerToken}`, `/zukan/{ownerToken}` 全部閲覧可能。さらに owner_token は `/api/user` PATCH の認証キーにもなっているため display_name 改ざんもできる。
- 推奨修正: (a) この API はサーバ間呼び出しを想定していないので、route 内で **LIFF access token を `Authorization: Bearer` で受け取り `https://api.line.me/v2/profile` で検証** してから lineUserId を信頼する。または (b) LIFF ID Token を JWT 検証する。最低限、本人確認なしに owner_token を返すのは即停止すること。

#### 🟠 [High] `/api/user` PATCH が invite_code 単体で display_name を書き換え可
- ファイル: `src/app/api/user/route.ts`
- 内容: `inviteCode` または `ownerToken` のどちらか一方で `display_name` 更新できる。`inviteCode` は **友達招待 URL の一部 (`/friend/{inviteCode}`)** で公開されるもの。リンクを受け取った友達 (またはその先に転送された人) は同じ inviteCode を使って本人の display_name を任意の文字列に書き換えられる。
- リスク: 本人になりすました不適切な名前 (中傷文言や卑語) を表示させる。`/friend/{inviteCode}` のオーナー名表示・LINE 通知 sender 名にもこの値が出る可能性。
- 推奨修正: PATCH を `ownerToken` のみで認可する。`inviteCode` での display_name 変更は廃止。

#### 🟠 [High] `/api/line-register` が認証なしで line_users マッピングを上書き可能
- ファイル: `src/app/api/line-register/route.ts`
- 内容: `{ ownerToken, lineUserId, displayName }` を受け取り、`line_users` テーブルに存在すれば `owner_token` を上書き、なければ insert する。両方とも自由入力で、認証 (LIFF ID トークン検証等) はない。攻撃者は被害者の owner_token (例: 友達招待リンクの URL ハッシュとセットで漏洩しやすい) と任意の自分の lineUserId を投げて、被害者宛 LINE 通知を自分に届かせる、あるいは被害者の友達回答到達通知を奪うことができる。逆に `lineUserId` 既知の他人に偽の `owner_token` を紐付けて誤通知させることも可能。
- リスク: LINE 通知の取り違え / 横取り。welcome flex には invite_code が埋まっているため、被害者の他己評価リンクが攻撃者宛に流れ被害者の他己評価データに干渉できる。
- 推奨修正: LIFF ID トークン (`liff.getIDToken()`) または LIFF access token をリクエストに添付させ、サーバで検証して `lineUserId` を Server で確定する。クライアント自己申告を信頼しない。

#### 🟠 [High] owner_token / invite_code 生成に `Math.random()` を使用 (CSPRNG ではない)
- ファイル: `src/app/api/diagnosis/route.ts:4-11`
- 内容:
  ```ts
  function generateCode(length: number) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  ```
  これで invite_code (8 文字) と owner_token (16 文字) を生成。`Math.random()` は暗号学的に安全でなく、Node.js v8 系の状態を観測することで予測可能性を推定できる学術成果がある。owner_token の事実上の名前空間は 36^16 ≒ 2^82 だが、PRNG が偏った場合の総当たり時間がさらに短縮される。
- リスク: 第三者が新規ユーザーを作成しつつ Math.random の状態を逆算 → 直近の他人の owner_token を推測 → 本人になりすまして report 閲覧 / display_name 書換 / line_users 紐付け。
- 推奨修正: `import crypto from "crypto"` の `crypto.randomBytes(16).toString("base64url")` 等に置き換える。invite_code は短くてもよいが衝突回避と推測困難性のため最低 `crypto.randomBytes(8).toString("base64url")` で 12 文字以上を推奨。

#### 🟡 [Medium] LINE Webhook の冪等性が welcome 以外のイベントで未保証
- ファイル: `src/app/api/webhook/line/route.ts`
- 内容: follow イベントは `line_users.welcome_sent_at` チェックで重複送信を防ぐ実装が `sendWelcomeMessage` 内にあり OK。ただし postback イベント (`coming_soon` / `optin`) には event ID / webhookEventId に基づく冪等チェックがなく、LINE が同じ event を at-least-once 配信した場合に reply 失敗 (replyToken 既使用 400 エラー) が起きる。本コードは catch して握りつぶすため致命的ではないが、`feature_optins` の `unique(line_user_id, feature)` 制約があるので DB は守られている。reply エラーログだけが多発する形。
- リスク: error ログ膨張、ユーザー側にエラー文言が出ない代わりに reply が届かないケースが稀に発生 (再 follow 直後など)。
- 推奨修正: webhook の `events[i].webhookEventId` を `events` テーブルに保存し、既処理ならスキップ。MVP リリース後の改善で十分。

#### 🟡 [Medium] レートリミット未実装 (全エンドポイント)
- ファイル: 全 `/api/*` ルート, `next.config.ts` (空)
- 内容: レートリミット / WAF / Bot 防御の実装が一切ない。`/api/event` (KPI 計測 → events テーブル直書き) と `/api/diagnosis` (users テーブル直書き) は最も悪意ある書き込みに弱い。Vercel の Edge ネットワークが多少緩和してくれるが、明示的な rate limit ナシ。
- リスク: events / users テーブルへの大量レコード作成 → Supabase 容量・帯域消費 + 統計汚染。
- 推奨修正: リリース後 1 週間以内に Vercel Edge Middleware か Upstash Redis ベースで `/api/diagnosis`, `/api/friend-answer`, `/api/event`, `/api/line-register` に IP/sessionId 単位の rate limit を入れる。

#### ℹ️ [Info] `/api/admin/*` の ADMIN_KEY 検証は機械的に正しいが timing-safe 比較ではない
- ファイル: `src/app/api/admin/{simulate-follow,stats,test-line-notify,welcome-status}/route.ts`, `src/app/api/report/route.ts:147`
- 内容: `key !== adminKey` の通常比較を使用。理論上はタイミング攻撃で文字単位の推測が可能だが、Node.js + V8 + ネットワーク遅延の前では現実的脅威ではない。本番 ADMIN_KEY を 32 文字以上のランダム値にすれば実害ゼロ。
- 推奨修正: `crypto.timingSafeEqual` を使えば理想的だが、優先度は低い。

### 安心ポイント
- LINE Webhook 署名検証 (`verifySignature` in `src/app/api/webhook/line/route.ts:21-32`) は `crypto.timingSafeEqual` を使用、長さチェック付き。HMAC-SHA256 + Base64 比較で LINE 公式仕様通り。
- `/api/admin/*` は全エンドポイントで `x-admin-key` ヘッダ検証あり。
- `/api/report` の `?dev=true&adminKey=...` 認可も同じ ADMIN_KEY ロジックで守られている。
- エラーレスポンスは `{error: string}` の形式で、スタックトレースを露出しない (`error.message` は Supabase 由来の場合に若干露出するが Critical ではない)。
- `/api/friend-info` は `display_name` と `owner_token` を返すが、これは intentional (友達ページでオーナー名表示と LIFF 共有用)。invite_code は URL でもう公開されているので追加情報なし。**ただし owner_token を返すのは line-resolve と同様の問題で、invite_code 単独で owner_token が漏れる**: 上記 line-resolve の Critical と同根の問題。— **追加 High 候補**:

#### 🟠 [High] `/api/friend-info?code={inviteCode}` が認証なしで owner_token を返す
- ファイル: `src/app/api/friend-info/route.ts:21-24`
- 内容: invite_code は他己評価依頼として LINE で配布される公開 ID。それを GET するだけで owner_token も合わせて返してしまう。owner_token は本人の report / result / zukan / display_name PATCH の認可キーであり、招待した友達が誰でも本人の完全版トリセツを閲覧・なりすまし可能になる。`/friend/[inviteCode]/page.tsx` の「友達のトリセツをのぞいてみる」ボタンの裏付けで意図的に owner_token を返している実装だが、設計上これは漏れすぎ。
- リスク: 友達招待 URL を受け取った任意の人 (転送された見ず知らずの第三者含む) が `/report/{ownerToken}` を取得・閲覧できる。owner_token を使った PATCH /api/user で display_name 改竄も可能。
- 推奨修正: owner_token を返さない。代わりに「友達 plain ビュー専用 token」を新設するか、`/result?code=...` を使ってオーナーの結果概要だけを表示する別 API に分ける。最低でも report の閲覧は ownerToken でなくサーバ側 session で守る形に。

(High は + 1 で計 4 件。Critical 1 + High 4 = この章単独で No-Go 判定)

## Chapter 3: データベース整合性 + RLS

### 監査サマリー
- 確認項目数: 8
- 発見問題数: 5
- 重要度内訳: Critical 1 / High 1 / Medium 2 / Low 0 / Info 1

### 発見事項

#### 🔴 [Critical] RLS ポリシーが「anyone can insert/select/update」で実質無効化
- ファイル: `supabase/schema.sql:33-38, 55-56, 80-82, 97-98`
- 内容: 全テーブル (users / friend_answers / events / line_users / feature_optins) で `enable row level security` は有効だが、policy がすべて `using (true)` / `with check (true)` で書かれている。これは anon key を持つ任意のクライアント (= NEXT_PUBLIC_SUPABASE_ANON_KEY をビルド成果物から拾った任意の第三者) が PostgREST 経由で全データの SELECT / INSERT / UPDATE が可能であることを意味する。
- リスク: (a) `users` テーブルから全 owner_token / invite_code / scores / display_name を一括ダウンロード → 全ユーザーのトリセツ完全閲覧 (b) `friend_answers` の任意改竄で診断結果歪曲 (c) `display_name` を全件「○○な性格」のような中傷文言で書き換え (d) `events` の汚染で KPI 統計破壊。
- 推奨修正: リリース前必須。最低限以下に絞る:
  - `users` insert: anon 可 / select: service_role のみ / update: service_role のみ (display_name 更新は API 経由で service role が行う)
  - `friend_answers` insert: anon 可 / select: service_role のみ
  - `events` insert: anon 可 / select: service_role のみ
  - `line_users` 全部 service_role のみ
  - `feature_optins` 全部 service_role のみ
  そして Chapter 1 で指摘した service_role クライアントを `/api/*` 配下で使うように修正。
- 補足: スキーマファイルの 32 行目に「-- anon ユーザーの読み書きを許可（MVP 用、後で絞る）」というコメントあり。**「後で」がリリースの直前**であることを明示する。

#### 🟠 [High] friend_answers の競合: ほぼ同時 submit 時の friend_count 通知の二重トリガリスク
- ファイル: `src/app/api/friend-answer/route.ts:23-41`
- 内容: insert 直後に `count: "exact", head: true` で件数を取って `notifyFriendAnswered(ownerToken, count)` を fire-and-forget で呼ぶ。3 人がほぼ同時に submit すると、insert と count の間に他クライアントの insert が混入し、3 人とも `count = 3` を観測 → N3 flex (完成通知) が 3 回送信される、または 1 が 2 回・3 が 1 回などの不整合通知になる可能性がある。N3 が二重送信されるとユーザー体験的に違和感 (「ついに 3 人揃った」が 2 回来る) があり、verbose な KPI 汚染にもなる。
- リスク: 体験劣化 + LINE 月間メッセージ数浪費。
- 推奨修正: (a) `users` テーブルに `last_notified_friend_count` カラムを追加し UPDATE … SET last_notified = N WHERE last_notified < N の条件付き更新成功時のみ通知する (atomic) (b) または PostgreSQL の関数で SELECT … FOR UPDATE を使う (c) 最低限、count が 1/2/3 のいずれかであることをチェックして 4+ は silent skip する既存ロジックを残しつつ、二重通知抑止のフラグを line_users 側に持つ。
- 重要度: 通知二重化はユーザー視認の不具合だが、致命的ではない。MVP リリース時はリスク受容して後追い改善でも可。

#### 🟡 [Medium] N+1 クエリ — `/api/admin/stats` で複数 select を `Promise.all` 並列化しているが users 全件 + friend_answers 全件をフルスキャン
- ファイル: `src/app/api/admin/stats/route.ts:39-129`
- 内容: 並列ながら 15 個の select を発行し、users / friend_answers は範囲フィルタはあるものの全件取得 → JS で集計。リリース直後 100 ユーザー程度なら問題ないが、スケールすると重くなる。
- リスク: 管理画面の応答遅延、Supabase row read コスト増。
- 推奨修正: いずれ集計を SQL view / Postgres function に寄せる。MVP では問題なし。

#### 🟡 [Medium] 外部キー制約は十分だが index 不足の可能性
- ファイル: `supabase/schema.sql`
- 内容: index は `users.invite_code`, `users.owner_token`, `friend_answers.user_id`, `events.event_name`, `events.created_at`, `line_users.{owner_token,line_user_id,welcome_sent_at}`, `feature_optins.{line_user_id,feature}` と十分。ただし `users.source_user_id` (Chapter 4 zukan で descendants 検索に使う) と `events.session_id` / `events.owner_token` には index がなく、users が増えると zukan API と admin/stats が遅くなる。
- 推奨修正: リリース後、トラフィックを見ながら必要に応じて `create index if not exists ... on users(source_user_id);` `create index if not exists ... on events(session_id);` などを追加。

#### ℹ️ [Info] テストデータ検出 SQL クエリ案
- 推奨: 本番リリース前に Supabase SQL Editor で以下を実行し、テストデータを掃除すること。
```sql
-- テスト名前 / コメント検索
SELECT id, display_name, type_id, created_at FROM users
WHERE display_name ILIKE '%test%'
   OR display_name ILIKE '%テスト%'
   OR display_name ILIKE '%dev%'
   OR display_name ILIKE '%サンプル%'
ORDER BY created_at DESC LIMIT 100;

-- generation null かつ campaign null = テスト診断の可能性
SELECT count(*) FROM users
WHERE generation IS NULL AND campaign IS NULL;

-- friend_answers が 5 件以上同一 user_id でテスト
SELECT user_id, count(*) FROM friend_answers
GROUP BY user_id HAVING count(*) > 5
ORDER BY count(*) DESC;

-- 直近 7 日の users / events 件数
SELECT date_trunc('day', created_at), count(*) FROM users
WHERE created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;
```

### 安心ポイント
- `friend_answers.user_id` に `on delete cascade` の外部キーが設定されており、users 削除時の orphan を防げる。
- `line_users` の `line_user_id` は unique 制約あり。
- `feature_optins` は `unique(line_user_id, feature)` 制約あり。webhook の重複 optin で安全に upsert できる。
- 全テーブルに `created_at` あり。監査・分析しやすい。

## Chapter 4: クリティカルユーザーフロー

### 監査サマリー
- 確認項目数: 4 フロー × 各 5-7 観点
- 発見問題数: 6
- 重要度内訳: Critical 0 / High 1 / Medium 4 / Low 1 / Info 0

### Flow A: 自己診断 → 仮トリセツ (LP → /diagnosis → 結果保存 → /result/[token])

#### 検証ポイント
- LP `/` の "無料で診断する" → `/diagnosis` 遷移: OK
- `/diagnosis` で 15 問回答 → `diagnose()` でローカル判定 → `/api/diagnosis` POST で users insert → `/result/[ownerToken]` 遷移
- localStorage に owner_token / invite_code 保存。ブラウザバック対応 (戻るボタン UI あり)
- 最低 20 秒 (`MIN_LOADING_MS`) のローディング演出あり

#### 🟡 [Medium] /api/diagnosis 失敗時のフォールバックが暗黙に「結果が永続化されない」状態を生む
- ファイル: `src/app/diagnosis/page.tsx:109-113`
- 内容: API 呼び出し catch 時 `router.push("/result")` → `/result` (token なし) に遷移し、localStorage に保存された結果を表示するが、owner_token なしなので友達招待 URL が作れず、LINE 連携も不能。エラーメッセージも出ない。
- リスク: Supabase 障害時にユーザーは「結果が出たがシェアできない」状態になり、原因不明の機能不全を体験。
- 推奨修正: catch でエラー UI を出して「もう一度送信」ボタンを提示、または submitError state を立てる (friend-answer 側は実装済なので同じパターン)。

#### 🟢 [Low] `useEffect` 内 `tracked.current` ガードに依存配列 `[]` で diagnosis_started が依存配列の lint warning ではなく動作意図的だが、Strict Mode の double mount (dev) で念のため OK
- 内容: 問題なし。本番では一度だけ発火。

### Flow B: 友達招待 → 他己評価 (/share → /friend/[code] → 回答 → 通知)

#### 検証ポイント
- /share で LIFF shareTargetPicker を起動。invite_code 取得経路は (a) URL パラメータ (b) `liff.state` 内のクエリ (c) line-resolve で自分の userId から解決 — 3 段の fallback 構成。
- /friend/[inviteCode] で `/api/friend-info?code=...` で displayName / ownerToken 取得 → ownerName を質問文に差し込む (例 "○○さん")
- 10 問回答 → `/api/friend-answer` POST → `friend_answers` insert → `notifyFriendAnswered` fire-and-forget
- 完了画面で perceiveFromFriendAnswers の結果を表示 (友達側のみ)、LIFF を経由しない通常 Web ブラウザでも動作

#### 🟠 [High] 競合: 3 人がほぼ同時 submit した時の friend_count 計算と通知の race condition
- ファイル: `src/app/api/friend-answer/route.ts:23-41`
- 詳細は Chapter 3 の High 項目を参照 (insert + select count between, race で N3 Flex 重複送信 or N2 飛ばしの可能性)
- リリース直後の友達 5 人レベルでは滅多に起きない。

#### 🟡 [Medium] friend 再訪問時の挙動が不明瞭
- ファイル: `src/app/friend/[inviteCode]/page.tsx`
- 内容: 友達が同じ invite_code で 2 回 submit した場合、UI 上の制限はなく `friend_answers` に複数レコードが残る。`/api/result` でも `friend_count = friendAnswers.length` で素直に数えるので、同じ友達が 3 回回答すれば「3 人達成」と誤判定される可能性。
- リスク: friend_count 水増し。完成版トリセツの 3 人達成ロジックが歪む。
- 推奨修正: friend_answers に `(user_id, friend_session_id)` の unique 制約を追加し、回答済 sessionId が再 submit したら upsert で更新。または UI 側で localStorage に "answered_{inviteCode}" を保存し再 submit を抑止 (簡易対応)。

#### 🟡 [Medium] friend 完了画面で取得した owner_token を使ってモーダルでオーナーのトリセツを表示する経路
- ファイル: `src/app/friend/[inviteCode]/page.tsx:514-521`, `src/components/OwnerTorisetuModal.tsx`
- 内容: 友達が回答完了後に「○○さんのトリセツをのぞいてみる」ボタンを押すと、回答した友達がオーナーのトリセツを覗ける。owner_token が API から返ってきているため可能になっている (Chapter 2 で報告した friend-info の owner_token 漏洩問題の表面)。
- リスク: そもそも MVP の体験設計だが、本人の知らないうちに友達がトリセツ閲覧 → 完成版が解放される (3 人達成) 前から見られている可能性 = 本人の体験 = 「友達が答えてくれて自分のトリセツが完成する」 のサプライズ感がスポイルされる懸念。
- 推奨修正: MVP の意図的設計なら OK だが、PRD と照合して仕様意図を再確認。技術的セキュリティとは別軸の論点。

### Flow C: LINE 登録 + Webhook (line-register → line_users → follow webhook → welcome)

#### 検証ポイント
- /result/[ownerToken] の「LINE で友だち追加」ボタン → LIFF (`NEXT_PUBLIC_LIFF_ID`) URL に owner_token クエリ付き
- LIFF 内で /line-register が起動 → liff.init / login / getProfile → POST /api/line-register でマッピング保存
- LINE 友達追加状態を `liff.getFriendship()` で確認。未追加なら友達追加 URL `https://lin.ee/VbAOXrV` に誘導
- LINE 公式アカウント友達追加 → LINE 側 webhook → /api/webhook/line POST → `handleFollowEvent` → `line_users` 検索 → `welcome_sent_at` チェック → sendWelcomeMessage / sendGenericWelcome

#### 🟡 [Medium] welcome 送信タイミングが webhook 待ちで体験ラグあり
- ファイル: `src/app/api/webhook/line/route.ts`, `src/lib/line-notify.ts`
- 内容: line-register 完了直後は welcome を送らず、webhook の follow イベント到達待ち。LINE webhook 配信遅延時 (時々数秒〜数十秒) ユーザーには「友だち追加完了」だけが残り「welcome が遅れて来る」体験。コメントには「webhook 経由で送信される」と明記され仕様。
- リスク: ユーザーが welcome を待つ間に離脱。
- 推奨修正: 仕様意図ならそのまま。改善案として line-register API でも (二重送信ガード welcome_sent_at で守られているので) 安全に sendWelcomeMessage を呼んで race を勝てる側に振る方法もある。MVP 後改善で十分。

#### 🟡 [Medium] sendGenericWelcome (紐付けなし follow) は welcome_sent_at 更新しないので再 follow で何度も送られる
- ファイル: `src/lib/line-notify.ts:160-175`
- 内容: 紐付けなし bot 直接 follow → generic welcome 送信。ただし line_users にレコードがないので welcome_sent_at は記録されない。block → unblock のループで welcome が何度も届く。
- リスク: 軽度の体験劣化、LINE メッセージ枠浪費。
- 推奨修正: `line_users` に紐付けなし用の擬似レコード (owner_token NULL 許可 + line_user_id) を作り welcome_sent_at で重複防止。あるいは「直 follow user 用」別テーブルで管理。MVP 後で十分。

### Flow D: 完全版トリセツ閲覧 (/report/[token] 段階解放、他人アクセス防止)

#### 検証ポイント
- `/report/[ownerToken]` → `/api/report?token=...` で取得
- friend_count < 3 (REPORT_FRIEND_THRESHOLD) の場合は通常画面では JS 側で段階制限する想定
- dev モード (`?dev=true&adminKey=...`) で friend_count をダミーで埋めてプレビュー可能 (admin 機能)

#### 🟢 [Low] /report/[token] のクライアント側 friend_count 不足時の見せ方は `lib/report-data.ts` 内のロジック依存だが、API はフルデータを返している
- ファイル: `src/app/api/report/route.ts:194-201`
- 内容: friend_count に関係なく buildReportData で全部計算したフルレポートを返す。クライアントが UI で隠す形。これは API レスポンスを直接見れば閲覧不可セクションも見えてしまうということ。
- リスク: 段階解放のサプライズ性が API レスポンスを見ると損なわれる。実害はゼロ (本人の自分のデータ)。
- 推奨修正: 段階別にレスポンスを切る方が綺麗だが、優先度低い。

### 安心ポイント
- localStorage に owner_token / invite_code をキャッシュし、ブラウザバック・リロードで diagnosis 結果が復元される。
- /result/[token] → API fetch + localStorage hydration の二段構成で、API 失敗時もとりあえず表示される。
- friend submit エラー時の UI (`submitError` 分岐) で「もう一度送信」ボタン提供 → 良い実装。
- LIFF 初期化失敗 / liff_id 未設定 / out-of-line / login 経路すべて status state で UI 分岐 (line-register, share, torisetsu/redirect) → 防御的実装。
- session_id (`crypto.randomUUID()`) は CSPRNG。これは OK。

## Chapter 5: コード品質 / 健全性

### 監査サマリー
- 確認項目数: 8
- 発見問題数: 4
- 重要度内訳: Critical 0 / High 0 / Medium 2 / Low 2 / Info 1

### 発見事項

#### 🟡 [Medium] ESLint で 11 errors / 1 warning が検出される
- ファイル: 複数 (admin/page.tsx, line-register/page.tsx, result/[ownerToken]/page.tsx, result/page.tsx, friend/[inviteCode]/page.tsx, friend/page.tsx, share/page.tsx, components/TypeIntroModal.tsx, api/admin/stats/route.ts)
- 内容: 次のルールでエラー: `react-hooks/set-state-in-effect` (effect 内で setState を直接呼んでいる、新しい React 19 推奨パターン違反) と `react-hooks/preserve-manual-memoization` (手動 useCallback 依存配列が React Compiler の推論と一致しない)。1 warning は `@typescript-eslint/no-explicit-any` の `as any` 1 箇所 (admin/stats/route.ts:17)。
- リスク: 機能上は動くが、React 19 + React Compiler の最適化が一部スキップされる、cascading render の可能性。
- 推奨修正: リリース直前ではないが、リリース後 1 週間以内に修正推奨。`useEffect` 内 `setStatus("missing-liff")` 等の同期 setState は条件付き render で代替する。

#### 🟡 [Medium] `console.log` / `console.error` / `console.warn` が 49 箇所
- ファイル: 主に `src/lib/line-notify.ts`, `src/app/api/*/route.ts`, `src/app/{share,line-register,torisetsu/redirect}/page.tsx`
- 内容: ほとんどがエラーログ用 (`console.error(...)`) で、Vercel logs に流れることを意図した実装。デバッグログ (`console.log`) は webhook の "already sent" 等少量。本番でログ出力されるが problematic な情報露出はなし (LINE 4xx/5xx ステータスや supabase エラーメッセージ程度、stack trace はログのみでクライアントには返さない)。
- リスク: 軽い量の noise だがクライアントレスポンスには漏れていない。
- 推奨修正: そのまま運用可。長期的には pino 等の構造化ログに移行検討。

#### 🟢 [Low] `// TODO` / `// FIXME` / `// HACK` などの未完了コメントは検索結果ゼロ
- 内容: コードベースは比較的整理されている。

#### 🟢 [Low] `: any` / `as any` / `@ts-ignore` / `@ts-expect-error` は 1 箇所のみ
- ファイル: `src/app/api/admin/stats/route.ts:17`
- 内容: `let q = query as any;` を `applyRange` の汎用ヘルパー内で使用。コメントで `eslint-disable-next-line` を付けているが、実は不要な disable で warning が出ている。
- 推奨修正: `Generic` 型で書き直すか、unused disable を削除。

#### ℹ️ [Info] `npx tsc --noEmit` は 0 エラーで通過
- 内容: TypeScript 型はクリーン。Next.js 16 の型定義との整合性も問題なし。
- 補足: build 時間 10.2s (turbopack)、型チェック 3.1s。33 ページ生成 246ms。良好。

### 安心ポイント
- `npm run build` は正常完了 (Turbopack)。
- 静的解析的な型エラー / 未使用 import 警告はゼロ。
- TypeScript strict 想定の型ガード (`typeof body.x === "string"`) が API 入力に多用されている → 防御的。
- `any` 使用箇所が極少 (1 箇所)。

## Chapter 6: パフォーマンス

### 監査サマリー
- 確認項目数: 5
- 発見問題数: 3
- 重要度内訳: Critical 0 / High 0 / Medium 1 / Low 2 / Info 1

### 発見事項

#### 🟡 [Medium] ペンギン PNG 画像が 1 枚あたり 1.1〜1.9 MB と巨大
- ファイル: `public/types/*.png` (9 枚, 計 ~13 MB), `public/mascot/*.png` (4 枚, 計 ~5.3 MB)
- 内容: 例) `delicate-creator.png` 1.9MB, `step2-ask-friend.png` 1.6MB。next/image を使ってはいるが、原本がここまで大きいと初回 Optimizer 変換コストとキャッシュ消費が高い。LP の `priority` 指定 + LCP 候補画像が 1.2 MB で携帯回線 (4G ~3 Mbps) で 3 秒以上の DL になる。
- リスク: モバイル LCP > 2.5s, 大学生のスマホ環境 (5G + WiFi) なら問題薄いが、4G 圏 (講義室・電車) では離脱増。
- 推奨修正: WebP/AVIF に事前変換し 200-300 KB 程度に圧縮、または next/image の自動最適化を信頼するなら原本も含めてサイズ最適化。`<Image priority>` 指定 + `sizes` 属性追加で配信効率改善。リリース前 1 時間程度で対応可能 (sips / ImageMagick)。

#### 🟢 [Low] dynamic import (`next/dynamic`) の使用ゼロ — recharts が常にメインバンドルに含まれる
- ファイル: `src/app/report/[ownerToken]/page.tsx` で `import { Radar, RadarChart, ... } from "recharts"` を直接 import
- 内容: recharts は ~200 KB ある。/report ページは LIFF 経由 + 完成版閲覧に使うため、LP には不要なはず。動的 import に分離すれば LP の First Load JS を削減できる可能性。
- リスク: LP の初期 JS 増。ただし Turbopack は route splitting を行うので report ページコードは LP の初期 bundle には含まれていない (build output で別 chunk になる)。実害は小さい。
- 推奨修正: /report 内で chart 部分だけ next/dynamic に切る (リリース後改善)。

#### 🟢 [Low] サードパーティ /font: next/font (M_PLUS_Rounded_1c) を使用 + display: "swap" → 良好
- 内容: Self-hosted, FOIT 回避済み。weight も必要分のみ (400/500/700/800)。

#### ℹ️ [Info] Turbopack ビルドで First Load JS の出力が表示されない (Webpack と異なる)
- 内容: Next.js 16 + Turbopack の build summary は kB ベースの per-route First Load JS を出さない仕様 (執筆時点)。`.next/static/chunks/` 合計 9.1 MB だがほとんどはページ別 chunk に分かれており、route 単体ごとの First Load JS は不明瞭。実機で計測 (Chapter 12 の実機チェック) を推奨。

### 安心ポイント
- 全ての `<img>` は `next/image` に置き換え済 (grep で `<img ` 直書きゼロ)。
- フォントは next/font (Google) で self-hosted、`display: "swap"` 指定 → 表示阻害なし。
- LP・/about ページは静的生成 (○) → CDN キャッシュ効く。
- /api/* は dynamic (ƒ) のみ → Edge Cache 不要なものだけが SSR。
- LIFF (`@line/liff`) は `dynamic import` で `await import("@line/liff")` の遅延読込 → 初期 bundle から外れている。

## Chapter 7: モバイル UX

### 監査サマリー
- 確認項目数: 5
- 発見問題数: 3
- 重要度内訳: Critical 0 / High 0 / Medium 1 / Low 2 / Info 1

### 発見事項

#### 🟡 [Medium] safe-area-inset 対応なし (notch / home indicator 領域)
- ファイル: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/Footer.tsx`
- 内容: `env(safe-area-inset-*)` の参照ゼロ。`min-h-dvh flex flex-col` で全画面高さは取れているが、iPhone X 系の home indicator が下部 button (例: 診断 CTA, share button) と重なる懸念。Footer は `mt-20` で十分マージンがあるが、固定ヘッダ (`/diagnosis`, `/friend/[code]` の sticky top-0) や fixed-bottom UI (ない) はあまり影響しない。診断ページの「← 戻る」ヘッダが iOS Safari URL バー領域と重なる可能性低。
- リスク: 軽微。home indicator が footer と重なる可能性、iPhone 14/15 の dynamic island は問題なし。
- 推奨修正: layout.tsx の body に `paddingBottom: env(safe-area-inset-bottom)` を加えると安全。優先度低。

#### 🟢 [Low] iOS auto-zoom 防止: 管理画面の input が `text-sm` (14px) で 16px 未満
- ファイル: `src/app/admin/page.tsx:442-449` ほか admin 内 input 計 5 箇所
- 内容: iOS Safari は input の font-size が 16px 未満だと focus 時に自動 zoom する。/admin は管理者専用 + デスクトップ前提なので体験上の問題は小さい。ユーザー向けページ (LP / diagnosis / friend) には input が一切ないので影響無し。
- 推奨修正: 必要に応じ admin の input に `text-base` (16px) 化。優先度極低。

#### 🟢 [Low] 横画面 (landscape) 挙動の明示的ハンドリングなし
- 内容: `max-w-lg mx-auto` パターンが多用され、横画面でも中央寄せで読みやすい。問題なし。

#### ℹ️ [Info] viewport meta は Next.js 16 のデフォルト (auto-generated) を利用
- 内容: `src/app/layout.tsx` で `export const viewport` を明示宣言していないが、Next.js 16 は `<meta name="viewport" content="width=device-width, initial-scale=1">` を自動挿入する。問題なし。明示するならドキュメント上 OK。

### 安心ポイント
- モバイルファースト設計: `max-w-sm` / `max-w-lg` / `px-5` を基本とした 1 カラム前提。`md:` ブレイクポイントは LP の Step grid と一部のみ。
- フォントサイズが本文 14-16px (`text-sm` / `text-base`)、見出し 24-32px とモバイル可読。
- LIFF ページ (share, line-register, torisetsu/redirect) は中央寄せ + 縦スクロール最小設計。
- 質問選択ボタンは `py-4 / py-5` で十分な tap target サイズ。
- フォントが M PLUS Rounded で日本語表示安定。

## Chapter 8: エラーハンドリング + 復旧性

### 監査サマリー
- 確認項目数: 7
- 発見問題数: 5
- 重要度内訳: Critical 0 / High 1 / Medium 3 / Low 1 / Info 0

### 発見事項

#### 🟠 [High] `error.tsx` / `not-found.tsx` / `global-error.tsx` のいずれも未配置
- ファイル: `src/app/` 直下に該当ファイルなし
- 内容: Next.js App Router では `error.tsx` (route segment エラー境界), `not-found.tsx` (404 専用ページ), `global-error.tsx` (root error boundary) が未定義の場合、デフォルトの素っ気ない英語エラー画面が表示される。本サービスのトーンとミスマッチ + 不安感を与える。`/result/[token]` などで API 失敗時にコンポーネント内で notFound state を扱っている (個別 page.tsx で対応) が、Next.js のエラー境界としては機能していない。
- リスク: 想定外の例外 (ライブラリ throw / Server Component エラー) で英語の "Application error: a client-side exception has occurred" がそのまま見える。リリース時の体験汚染。
- 推奨修正: `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/global-error.tsx` を追加し、ペンギンマスコット + 日本語の優しい文言で表示。ボタンで `reset()` / `/` への戻り導線。優先度高、リリース前に追加すべき。

#### 🟡 [Medium] /api/* で try/catch を持つのは line-register と webhook のみ
- ファイル: `src/app/api/{diagnosis,event,friend-answer,friend-info,line-resolve,report,result,user,zukan}/route.ts`
- 内容: 上記 9 つの API ルートには try/catch がない。Supabase クライアントが throw した場合 (ネットワーク断 / DNS 失敗) は Next.js のデフォルト 500 ハンドラに流れ、ユーザーには "Internal Server Error" + 場合により stack trace のヒントが表示される (Vercel production では stack は隠される)。
- リスク: Supabase 障害時 / network error 時の応答が雑。
- 推奨修正: route 全体を try/catch でラップし `{error: "..."}` 構造化レスポンスにそろえる。リリース後 1 週間以内推奨。

#### 🟡 [Medium] 二重送信防止が一部不完全
- ファイル: `src/app/diagnosis/page.tsx`, `src/app/friend/[inviteCode]/page.tsx`
- 内容: 診断完了 submit と friend submit はどちらも `submitting` state や `tracked.current` ref で多重実行を防いでいるが、`handleAnswer` の連打 (例えば最終問の選択肢を 2 回連続クリック) で `submitting=true` 設定までの ms 内に二度発火する可能性がある (handleAnswer 内 `if (isTransitioning) return` ガードあり、isTransitioning が同期的に true 化されるため OK ではある)。`/api/friend-answer` は冪等でないため race で friend_answers が複数 insert されると Chapter 4 の重複問題発生。
- リスク: 競合条件下の重複 insert。
- 推奨修正: friend-answer を `idempotencyKey` (sessionId + inviteCode のハッシュ) ベースに変更。MVP 後で十分。

#### 🟡 [Medium] LIFF 初期化失敗時のリトライがユーザー手動 reload のみ
- ファイル: `src/app/line-register/page.tsx:215-218`, `src/app/share/page.tsx`, `src/app/torisetsu/redirect/page.tsx`
- 内容: error 状態で「もう一度試す」ボタンが `window.location.reload()` するだけ。LIFF サーバ側の一時障害なら再試行で復旧するが、ネットワーク回復待ちなどユーザー操作が必要。
- リスク: 軽度。
- 推奨修正: 自動 retry (1-2 回) + 失敗時のメッセージ強化。優先度低。

#### 🟢 [Low] エラー UI で内部メッセージ (errorMessage) を `break-all` で生表示
- ファイル: `src/app/share/page.tsx:305`, `src/app/torisetsu/redirect/page.tsx:158`, `src/app/line-register/page.tsx:213`
- 内容: `err instanceof Error ? err.message : "Unknown error"` を生表示。technical な英語が出る場面あり (例: "shareTargetPicker is not available in this environment")。
- リスク: 軽度の体験劣化。
- 推奨修正: 既知エラーは日本語マッピングし、未知のみ "通信エラー" として汎用表示。

### 安心ポイント
- ローディング表示 / 空状態 (`notFound` フラグ + 専用 UI) は主要ページで実装済 (`/result/[ownerToken]`, `/zukan/[ownerToken]`, `/report/[ownerToken]`)。
- 友達回答完了時の submit エラーは `submitError` state + 再送ボタン UI あり (良い実装)。
- LINE webhook は per-event try/catch で 1 イベントの失敗が他に波及しない。常に 200 を返す = LINE re-delivery の暴走を防ぐ。
- `notifyFriendAnswered` の fire-and-forget が `.catch(...)` で握り潰されており、LINE 障害が `/api/friend-answer` の応答を遅らせない。
- LINE pushMessage のエラーは status code 別に詳細ハンドリング (400/401/403/429/5xx) → 良好。429 は 1 回 retry 実装あり。

## Chapter 9: セキュリティ追加チェック

### 監査サマリー
- 確認項目数: 7
- 発見問題数: 4
- 重要度内訳: Critical 0 / High 1 / Medium 2 / Low 0 / Info 1

### 発見事項

#### 🟠 [High] CSRF 対策が POST/PATCH 系 API で未実装
- ファイル: `src/app/api/{diagnosis,event,friend-answer,line-register,user}/route.ts`
- 内容: 全ての書き込み系 API ルートに CSRF トークン (Origin / Referer / SameSite cookie + token) 検証なし。`Content-Type: application/json` を強制せず JSON パース時の例外もない。任意 origin から fetch される可能性。Next.js App Router の Server Actions ならフレームワーク標準で守られるが、本実装は通常 route handler で fetch ベース。
- リスク: 攻撃者サイトが `<form method=post target=hidden>` で `/api/user` PATCH を被害者ブラウザから送信し display_name を変更させる類の CSRF が理論上可能。ただし `Content-Type: application/json` を必要とするため form で完全 simple request にはならない (preflight 必要)。なので実害は限定的。owner_token / invite_code は本人ブラウザから取れないため (URL に含まれないと攻撃成立しない)、現実的には `/api/event` の汚染と `/api/diagnosis` の偽データ生成程度。
- リスク総合: Medium 寄りの High。現状 SPA 構成 + 認可情報を URL fragment / localStorage で持つため攻撃成立条件が複雑。
- 推奨修正: route handler で `request.headers.get("origin")` を許可リスト (`https://www.watashi-torisetsu.com`, LIFF URL, vercel preview URL) と照合する関数を共通化。または X-Requested-With ヘッダ要求 + クライアント fetch 全部にこれを足す。

#### 🟡 [Medium] dangerouslySetInnerHTML 使用 2 箇所 — JSON-LD のみで安全だが要確認
- ファイル: `src/app/page.tsx:40`, `src/app/about/page.tsx:89`
- 内容: 両方とも JSON.stringify(jsonLd) (Schema.org の WebApplication / FAQPage) を `<script type="application/ld+json">` に注入。jsonLd は静的オブジェクトリテラルでユーザー入力を含まない。XSS リスクは無し。
- リスク: ゼロ。
- 推奨修正: 念のため JSON.stringify の結果に対して `</script>` の `<` を `<` にエスケープすると完全に安全。実害なし。

#### 🟡 [Medium] HTTPS 強制 / HSTS / CSP / X-Frame-Options ヘッダー設定なし
- ファイル: `next.config.ts` (空)
- 内容: Vercel デフォルトで HTTPS は強制 (HTTP はリダイレクト)、HSTS ヘッダーは Vercel が自動付与。ただし CSP (Content-Security-Policy) や X-Frame-Options (clickjacking 防御) は明示設定なし。LIFF が iframe 経由で読まれる関係で X-Frame-Options DENY は実装してはいけないが、ALLOW-FROM https://liff.line.me / SAMEORIGIN は検討の価値あり。
- リスク: 軽度。clickjacking 攻撃で結果ページを iframe に埋め込み、誤クリックで意図せぬ操作させる類。
- 推奨修正: `next.config.ts` に `headers()` ブロックを追加し、LP / about / terms / privacy のみ `X-Frame-Options: SAMEORIGIN` を付与。/share, /line-register, /torisetsu/redirect は LIFF iframe 想定なので除外。リリース後 1 週間以内推奨。

#### ℹ️ [Info] CSP ヘッダー未設定
- 内容: 軽量サービスでは optional。Recharts / LIFF / GA / next/font / next/image を許可するため `script-src` の指定がやや煩雑。当面 unset でもリスク許容範囲。

### 安心ポイント
- Open Redirect: `torisetsu/redirect` は dest パラメータを `'zukan' | 'report'` 限定で固定文字列にマッピング → open redirect 不可。`window.location.replace(target)` の target は内部固定パスのみ。
- パスワード / 秘密のログ出力: `console.error(error)` での Supabase エラー出力は metadata がほぼないため秘密漏えいなし (LINE error は statusCode + ID 切り出し only でトークン値出力なし)。
- ログ確認: line-notify.ts 内 `console.error` で `recipientId` (LINE userId) は出力されるがこれはこのサービスの DB に既にあるもの → 機密度は低い。
- Vercel HTTPS 強制 + HSTS Preload List 登録 (Vercel automatic) は本番で有効。
- HMAC-SHA256 署名検証 + timingSafeEqual 比較 (Chapter 2) は防御として完全。

## Chapter 10: SEO + メタデータ最終確認

### 監査サマリー
- 確認項目数: 7
- 発見問題数: 2
- 重要度内訳: Critical 0 / High 0 / Medium 1 / Low 1 / Info 1

### 発見事項

#### 🟡 [Medium] sitemap.xml に /about が含まれているが、他の公開ページとの粒度が要確認
- ファイル: `src/app/sitemap.ts`
- 内容: 含まれる URL は `/`, `/about`, `/diagnosis`, `/terms`, `/privacy` のみ。これは適切 (個人情報ページ noindex なので除外)。ただし `priority` 1.0 / 0.8 / 0.7 / 0.3 / 0.3 の設定は Google 公式に「無視される (参考程度)」と明示されている。OK。
- リスク: なし。優先度は便宜的。
- 推奨修正: 不要。

#### 🟢 [Low] /404 (not-found) ページが noindex 指定されていない (が、未配置のため Next デフォルト)
- ファイル: `src/app/_not-found` (build 出力にある)
- 内容: not-found.tsx を未配置のためデフォルトの `_not-found` が使われる。Next.js のデフォルトは noindex 相当。
- 推奨修正: Chapter 8 で指摘した not-found.tsx 追加時に `robots: { index: false }` を明示。

#### ℹ️ [Info] OGP 画像
- ファイル: `public/ogp-v3.png` (785 KB), `public/ogp.png` (20 KB)
- 内容: ogp-v3.png (1200×630) を全ページで使用。ogp.png は古い画像が残存。
- 推奨修正: `public/ogp.png` (旧) は削除可能。実害なし。

### 安心ポイント
- 全公開ページに canonical URL 設定あり (LP / about / diagnosis / terms / privacy)。
- `metadataBase` を `BASE_URL = https://www.watashi-torisetsu.com` で設定 → 相対 URL が正しく絶対化される。
- robots.txt の Disallow リスト (`/admin`, `/api/`, `/result/`, `/report/`, `/friend/`, `/zukan/`, `/share`, `/line-register`, `/torisetsu/`) は個人情報ページを過不足なくカバー。
- 個人情報ページの layout.tsx 全部に `robots: { index: false, follow: false }` メタが設定済 (二重保険)。
- JSON-LD: LP に `WebApplication` schema、/about に `FAQPage` schema 設定済。
- LP の `<title>` テンプレ: `default: "ワタシのトリセツ｜友達と作る、自分の取扱説明書"` + `template: "%s｜ワタシのトリセツ"` → 各ページに自動で接尾。
- OGP: `og:type=website`, `og:locale=ja_JP`, `og:image=/ogp-v3.png` (1200×630), `twitter:card=summary_large_image` 全部設定。
- favicon: `apple-icon.png` + `icon.png` 配置済 (build output で確認)。

## Chapter 11: プライバシー + 法務整合性

### 監査サマリー
- 確認項目数: 6
- 発見問題数: 2
- 重要度内訳: Critical 0 / High 0 / Medium 1 / Low 1 / Info 0

### 発見事項

#### 🟡 [Medium] プラポリの業務委託先リストと実装の若干のズレ
- ファイル: `src/app/privacy/page.tsx:103-138`
- 内容: 委託先リストは Vercel / Supabase / LINE / Google / Cloudflare の 5 社。実装で使用しているのは:
  - Vercel: ホスティング ✓
  - Supabase: DB ✓
  - LINE Corporation: LINE Messaging API + LIFF ✓
  - Google LLC: GA4 ✓
  - Cloudflare: 「ドメイン管理、CDN」と記載されているが、コード上 Cloudflare 統合の痕跡なし。Vercel が CDN を担っており Cloudflare は使われていない可能性が高い。実際にドメインの DNS が Cloudflare 経由ならプラポリ記載は正しいが、要 Vercel DNS / Cloudflare DNS の設定確認 (Chapter 12)。
- リスク: ドメインが Vercel DNS で運用されているのにプラポリが Cloudflare と記載しているとミスリード。
- 推奨修正: 実 DNS 提供元を確認 (whois / dig NS) し、不一致なら privacy.tsx を修正。

#### 🟢 [Low] localStorage 利用とプラポリ記載の整合
- ファイル: `src/lib/track.ts`, `src/app/diagnosis/page.tsx`, `src/app/result/[ownerToken]/page.tsx`
- 内容: localStorage に保存するキー: `torisetsu_session` (sessionId), `torisetsu_result`, `torisetsu_invite_code`, `torisetsu_owner_token`, `torisetsu_result_viewed`, `torisetsu_admin_key`, `torisetsu_preview`。プラポリ第 7 条で「Cookie および類似の技術 (Local Storage 等)」「ユーザーの識別」「利便性向上のための設定保存」と書かれており妥当な記載範囲。
- リスク: なし。
- 推奨修正: 不要。

### 安心ポイント
- フッター (`src/components/Footer.tsx`) から /terms と /privacy への明示リンクあり。/about へのリンクもあり、3 リンクとも目立つ位置。
- support@watashi-torisetsu.com の mailto リンクが Footer / privacy / terms の 3 箇所に記載 (一貫性 OK)。
- 友達回答前画面 (`/friend/[inviteCode]/page.tsx`) で「正解はありません。回答は完全匿名で届きます」と明示。プラポリ第 2 条と整合。
- 自由記述 (Q4, Q5 など friend questions) はそのまま owner に表示されるが、選択肢ベースの "好き" や "魅力" で愛されるクセに変換されており、傷つける表現は出にくい設計。
- 13 歳未満の取り扱い、未成年者の保護者同意 → 規約・プラポリ両方に明記済。
- 法令準拠 (個人情報保護法、PDPA) の言及あり。
- 大学生対象の trust トーンと法務文書のバランスがとれている (口語と硬い文体の使い分け)。

## Chapter 12: リリース実機チェック (ユーザー実施項目)

> 以下はユーザー (リリース実施者) が本番環境で手動確認する項目。Chapter 1〜11 の問題対応と並行して進めること。

### 12.1 ドメイン / DNS

- [ ] `https://www.watashi-torisetsu.com/` を実機ブラウザで開き 200 で LP 表示
- [ ] `https://watashi-torisetsu.com/` (apex) → `https://www.watashi-torisetsu.com/` に 301 永続リダイレクト
- [ ] HTTP → HTTPS の自動リダイレクト確認
- [ ] HSTS ヘッダ含まれているか (curl -I で確認)
- [ ] 旧ドメイン `https://watashi-no-torisetsu.vercel.app/` の扱い決定:
  - (a) 新ドメインへ 301 リダイレクト (推奨)
  - (b) Vercel 側で deployment を停止
  - (c) 410 Gone を返す
  → (a) を推奨。Search Console での旧 URL クロールエラーを最小化
- [ ] DNS NS レコードの実提供元を確認 (`dig NS watashi-torisetsu.com`) — Chapter 11 の Cloudflare 記載整合性

### 12.2 環境変数 (Vercel Production / Preview / Development)

下記 env が Vercel ダッシュボードで Production / Preview に設定されているか:

#### 必須 (Server-side / Public)
- [ ] `NEXT_PUBLIC_SITE_URL=https://www.watashi-torisetsu.com`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `LINE_CHANNEL_SECRET`
- [ ] `LINE_CHANNEL_ACCESS_TOKEN`
- [ ] `ADMIN_KEY` (32 文字以上のランダム値に変更されているか — Chapter 1 High)
- [ ] `NEXT_PUBLIC_LIFF_ID` (line-register 用)
- [ ] `NEXT_PUBLIC_LIFF_ID_SHARE` (share 用)
- [ ] `NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT` (リッチメニュー redirect 用)
- [ ] `NEXT_PUBLIC_GA_MEASUREMENT_ID` (GA4 計測 ID)
- [ ] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (Search Console 認証コード)

#### Chapter 1 で追加要望
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (Chapter 1/3 の RLS 修正に伴い追加)
- [ ] `LIFF_ID_SHARE` (server-side fallback、line-flex.ts で使用) — 不要なら明示的にスキップ判断

#### オプショナル
- [ ] `NEXT_PUBLIC_DEVELOPER_NAME` (about ページの署名カスタマイズ用)

### 12.3 Supabase

- [ ] RLS ポリシーが Chapter 3 Critical で指摘した修正済 (anyone can update を service_role に絞る)
- [ ] テストデータの掃除 (Chapter 3 Info の SQL クエリ参照)
  - [ ] `display_name LIKE '%test%' OR '%テスト%' OR '%dev%'` を確認・削除
  - [ ] generation NULL かつ campaign NULL の users を確認
  - [ ] friend_answers が同一 user_id で 5 件以上の場合は審査
- [ ] バックアップ設定 (Supabase 自動 daily backup の確認、または Point-in-time recovery 有効化)
- [ ] Database row count の現状把握: users / friend_answers / events / line_users / feature_optins

### 12.4 LINE Developers Console

- [ ] LIFF アプリ 3 つの Endpoint URL が新ドメインに更新済:
  - LIFF_ID (line-register): `https://www.watashi-torisetsu.com/line-register`
  - LIFF_ID_SHARE (share): `https://www.watashi-torisetsu.com/share`
  - LIFF_ID_TORISETSU_REDIRECT (リッチメニュー): `https://www.watashi-torisetsu.com/torisetsu/redirect`
- [ ] LIFF Scope: profile + openid (LINE userId 取得)、shareTargetPicker scope (LIFF_ID_SHARE のみ)
- [ ] Messaging API Webhook URL: `https://www.watashi-torisetsu.com/api/webhook/line`
- [ ] Webhook 利用設定 ON、応答メッセージ OFF (重複防止)
- [ ] LINE 公式アカウント友達追加 URL `https://lin.ee/VbAOXrV` の有効性確認
- [ ] リッチメニュー画像 + tap area の動作確認

### 12.5 LINE 連携実機テスト

- [ ] /diagnosis → 診断完了 → /result/[token] 表示
- [ ] /result/[token] の "LINE で友だち追加" タップ → LIFF 起動 → friendship 状態判定
- [ ] 友達追加直後 5 秒以内に welcome flex 受信
- [ ] welcome flex の "他己評価を増やす" ボタン → LIFF share → shareTargetPicker 起動
- [ ] friend に invite を送信 → 友達回答 → owner に N1/N2/N3 通知が順番に届く
- [ ] N3 (3 人達成) Flex の "完成したトリセツを開く" → /report/[token] が完成版表示
- [ ] リッチメニュー → 「私のトリセツ」セル → /torisetsu/redirect → /report/[token] に到達
- [ ] リッチメニュー → 「タイプ図鑑」セル → /torisetsu/redirect?dest=zukan → /zukan/[token] に到達
- [ ] リッチメニュー → 「準備中」セル → coming_soon Flex → 「お知らせを受け取る」 → optin 完了メッセージ

### 12.6 メール

- [ ] support@watashi-torisetsu.com 宛にテスト送信 (gmail / icloud / outlook 各 1 通)
- [ ] 受信できることを確認 (迷惑メール フォルダ含む)
- [ ] SPF / DKIM / DMARC レコードの設定確認 (将来の問い合わせ返信が迷惑メール扱いされないよう)

### 12.7 検索エンジン / アナリティクス

- [ ] `https://www.watashi-torisetsu.com/sitemap.xml` 200 で表示
- [ ] `https://www.watashi-torisetsu.com/robots.txt` 200 で表示、Disallow が想定通り
- [ ] Google Search Console 登録 (DNS TXT または HTML タグ認証)
- [ ] Search Console で sitemap.xml 提出
- [ ] GA4 リアルタイムレポートで `/` アクセスがイベント受信されること
- [ ] GA4 で diagnosis_started / diagnosis_completed カスタムイベント受信

### 12.8 SNS シェア OGP 確認

- [ ] LINE で `https://www.watashi-torisetsu.com/` を送信 → OGP プレビュー (タイトル/説明文/画像) 表示
- [ ] X (Twitter) Card Validator で URL チェック
- [ ] Slack で URL を投稿 → unfurl で OGP 表示
- [ ] Facebook Sharing Debugger で URL チェック (将来用)

### 12.9 KPI イベント

- [ ] `/api/event` POST が 200 を返すこと (curl テスト)
- [ ] events テーブルに以下のイベントが日常運用で蓄積されることを確認:
  - diagnosis_started / diagnosis_completed
  - friend_landing_viewed / friend_answer_started / friend_answer_completed
  - friend_share_clicked / friend_link_copied
  - line_register_clicked / line_register_completed
  - result_viewed / result_revisited
  - friend_to_diagnosis_clicked
  - friend_perception_shown
  - friend_question_answered / diagnosis_question_answered

### 12.10 管理画面

- [ ] `/admin` にアクセス → ADMIN_KEY (Vercel に設定した値) で認証成功
- [ ] /admin の stats が正常表示 (期間切替・タイプ分布・campaign stats など)
- [ ] /admin の welcome 再送ツールが正常動作
- [ ] /admin の simulate-follow ツールが正常動作

### 12.11 セキュリティ最終確認

- [ ] Chapter 2/3 で指摘した Critical (line-resolve, RLS) は **必ず** リリース前に対応完了
- [ ] Chapter 8 で指摘した error.tsx / not-found.tsx を追加
- [ ] /api/admin/* に管理者以外がアクセスして 401 が返ることを実機確認
- [ ] /api/webhook/line に署名なし POST → 401 確認
- [ ] /api/webhook/line に不正署名 POST → 401 確認
