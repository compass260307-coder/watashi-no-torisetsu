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

// D-1: 「🟣 統合トリセツ」リッチメニュータップ時 (リリース 3 まで準備中)
export function buildIntegratedComingSoonFlex(): messagingApi.Message {
  const shareUrl = getShareLiffUrl();
  return {
    type: "flex",
    altText: "🟣 統合トリセツは準備中 (リリース 3 で利用可能)",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "🟣 統合トリセツは準備中",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "友達 1 人から評価をもらうと、AI が「真のトリセツ」を作成できるようになるよ。",
            size: "sm",
            color: TEXT_MUTED,
            wrap: true,
            margin: "md",
          },
          {
            type: "text",
            text: "まずは友達を招待してみよう。",
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
              label: "💌 友達を招待する",
              uri: shareUrl,
            },
          },
        ],
      },
    },
  };
}

// D-1: 「⚙️ 設定」リッチメニュータップ時 (リリース 3 まで準備中)
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
