# KakaoTalk公式共有の設定

韓国語版の共有ボタンは、Kakao Developers公式JavaScript SDKと
`Kakao.Share.sendDefault()`を使用します。SDK未設定または読込失敗時は、
Web Share APIまたはリンクコピーへフォールバックします。

## 共有時の動作と計測

- 韓国語の友達招待 (`/ko/friend/[inviteCode]`) は、既存の韓国語OG画像と
  「친구 진단 시작하기」ボタンを含むフィードカードで共有する。
  自己診断・性格タイプの共有は従来のテキスト形式を維持する。
- 初期化済みSDKはクリック処理内で直接呼ぶ。SDK読込を待ってから共有を開くと
  モバイルブラウザのユーザー操作判定を失う場合があるため、未準備時は待たずに
  OS共有・コピーへ進む。SDK自体は韓国語レイアウトで先読みする。
- Kakao SDK呼出しは送信完了の証明ではない。Kakao起動・コピーだけでは
  送信シートを閉じず、友達の回答待ち人数も増やさない。
- OS共有をキャンセルした場合はコピーへ切り替えず、招待操作も記録しない。
- 既存の共有イベントの `channel` とURLの `ref` を、実際の経路
  (`kakao` / `native` / `copy`) に合わせる。Kakaoボタン由来は
  `requested_channel=kakao`、`share_method`、`share_status` を併記する。
  `share_status=requested` はSDK呼出しで、メッセージ到達ではない。
- 実際に友達へ届いたかは `friend_landing_viewed` と回答データで確認する。
  Kakao側の送信完了を確定したい場合は別途公式Webhookの設定が必要。

ローカル回帰確認: `node scripts/kakao-share-test.mjs`。
SDK・Web Share・Clipboardの代替実装を使い、実際のメッセージは送信しない。
公式Kakaoアプリへの遷移・送信・カードの実表示は、キーと登録ドメインを設定した
環境での実機確認が必要。

## Kakao Developers側

1. Kakao Developersでアプリを作成する。
2. `[アプリ] > [プラットフォームキー] > [JavaScriptキー]` で、
   JavaScript SDKドメインに次を登録する。
   - `https://www.watashi-torisetsu.com`
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`（このアドレスでローカル確認する場合）
3. `[アプリ] > [製品リンク管理] > [Webドメイン]` に
   `https://www.watashi-torisetsu.com` を登録する。

Kakaoの2025年12月以降の管理画面では、SDK呼出元ドメインと、共有メッセージ内の
リンク先ドメインは別設定です。両方を登録してください。

## 環境変数

Kakao DevelopersのJavaScriptキーを、ローカルとVercelのPreview / Productionに
次の名前で設定します。

```text
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY
```

JavaScriptキーはブラウザで利用する公開用プラットフォームキーです。
REST APIキーやAdminキーは使用しません。

## 公式資料

- https://developers.kakao.com/docs/ko/javascript/getting-started
- https://developers.kakao.com/docs/ko/kakaotalk-share/js-link
- https://developers.kakao.com/docs/ko/app-setting/app
