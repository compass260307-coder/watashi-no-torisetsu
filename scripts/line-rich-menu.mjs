// Alice Plus (LINE) Phase 4: リッチメニュー作成・画像アップロード・既定設定。
//
// 使い方:
//   node --env-file=.env.local scripts/line-rich-menu.mjs <image.png>
//
// ボタンはメッセージ送信型 (「診断結果」「使い方」「Alice Plus」) で、
// 応答は webhook 側のキーワード層 (matchLineCommand) が返す。
// 画像は 2500x843 PNG (生成は scripts/line-rich-menu-image.py)。
// 再実行すると新しいメニューを作って既定を差し替え、古い alice-main-menu-* を削除する。

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  process.exit(1);
}

const MENU_NAME_PREFIX = "alice-main-menu";

const imagePath = process.argv[2];
if (!imagePath) {
  console.error("usage: node scripts/line-rich-menu.mjs <image.png>");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}` };
const json = { ...headers, "Content-Type": "application/json" };

async function api(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

const MENU = {
  size: { width: 2500, height: 843 },
  // selected=false: トークを主役にしてメニューは畳んでおく (バーに chatBarText 表示)
  selected: false,
  name: `${MENU_NAME_PREFIX}-${new Date().toISOString().slice(0, 10)}`,
  chatBarText: "メニュー",
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: "message", text: "診断結果" },
    },
    {
      bounds: { x: 833, y: 0, width: 833, height: 843 },
      action: { type: "message", text: "使い方" },
    },
    {
      bounds: { x: 1666, y: 0, width: 834, height: 843 },
      action: { type: "message", text: "Alice Plus" },
    },
  ],
};

const { readFile } = await import("node:fs/promises");
const image = await readFile(imagePath);

// 1) 作成
const { richMenuId } = await api("https://api.line.me", "/v2/bot/richmenu", {
  method: "POST",
  headers: json,
  body: JSON.stringify(MENU),
});
console.log("created:", richMenuId);

// 2) 画像アップロード (api-data ホスト)
await api("https://api-data.line.me", `/v2/bot/richmenu/${richMenuId}/content`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "image/png" },
  body: image,
});
console.log("image uploaded");

// 3) 全ユーザーの既定に設定
await api("https://api.line.me", `/v2/bot/user/all/richmenu/${richMenuId}`, {
  method: "POST",
  headers,
});
console.log("set as default");

// 4) 古い alice-main-menu-* を掃除
const { richmenus } = await api("https://api.line.me", "/v2/bot/richmenu/list", {
  headers,
});
for (const menu of richmenus ?? []) {
  if (menu.richMenuId !== richMenuId && menu.name.startsWith(MENU_NAME_PREFIX)) {
    await api("https://api.line.me", `/v2/bot/richmenu/${menu.richMenuId}`, {
      method: "DELETE",
      headers,
    });
    console.log("deleted old:", menu.richMenuId, menu.name);
  }
}
console.log("done");
