# みち（rgg36）の2段階移行

## 段階1：先に単独公開

- 直接初期化・送信するPixelは `rgg36` だけ。
- 診断 `tw-rgg36-rgg9b` は従来どおり、診断保存成功後の10分マーカー・本人結果の条件と既存の重複防止を維持し、payload `{}`。
- 購入 `tw-rgg36-rgg3b` は従来どおり、署名付きAPIがStripeで完了・支払済み・対象商品を検証したlive決済、JPYのみ。実金額・通貨・Stripe Session IDの `conversion_id` を維持する。
- 同じゲートで `diagnosis_completed` / `purchase_verified` をdataLayerに追加。新イベントの追加失敗で直接Xを止めない。
- headの `measurement_ready`、両コンバージョンの `x_transport` は **`direct`**。この段階のGTMからXを送ってはいけない。
- 既存Meta/TikTok/GA4/Yahooのイベント・タグ、商品・価格・DB・環境変数は変更しない。

## dataLayer契約（rgg36用の対象範囲）

| event | 条件 | 一意ID | その他 |
| --- | --- | --- | --- |
| `measurement_ready` | document初期化 | なし | `x_transport`, `measurement_version: 1` |
| `diagnosis_completed` | 上記の既存診断完了ゲート | `event_id` = `conversion_id` = 診断user ID | `x_transport`, `measurement_version: 1` |
| `purchase_verified` | 上記の既存JPY購入ゲート | `event_id` = `conversion_id` = Stripe Checkout Session ID | 実決済の `value`, `currency: JPY`, `x_transport`, `measurement_version: 1` |

これは全媒体・全通貨の購入イベントへの置換ではない。既存の `meta_purchase` とTikTok Purchase等は維持する。owner token・認証session token・メール・購入完了URLは新dataLayerに入れない。

送信済みはブラウザ内の手渡しを意味し、媒体の受信確認ではない。既存Xキーと追加dataLayerキーを維持し、再読込・対応ブラウザのタブ間ロック・過去購入の再送防止を継続する。別端末・storage消去後の完全な重複防止は保証しない。

## 段階2：別PR、マージ・公開は明示指示待ち

直接のuwt.jsローダーと `twq` 呼び出しを除去し、`x_transport` を **`gtm`** に切り替える。

GTM側で次を準備し、ユーザーの公開指示が出るまで停止状態にする。

1. ベース：`measurement_ready` **かつ** `x_transport == gtm` **かつ** 本番host `www.watashi-torisetsu.com`。rgg36だけを初期化し、twqローダーを一度だけ定義する。
2. 診断：`diagnosis_completed` **かつ** 同transport・host。イベントID `tw-rgg36-rgg9b`、`conversion_id` = dataLayerの同名値。
3. 購入：`purchase_verified` **かつ** 同transport・host **かつ** `currency == JPY`。イベントID `tw-rgg36-rgg3b`、`conversion_id` / `value` / `currency` をdataLayerから渡す。
4. イベントタグのセットアップタグとしてベース初期化を指定し、loader遅延時にもtwqキューで待てるようにする。二重初期化を避ける。
5. 旧Xタグ（27 / 29 / 34）やURL条件の購入タグを復活させず、他媒体タグは維持する。

安全な切り替え順は、上記のtransport条件付きGTMタグの公開・確認 → 段階2のmainマージ・本番公開。段階1の開きっぱなしのタブはdirect、段階2の新documentはgtmになるため、両方を同じ条件で送らない。GTM公開前に段階2を公開すると計測が途切れる。

段階2は単独でマージしない。GTMを変更する作業と公開タイミングを合わせ、自然に発生する診断・購入で確認する。検証用の架空イベント・テスト注文を本番Xへ送らない。切り戻す場合は段階1の検証済みDeploymentへ戻す。transport条件付きGTMはdirectのタブを無視する。

## 検証

- 本番親コミット `ad19bbf` とrgg36の発火をオフライン差分比較。
- 実際の購入コンポーネント・署名付きprepare・Stripe検証をstubで実行し、未払い・テスト・不正なSessionを除外。
- Chromeは新規profile・外部通信遮断でreload、複数タブ、通貨、診断ゲートを確認。
- ESLint、TypeScript、本番build、commerce契約検証を実行。広告・DBへテストイベントは送らない。
