import type { messagingApi } from "@line/bot-sdk";

const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.watashi-torisetsu.com";

const PINK = "#FF6B9C";
const PINK_LIGHT = "#E5C5D0";
const PINK_BG = "#FFF5F8";
const TEXT_MUTED = "#666666";

function getShareLiffUrl(inviteCode?: string): string {
  const liffShareIdRaw =
    process.env.NEXT_PUBLIC_LIFF_ID_SHARE ?? process.env.LIFF_ID_SHARE ?? "";
  if (!liffShareIdRaw) {
    return inviteCode
      ? `${PUBLIC_BASE_URL}/friend/${inviteCode}`
      : `${PUBLIC_BASE_URL}/`;
  }
  return inviteCode
    ? `https://liff.line.me/${liffShareIdRaw}?inviteCode=${encodeURIComponent(inviteCode)}`
    : `https://liff.line.me/${liffShareIdRaw}`;
}

// Phase 3-β B-5: マイ図鑑 LIFF URL (Welcome / 通知系の CTA で使用)
// /torisetsu/redirect (cell 1 LIFF) を ?dest=zukan-mine で呼び出す前提 (B-4 で実装)
function getZukanMineLiffUrl(): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
  if (!liffId) return `${PUBLIC_BASE_URL}/`;
  return `https://liff.line.me/${liffId}?dest=zukan-mine`;
}

function getResultUrl(ownerToken: string): string {
  return `${PUBLIC_BASE_URL}/result/${ownerToken}`;
}

// 進捗ドット (●○○ / ●●○ / ●●● 完成✨) を text コンポーネントで生成
function progressDotsContent(filled: 1 | 2 | 3): messagingApi.FlexText {
  if (filled === 3) {
    return {
      type: "text",
      text: "● ● ●  完成✨",
      align: "center",
      size: "lg",
      margin: "md",
      weight: "bold",
      wrap: true,
      contents: [
        { type: "span", text: "●", color: PINK },
        { type: "span", text: " ●", color: PINK },
        { type: "span", text: " ●", color: PINK },
        { type: "span", text: "  完成✨", color: PINK, weight: "bold" },
      ],
    };
  }
  const dots: messagingApi.FlexSpan[] = [];
  for (let i = 1; i <= 3; i++) {
    const isFilled = i <= filled;
    const symbol = isFilled ? "●" : "○";
    const txt = i === 1 ? symbol : ` ${symbol}`;
    dots.push({
      type: "span",
      text: txt,
      color: isFilled ? PINK : PINK_LIGHT,
    });
  }
  return {
    type: "text",
    text: "●○○",
    align: "center",
    size: "lg",
    margin: "md",
    wrap: true,
    contents: dots,
  };
}

// W (紐付け済) - 診断完了済み本人への welcome
// Phase 3-β B-5: 新コンセプト「他者の眼でコレクションを増やす」を導入。
// Phase 3-β D-5/D-7: options.inviter (招待元) 渡しで「招待経由オンボーディング」対応。
// 旧呼び出し互換: 第 1 引数 inviteCode は必須 (share LIFF URL 生成用)。
//
// options:
//   - fullCode / typeName: 提供時「あなたのトリセツは『EAO-C-N (お祭り系)』」を挿入
//   - inviter: 提供時「{name}さんの招待がきっかけ。ありがとう！」+
//              footer に「{name}さんへ評価を返す」ボタンを追加 (primary を逆向き評価
//              に差し替え、マイ図鑑は secondary、友達招待は省略)
export function buildWelcomeRegisteredFlex(
  inviteCode: string,
  options?: {
    fullCode?: string;
    typeName?: string;
    inviter?: { name: string; inviteCode: string };
  },
): messagingApi.Message {
  const shareUrl = getShareLiffUrl(inviteCode);
  const zukanUrl = getZukanMineLiffUrl();
  const inviter = options?.inviter;

  const hasIdentity = !!(options?.fullCode || options?.typeName);
  const identityLine = hasIdentity
    ? `あなたのトリセツは「${options?.fullCode ?? "—"}${
        options?.typeName ? "（" + options.typeName + "）" : ""
      }」。`
    : null;

  const bodyContents: messagingApi.FlexComponent[] = [
    {
      type: "text",
      text: "🎴 ようこそ、ワタシのトリセツへ",
      weight: "bold",
      size: "lg",
      wrap: true,
    },
  ];
  if (inviter) {
    bodyContents.push({
      type: "text",
      text: `${inviter.name}さんの招待がきっかけでしたね。ありがとう！`,
      size: "sm",
      color: TEXT_MUTED,
      wrap: true,
      margin: "md",
    });
  }
  if (identityLine) {
    bodyContents.push({
      type: "text",
      text: identityLine,
      size: "sm",
      color: TEXT_MUTED,
      wrap: true,
      margin: "md",
    });
  }
  if (inviter) {
    bodyContents.push({
      type: "text",
      text: `${inviter.name}さんへ、あなたから見た${inviter.name}さんのトリセツを返してあげる？`,
      size: "sm",
      color: TEXT_MUTED,
      wrap: true,
      margin: "md",
    });
  } else {
    bodyContents.push(
      {
        type: "text",
        text: "ここから、あなたを知る旅が始まります。",
        size: "sm",
        color: TEXT_MUTED,
        wrap: true,
        margin: "md",
      },
      {
        type: "text",
        text: "友達に「あなたから見た私のトリセツが欲しい」と送って、他者の眼でコレクションを増やしていきましょう。",
        size: "sm",
        color: TEXT_MUTED,
        wrap: true,
        margin: "md",
      },
    );
  }

  // footer 構築: inviter 提供時は逆向き評価 CTA を primary、マイ図鑑 secondary
  //              不在時は マイ図鑑 primary + 友達招待 secondary (既存)
  const footerContents: messagingApi.FlexComponent[] = inviter
    ? [
        {
          type: "button",
          style: "primary",
          color: PINK,
          height: "md",
          action: {
            type: "uri",
            label: `${inviter.name}さんへ評価を返す`,
            uri: `${PUBLIC_BASE_URL}/friend/${encodeURIComponent(inviter.inviteCode)}`,
          },
        },
        {
          type: "button",
          style: "secondary",
          height: "md",
          action: {
            type: "uri",
            label: "マイ図鑑を見る",
            uri: zukanUrl,
          },
        },
      ]
    : [
        {
          type: "button",
          style: "primary",
          color: PINK,
          height: "md",
          action: {
            type: "uri",
            label: "マイ図鑑を見る",
            uri: zukanUrl,
          },
        },
        {
          type: "button",
          style: "secondary",
          height: "md",
          action: {
            type: "uri",
            label: "友達を招待する",
            uri: shareUrl,
          },
        },
      ];

  return {
    type: "flex",
    altText: inviter
      ? `${inviter.name}さんの招待ありがとう🐧 ようこそ、ワタシのトリセツへ`
      : "ようこそ、ワタシのトリセツへ🐧 他者の眼でコレクションを集めよう",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: `${PUBLIC_BASE_URL}/mascot/step1-receive.png`,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "fit",
        backgroundColor: PINK_BG,
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: bodyContents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: footerContents,
      },
    },
  };
}

// W (未紐付け) - bot を直接 follow した未診断ユーザー向け
// Phase 3-β B-5: 旧 15 問表記を新 50 問仕様 (約 5 分) に修正、コンセプトも刷新。
export function buildWelcomeUnregisteredFlex(): messagingApi.Message {
  return {
    type: "flex",
    altText: "ワタシのトリセツへようこそ🐧 まずは 50 問の自己診断から",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: `${PUBLIC_BASE_URL}/types/penguin-base.png`,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "fit",
        backgroundColor: PINK_BG,
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "🎴 ようこそ、ワタシのトリセツへ",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "あなたの「取扱説明書」を、自分の眼と友達の眼の両方から作るサービスです。",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "まずは 50 問の自己診断から (約 5 分)。",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "診断スタート",
              uri: `${PUBLIC_BASE_URL}/diagnosis`,
            },
          },
        ],
      },
    },
  };
}

// ============================================================
// Phase 3-β B-5 新規 builders (D-6 / D-8 / D-1 で利用)
// ============================================================

// D-6: 診断完了通知 (Welcome の 3 秒後に送る 2 段目)
//   - 完成したトリセツのコードを大きく見せて、結果ページとマイ図鑑への 2 CTA
export function buildDiagnosisCompleteFlex(args: {
  ownerToken: string;
  fullCode: string;
  typeName: string;
  modifierLabel: string;
}): messagingApi.Message {
  const resultUrl = getResultUrl(args.ownerToken);
  const zukanUrl = getZukanMineLiffUrl();
  return {
    type: "flex",
    altText: `🎴 あなたのトリセツが完成: ${args.fullCode} (${args.typeName})`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "🎴 あなたのトリセツが完成しました！",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: `「${args.fullCode}（${args.typeName}）」`,
            weight: "bold",
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: args.modifierLabel,
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "sm",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "結果ページを見る",
              uri: resultUrl,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "md",
            action: {
              type: "uri",
              label: "マイ図鑑を見る",
              uri: zukanUrl,
            },
          },
        ],
      },
    },
  };
}

// D-8: 友達評価到着通知 (perception ごとに 1 度発火、重複防止は notified_at)
export function buildFriendPerceptionReceivedFlex(args: {
  perceiverName: string;
  perceivedFullCode: string;
  perceivedTypeName: string;
  perceivedModifierLabel: string;
}): messagingApi.Message {
  const zukanUrl = getZukanMineLiffUrl();
  return {
    type: "flex",
    altText: `✨ ${args.perceiverName}さんから見たトリセツが完成: ${args.perceivedFullCode}`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: `${PUBLIC_BASE_URL}/mascot/step3-complete.png`,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "fit",
        backgroundColor: PINK_BG,
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `✨ ${args.perceiverName}さんから見た`,
            weight: "bold",
            wrap: true,
          },
          {
            type: "text",
            text: "あなたのトリセツが完成しました",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: `「${args.perceivedFullCode}（${args.perceivedTypeName}）」`,
            weight: "bold",
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: args.perceivedModifierLabel,
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "sm",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "マイ図鑑で詳しく見る",
              uri: zukanUrl,
            },
          },
        ],
      },
    },
  };
}

// プレミアム化 v2 Week 3 T3-4: 決済受領通知 (Webhook 着信直後)
// payment_history INSERT 直後に Webhook 経路で発火。
// AI 生成完了は別途 buildIntegratedCompletePaidFlex で通知する。
export function buildPaymentReceivedFlex(args: {
  sessionId: string;
  ownerName?: string;
}): messagingApi.Message {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
  const sessionEnc = encodeURIComponent(args.sessionId);
  const processingUrl = liffId
    ? `https://liff.line.me/${liffId}?dest=checkout-success&session_id=${sessionEnc}`
    : `${PUBLIC_BASE_URL}/checkout/success?session_id=${sessionEnc}`;
  const greeting = args.ownerName
    ? `${args.ownerName}さん、ご購入ありがとうございます`
    : "ご購入ありがとうございます";
  return {
    type: "flex",
    altText: "決済を受け付けました。AI が真のトリセツを生成しています...",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "決済を受け付けました",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: greeting,
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "AI が「真のトリセツ」を生成しています。\n通常 1-2 分で完成します。",
            size: "sm",
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "完成したら、またこのトークでお知らせします。",
            size: "xs",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "生成状況を見る",
              uri: processingUrl,
            },
          },
        ],
      },
    },
  };
}

// プレミアム化 v2 Week 3 T3-4: AI 生成完了通知
// generator.ts で status='completed' UPDATE 後に発火。
export function buildIntegratedCompletePaidFlex(args: {
  integratedId: string;
  title: string;
  subtitle: string;
  ownerName?: string;
}): messagingApi.Message {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
  const integEnc = encodeURIComponent(args.integratedId);
  const readUrl = liffId
    ? `https://liff.line.me/${liffId}?dest=integrated&id=${integEnc}`
    : `${PUBLIC_BASE_URL}/integrated/${integEnc}`;
  return {
    type: "flex",
    altText: `${args.title}が完成しました`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "真のトリセツが完成しました",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: args.title,
            size: "md",
            weight: "bold",
            wrap: true,
            margin: "md",
          },
          ...(args.subtitle
            ? [
                {
                  type: "text" as const,
                  text: args.subtitle,
                  size: "sm" as const,
                  color: TEXT_MUTED,
                  wrap: true,
                  margin: "sm" as const,
                },
              ]
            : []),
          {
            type: "text",
            text: "7 章 / 約 5,000 字の本格レポートです。\n読み終えたら、PDF ダウンロードもできます。",
            size: "xs",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "真のトリセツを読む",
              uri: readUrl,
            },
          },
        ],
      },
    },
  };
}

// プレミアム化 v2 Week 3 T3-4: 生成失敗通知 (MVP は手動返金前提)
// generator.ts で status='failed' UPDATE 後に発火。
export function buildIntegratedFailedFlex(args: {
  integratedId: string;
  ownerName?: string;
}): messagingApi.Message {
  const greeting = args.ownerName
    ? `${args.ownerName}さん、申し訳ありません`
    : "申し訳ありません";
  return {
    type: "flex",
    altText: "真のトリセツの生成に問題が発生しました",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "生成中に問題が発生しました",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: greeting,
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "AI 統合トリセツの生成中に予期せぬエラーが発生しました。",
            size: "sm",
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "このトークでサポートまでご返信ください。状況確認のうえ、再生成または返金のご案内をいたします。",
            size: "sm",
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: `参照 ID: ${args.integratedId.slice(0, 8)}...`,
            size: "xxs",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
        ],
      },
    },
  };
}

// プレミアム化 v2 Week 3 T3-7: 旧「準備中」Flex をプレミアム版案内に置換
// 旧 buildIntegratedComingSoonFlex の役割を更新版 (現在: プレミアム提供開始)。
// 関数名は新仕様に合わせて改名、postback action 名 "integrated_coming_soon" は
// 既存リッチメニュー画像の postback と互換維持のため、handler 側で受け続ける。
export function buildIntegratedPremiumFlex(): messagingApi.Message {
  const shareUrl = getShareLiffUrl();
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
  const integratedNewUrl = liffId
    ? `https://liff.line.me/${liffId}?dest=integrated-new`
    : `${PUBLIC_BASE_URL}/integrated/new`;
  return {
    type: "flex",
    altText: "統合トリセツ プレミアム版が利用可能になりました",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "統合トリセツ プレミアム版",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "複数の眼を統合して、あなたの「真のトリセツ」を AI が書き上げます。",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "・7 章 / 5,000 字以上\n・PDF 付き / 永続閲覧可能\n・¥500 (買い切り、税込)",
            size: "sm",
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "友達評価が多いほど深い統合になります。まずは友達を招待してみよう。",
            size: "xs",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "¥500 で作る",
              uri: integratedNewUrl,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "md",
            action: {
              type: "uri",
              label: "友達を招待する",
              uri: shareUrl,
            },
          },
        ],
      },
    },
  };
}

// D-1: 「⚙️ 設定」リッチメニュータップ時 (リリース 3 まで準備中)
// Phase 3-β リリース 3 で本物の /settings LIFF (buildSettingsLinkFlex) に置き換え。
// 旧 builder は webhook 側で参照しなくなったが、フォールバック用に保持。
export function buildSettingsComingSoonFlex(): messagingApi.Message {
  return {
    type: "flex",
    altText: "⚙️ 設定機能は準備中",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "⚙️ 設定機能は準備中",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "通知設定や、データ削除など、もう少しお待ちください。",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
        ],
      },
    },
  };
}

// Phase 3-β リリース 3 D-9: 友達評価依頼リマインド Flex (Cron 経由で送る)
// 招待してから 3 日経っても評価が来ない owner に「もう一度誘ってみる?」と提案。
// 「もう通知しない」postback で notification_preferences.enable_reminder = false。
export function buildFriendEvalReminderFlex(): messagingApi.Message {
  const shareUrl = getShareLiffUrl();
  return {
    type: "flex",
    altText: "💭 友達からの評価、まだ届いてないみたい",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "💭 友達からの評価、まだ届いてないみたい",
            weight: "bold",
            size: "md",
            wrap: true,
          },
          {
            type: "text",
            text: "「あなたから見た私のトリセツが欲しい」",
            wrap: true,
            margin: "md",
            color: PINK,
            weight: "bold",
          },
          {
            type: "text",
            text: "友達に伝えてみませんか?",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "sm",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "💌 友達を招待する",
              uri: shareUrl,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "md",
            action: {
              type: "postback",
              label: "もう通知しない",
              data: "action=disable_reminder",
              displayText: "リマインドを停止",
            },
          },
        ],
      },
    },
  };
}

// Phase 3-β リリース 3 (D-10+11+12): 「⚙️ 設定」案内 Flex (LIFF 経由 /settings へ)
// LIFF Endpoint URL は /torisetsu/redirect、?dest=settings 分岐で /settings に遷移。
export function buildSettingsLinkFlex(): messagingApi.Message {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
  const uri = liffId
    ? `https://liff.line.me/${liffId}?dest=settings`
    : `${PUBLIC_BASE_URL}/settings`;
  return {
    type: "flex",
    altText: "⚙️ 設定を開く",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "⚙️ 設定",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "通知の ON / OFF、データ削除、ヘルプの閲覧ができます。",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "設定を開く",
              uri,
            },
          },
        ],
      },
    },
  };
}

// 共通: N1/N2/N3 用 builder factory
type FriendAnsweredOptions = {
  altText: string;
  title: string;
  titleColor?: string;
  titleSize?: messagingApi.FlexText["size"];
  sub: string;
  heroImagePath: string; // 例: "/mascot/analyzing-penguin.png"
  buttonLabel: string;
};

function buildFriendAnsweredFlex(
  ownerToken: string,
  filled: 1 | 2 | 3,
  options: FriendAnsweredOptions,
): messagingApi.Message {
  const reportUrl = `${PUBLIC_BASE_URL}/report/${ownerToken}`;
  const titleText: messagingApi.FlexText = {
    type: "text",
    text: options.title,
    weight: "bold",
    size: options.titleSize ?? "lg",
    wrap: true,
    ...(options.titleColor ? { color: options.titleColor } : {}),
  };
  return {
    type: "flex",
    altText: options.altText,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: `${PUBLIC_BASE_URL}${options.heroImagePath}`,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "fit",
        backgroundColor: PINK_BG,
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          titleText,
          {
            type: "text",
            text: options.sub,
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
          progressDotsContent(filled),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: options.buttonLabel,
              uri: reportUrl,
            },
          },
        ],
      },
    },
  };
}

export function buildN1Flex(ownerToken: string): messagingApi.Message {
  return buildFriendAnsweredFlex(ownerToken, 1, {
    altText: "友達 1人目の回答が届いたよ🐧 相性のいいタイプが見えるよ",
    title: "友達 1人目の回答が届いたよ🐧",
    sub: "あなたと相性のいいタイプが見えるようになったよ",
    heroImagePath: "/mascot/analyzing-penguin.png",
    buttonLabel: "トリセツを開く",
  });
}

export function buildN2Flex(ownerToken: string): messagingApi.Message {
  return buildFriendAnsweredFlex(ownerToken, 2, {
    altText: "友達 2人目の回答も届いたよ🐧 自分と他者のグラフが見えるよ",
    title: "友達 2人目の回答も届いたよ🐧",
    sub: "自分と他者のグラフが見えるようになったよ",
    heroImagePath: "/mascot/analyzing-penguin.png",
    buttonLabel: "トリセツを開く",
  });
}

export function buildN3Flex(ownerToken: string): messagingApi.Message {
  return buildFriendAnsweredFlex(ownerToken, 3, {
    altText: "ついに 3人揃ったよ✨ 友達の回答から見えた、あなた が見えるよ",
    title: "ついに 3人揃ったよ✨",
    titleColor: PINK,
    titleSize: "xl",
    sub: "友達の回答から見えた、あなた が、ついに見えるよ✨",
    heroImagePath: "/mascot/step3-complete.png",
    buttonLabel: "完成したトリセツを開く",
  });
}

// ============================================================================
// LINE 手紙通知｜小出し3段階 (line_letter_notifications_v1)
//   友達の回答が 1 通届くごとに、届いた通数 (1/2/3) で出し分ける「手紙」通知。
//   【大原則】手紙の言葉そのもの (好きなところ/落ち込んだ時の言葉/自由記述) は
//   開封まで一文字も出さない。小出しにするのは「言葉の"周り"」だけ =
//   動物・共通点の予兆・ズレの予兆。
//   ボタンの share LIFF は getShareLiffUrl() (未設定時は /friend/{code} にフォールバック)。
// ============================================================================

function getMePageUrl(ownerToken: string): string {
  return `${PUBLIC_BASE_URL}/me/${ownerToken}`;
}

// TODO(line-letters): 開封フロー /me/{ownerToken}/open (一通ずつ封を開ける演出) は
//   別タスク。実装後はこの関数の戻り値を /me/{ownerToken}/open に差し替える。
//   現状 /open ルートは未実装 (404) のため、暫定で既存の /me/{ownerToken} を返す。
function getLetterOpenUrl(ownerToken: string): string {
  return `${PUBLIC_BASE_URL}/me/${ownerToken}`;
}

// 敬称付与。フォールバック名「お友達」には「さん」を付けない (「お友達さん」回避)。
function withHonorific(name: string): string {
  return name === "お友達" ? name : `${name}さん`;
}

// 通知①｜1通目到着 (friend 1人目の回答完了時)
//   animal は「動物名のみ」(理由は出さない)。未回答時は null → 汎用文にフォールバック。
export function buildLetter1Flex(args: {
  ownerToken: string;
  inviteCode: string;
  friendName: string;
  animal?: string | null;
}): messagingApi.Message {
  const shareUrl = getShareLiffUrl(args.inviteCode);
  const meUrl = getMePageUrl(args.ownerToken);
  const friend = withHonorific(args.friendName);

  const bodyContents: messagingApi.FlexComponent[] = [
    {
      type: "text",
      text: "📩 1通目、届きました",
      weight: "bold",
      size: "lg",
      wrap: true,
    },
    {
      type: "text",
      text: `${friend}が、あなたのことを書いてくれたよ。`,
      size: "sm",
      color: TEXT_MUTED,
      wrap: true,
      margin: "md",
    },
    { type: "separator", margin: "lg" },
  ];

  if (args.animal) {
    bodyContents.push(
      {
        type: "text",
        text: `${friend}は、あなたを「${args.animal}」に例えたみたい🐾`,
        weight: "bold",
        wrap: true,
        margin: "lg",
      },
      {
        type: "text",
        text: "理由は…開封してからのお楽しみ。",
        size: "sm",
        color: TEXT_MUTED,
        wrap: true,
        margin: "sm",
      },
    );
  } else {
    bodyContents.push({
      type: "text",
      text: "どんなふうに見えているかは、開封してからのお楽しみ。",
      weight: "bold",
      wrap: true,
      margin: "lg",
    });
  }

  bodyContents.push({
    type: "text",
    text: "あと 2 人で、みんなの言葉が読めるよ",
    size: "xs",
    color: PINK,
    wrap: true,
    margin: "lg",
  });

  return {
    type: "flex",
    altText: `📩 1通目、届きました｜${friend}が書いてくれたよ`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "none",
        contents: bodyContents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "残り2人にお願いする",
              uri: shareUrl,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "md",
            action: { type: "uri", label: "進捗を見る", uri: meUrl },
          },
        ],
      },
    },
  };
}

// 通知②｜2通目到着 (friend 2人目の回答完了時)
//   共通点/ズレは「予兆」だけ。軸名も中身も出さない (固定文)。
export function buildLetter2Flex(args: {
  ownerToken: string;
  inviteCode: string;
  friend1Name: string;
  friend2Name: string;
}): messagingApi.Message {
  const shareUrl = getShareLiffUrl(args.inviteCode);
  const friend1 = withHonorific(args.friend1Name);
  const friend2 = withHonorific(args.friend2Name);

  return {
    type: "flex",
    altText: "📩📩 2通目、届きました｜あと1人で開封！",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "none",
        contents: [
          {
            type: "text",
            text: "📩📩 2通目、届きました",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: `${friend1}と${friend2}、2人とも あなたの "あるところ" を同じように見てるみたい。`,
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "それが何かは、開けてのお楽しみ。",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "sm",
          },
          { type: "separator", margin: "lg" },
          {
            type: "text",
            text: "そして…自分のイメージと、ちょっとズレてる軸があるかも？",
            weight: "bold",
            wrap: true,
            margin: "lg",
          },
          {
            type: "text",
            text: "あと 1 人で開封！",
            weight: "bold",
            size: "lg",
            color: PINK,
            wrap: true,
            margin: "lg",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "あと1人にお願いする",
              uri: shareUrl,
            },
          },
        ],
      },
    },
  };
}

// 通知③｜3通目到着 = 開封解禁 (friend 3人目の回答完了時 = 3人ゲート達成)
export function buildLetter3Flex(args: {
  ownerToken: string;
  friend1Name: string;
  friend2Name: string;
  friend3Name: string;
}): messagingApi.Message {
  const openUrl = getLetterOpenUrl(args.ownerToken);
  const friend1 = withHonorific(args.friend1Name);
  const friend2 = withHonorific(args.friend2Name);
  const friend3 = withHonorific(args.friend3Name);

  return {
    type: "flex",
    altText: "🎉 3通、ぜんぶ揃いました｜今すぐ読めるよ",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: `${PUBLIC_BASE_URL}/mascot/step3-complete.png`,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "fit",
        backgroundColor: PINK_BG,
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "none",
        contents: [
          {
            type: "text",
            text: "🎉 3通、ぜんぶ揃いました",
            weight: "bold",
            size: "xl",
            color: PINK,
            wrap: true,
          },
          {
            type: "text",
            text: `${friend1}・${friend2}・${friend3}が書いてくれた言葉、今すぐ読めるよ。`,
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "一通ずつ、そっと開けてみて。",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "sm",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "手紙を開封する",
              uri: openUrl,
            },
          },
        ],
      },
    },
  };
}

// 4通目以降｜3人ゲート達成後の追加回答 → 軽い通知のみ (開封済みなら即読める)
export function buildLetterExtraFlex(args: {
  ownerToken: string;
  friendName: string;
}): messagingApi.Message {
  const meUrl = getMePageUrl(args.ownerToken);
  const friend = withHonorific(args.friendName);

  return {
    type: "flex",
    altText: `📩 新しい手紙が届いたよ｜${friend}から`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "none",
        contents: [
          {
            type: "text",
            text: "📩 新しい手紙が届いたよ",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: `${friend}も、あなたのことを書いてくれたよ。`,
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: { type: "uri", label: "手紙を読む", uri: meUrl },
          },
        ],
      },
    },
  };
}
