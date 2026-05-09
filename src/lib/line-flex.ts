import type { messagingApi } from "@line/bot-sdk";

const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.watashi-torisetsu.com";

const PINK = "#FF6B9C";
const PINK_LIGHT = "#E5C5D0";
const PINK_BG = "#FFF5F8";
const TEXT_MUTED = "#666666";
const TEXT_DIM = "#888888";

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
export function buildWelcomeRegisteredFlex(
  inviteCode: string,
): messagingApi.Message {
  const shareUrl = getShareLiffUrl(inviteCode);
  return {
    type: "flex",
    altText: "登録ありがとう🐧 あなたのトリセツは育っていくよ",
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
        contents: [
          {
            type: "text",
            text: "登録ありがとう🐧",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "あなたのトリセツは、友達が答えてくれるたびに育っていくよ。リッチメニューからいつでも開けるよ。",
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
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "もっと育てたい人へ ↓",
            size: "xs",
            color: TEXT_DIM,
            align: "center",
          },
          {
            type: "button",
            style: "primary",
            color: PINK,
            height: "md",
            action: {
              type: "uri",
              label: "他己評価を増やす",
              uri: shareUrl,
            },
          },
        ],
      },
    },
  };
}

// W (未紐付け) - bot を直接 follow した未診断ユーザー向け
export function buildWelcomeUnregisteredFlex(): messagingApi.Message {
  return {
    type: "flex",
    altText: "ワタシのトリセツへようこそ🐧 まずは 15問の自己診断から",
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
            text: "ワタシのトリセツへようこそ🐧",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "まずは 15問の自己診断から始めよう。3 分くらいで終わるよ。",
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
